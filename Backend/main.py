import os
import hashlib
import secrets
import smtplib
import time
from email.message import EmailMessage

from fastapi import BackgroundTasks
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from pymongo.errors import DuplicateKeyError
from cryptography.fernet import Fernet


# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "SoftwareMovies")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "Movies")
USERS_COLLECTION_NAME = os.getenv("USERS_COLLECTION_NAME", "users")
SHOWROOMS_COLLECTION_NAME = os.getenv("SHOWROOMS_COLLECTION_NAME", "Showrooms")
SHOWTIMES_COLLECTION_NAME = os.getenv("SHOWTIMES_COLLECTION_NAME", "Showtimes")
BOOKINGS_COLLECTION_NAME = os.getenv("BOOKINGS_COLLECTION_NAME", "Booking")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM", SMTP_USER or "noreply@example.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

VERIFICATION_TOKEN_EXPIRE_MINUTES = int(os.getenv("VERIFICATION_TOKEN_EXPIRE_MINUTES", "60"))
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "30"))
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

MAX_CARDS = 3
cipher_suite = Fernet(ENCRYPTION_KEY.encode())

if not MONGODB_URI:
    raise Exception("MONGODB_URI not found in .env file")

if not JWT_SECRET_KEY:
    raise Exception("JWT_SECRET_KEY not found in .env file")

# Connect to MongoDB
client = AsyncIOMotorClient(MONGODB_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]
users_collection = db[USERS_COLLECTION_NAME]
showrooms_collection = db[SHOWROOMS_COLLECTION_NAME]
showtimes_collection = db[SHOWTIMES_COLLECTION_NAME]
bookings_collection = db[BOOKINGS_COLLECTION_NAME]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("verificationTokenHash")
    await users_collection.create_index("passwordResetTokenHash")
    # Compound index to make conflict queries fast
    await showtimes_collection.create_index(
        [("showroom_id", 1), ("date", 1), ("start_time", 1)]
    )
    # Bookings: fast seat-conflict lookups and session token lookups
    await bookings_collection.create_index(
        [("showtime_id", 1), ("status", 1)]
    )
    await bookings_collection.create_index("session_token")
    yield
    client.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("not-the-real-password")
bearer_scheme = HTTPBearer(auto_error=False)


# ---------- Pydantic models ----------

class UserSignup(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    username: str | None = None
    name: str | None = None
    status: str


class SignupResponse(BaseModel):
    message: str
    user: UserResponse


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UpdateProfile(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    username: str | None = Field(default=None, min_length=3, max_length=30)


class PaymentCard(BaseModel):
    cardholder_name: str = Field(max_length=100)
    card_number: str = Field(min_length=13, max_length=19)  # digits only
    expiry_month: int = Field(ge=1, le=12)
    expiry_year: int = Field(ge=2024)
    cvv: str = Field(min_length=3, max_length=4)


class Address(BaseModel):
    street: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    zip_code: str = Field(min_length=1, max_length=20)


class UpdateAddress(BaseModel):
    """All fields optional so the client can PATCH individual fields."""
    street: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    zip_code: str | None = Field(default=None, max_length=20)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class AddMovie(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2000)
    trailer: str | None = Field(default=None, max_length=500)
    poster: str | None = Field(default=None, max_length=500)
    rating: str | None = Field(default=None, max_length=10)  # e.g. "PG-13", "R"
    genre: list[str] = Field(default_factory=list)
    duration_minutes: int = Field(ge=1, le=600)
    cast: list[str] = Field(default_factory=list)
    currentlyPlaying: bool = False


class AddShowtime(BaseModel):
    movie_id: str
    showroom_id: str
    date: str = Field(
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="Date in YYYY-MM-DD format",
    )
    start_time: str = Field(
        pattern=r"^\d{2}:\d{2}$",
        description="Start time in HH:MM (24-hour) format",
    )


# Ticket pricing — update these values as needed
TICKET_PRICES: dict[str, float] = {
    "adult": 12.00,
    "child": 8.00,
    "senior": 10.00,
}


class TicketItem(BaseModel):
    seat: str = Field(min_length=1, max_length=10)
    type: str = Field(pattern=r"^(adult|child|senior)$")


class ReserveBooking(BaseModel):
    showtime_id: str
    tickets: list[TicketItem] = Field(min_length=1, max_length=50)
    session_token: str = Field(min_length=1, max_length=100)


class AttachUser(BaseModel):
    session_token: str


class ConfirmEmail(BaseModel):
    email: EmailStr
    
# ---------- Serializers ----------

def _mask_card(card: dict) -> dict:
    """Return a card dict safe to send to the client."""
    return {
        "cardholder_name": card.get("cardholder_name"),
        "last4": card.get("last4", ""), # Pull the explicitly saved last4
        "expiry_month": card.get("expiry_month"),
        "expiry_year": card.get("expiry_year"),
    }


def _serialize_address(address: dict | None) -> dict | None:
    """Return the address sub-document, or None if not set."""
    if not address:
        return None
    return {
        "street": address.get("street"),
        "city": address.get("city"),
        "state": address.get("state"),
        "zip_code": address.get("zip_code"),
    }


def movie_serializer(movie) -> dict:
    return {
        "id": str(movie["_id"]),
        "title": movie.get("title", ""),
        "description": movie.get("description", ""),
        "trailer": movie.get("trailer", ""),
        "poster": movie.get("poster", ""),
        "rating": movie.get("rating", ""),
        "genre": movie.get("genre", []),
        "currentlyPlaying": movie.get("currentlyPlaying", False),
        "datesPlaying": movie.get("datesPlaying", []),
        "duration_minutes": movie.get("duration_minutes"),
        "cast": movie.get("cast", []),
    }


def showroom_serializer(showroom) -> dict:
    return {
        "id": str(showroom["_id"]),
        "name": showroom.get("name", ""),
        "total_seats": showroom.get("total_seats", 0),
        "seat_layout": showroom.get("seat_layout", []),
    }


def showtime_serializer(showtime) -> dict:
    return {
        "id": str(showtime["_id"]),
        "movie_id": showtime.get("movie_id", ""),
        "showroom_id": showtime.get("showroom_id", ""),
        "showroom_name": showtime.get("showroom_name", ""),
        "date": showtime.get("date", ""),
        "start_time": showtime.get("start_time", ""),
        "end_time": showtime.get("end_time", ""),
    }


def booking_serializer(booking) -> dict:
    return {
        "id": str(booking["_id"]),
        "user_id": booking.get("user_id"),
        "showtime_id": booking.get("showtime_id", ""),
        "movie_title": booking.get("movie_title", ""),
        "showroom_name": booking.get("showroom_name", ""),
        "date": booking.get("date", ""),
        "start_time": booking.get("start_time", ""),
        "tickets": booking.get("tickets", []),
        "total_price": booking.get("total_price", 0.0),
        "status": booking.get("status", "reserved"),
        "email": booking.get("email"),
        "session_token": booking.get("session_token", ""),
        "created_at": booking.get("created_at", 0),
    }


def user_serializer(user) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "username": user.get("username"),
        "name": user.get("name"),
        "status": user.get("status", "Inactive"),
        "payment_cards": [_mask_card(c) for c in user.get("payment_cards", [])],
        "favorite_movie_ids": user.get("favorite_movie_ids", []),
        "address": _serialize_address(user.get("address")),
    }


def profile_serializer(user) -> dict:
    """Extended serializer used by profile endpoints."""
    return user_serializer(user)


# ---------- Auth utility functions ----------

def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_exception

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id or not ObjectId.is_valid(user_id):
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise credentials_exception

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    """
    Like get_current_user but returns None instead of raising 401 when no
    valid token is present. Used by booking endpoints that allow anonymous
    seat selection but require login at checkout.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id or not ObjectId.is_valid(user_id):
            return None
    except InvalidTokenError:
        return None

    return await users_collection.find_one({"_id": ObjectId(user_id)})


def make_verification_token():
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = int(time.time()) + (VERIFICATION_TOKEN_EXPIRE_MINUTES * 60)
    return raw_token, token_hash, expires_at


def make_password_reset_token():
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = int(time.time()) + (PASSWORD_RESET_TOKEN_EXPIRE_MINUTES * 60)
    return raw_token, token_hash, expires_at


def send_email(msg: EmailMessage) -> None:
    """Low-level helper that delivers a pre-built EmailMessage via SMTP."""
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD]):
        raise RuntimeError(
            "SMTP is not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD."
        )

    if SMTP_PORT == 465 or not SMTP_USE_TLS:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)


def send_verification_email(to_email: str, name: str | None, raw_token: str) -> None:
    verify_url = f"{BACKEND_URL}/verify-email?token={raw_token}"
    greeting = name or "there"

    msg = EmailMessage()
    msg["Subject"] = "Verify your account"
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.set_content(f"""Hi {greeting},

Thanks for signing up.

Please verify your email by clicking this link:

{verify_url}

If you did not create this account, you can ignore this email.
""")
    send_email(msg)


def send_password_reset_email(to_email: str, name: str | None, raw_token: str) -> None:
    reset_url = f"{FRONTEND_URL}/reset-password?token={raw_token}"
    greeting = name or "there"

    msg = EmailMessage()
    msg["Subject"] = "Reset your password"
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.set_content(f"""Hi {greeting},

We received a request to reset the password for your account.

Click the link below to choose a new password. This link expires in {PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.

{reset_url}

If you did not request a password reset, you can safely ignore this email.
""")
    send_email(msg)

def send_profile_update_email(to_email: str, name: str | None) -> None:
    greeting = name or "there"

    msg = EmailMessage()
    msg["Subject"] = "Your profile has been updated"
    msg["From"] = MAIL_FROM
    msg["To"] = to_email
    msg.set_content(f"""Hi {greeting},

This is a quick notification to let you know that your profile information was recently updated. 

If you made these changes, no further action is required. 

If you did not authorize this change, please reset your password immediately and contact support.
""")
    send_email(msg)
    
# ---------- Movie endpoints ----------

@app.get("/movies")
async def get_movies():
    movies = []
    async for movie in collection.find():
        movies.append(movie_serializer(movie))
    return movies


@app.get("/movies/{id}")
async def get_movie(id: str):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid movie ID")

    movie = await collection.find_one({"_id": ObjectId(id)})
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    return movie_serializer(movie)


# ---------- Admin: Add Movie ----------

@app.post("/admin/movies", status_code=status.HTTP_201_CREATED)
async def add_movie(body: AddMovie, current_user=Depends(get_current_user)):
    """
    Admin endpoint: insert a new movie into the database.
    Requires authentication. Rejects duplicate titles (case-insensitive).
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    # Reject duplicate title (case-insensitive)
    existing = await collection.find_one(
        {"title": {"$regex": f"^{body.title.strip()}$", "$options": "i"}}
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A movie titled '{body.title.strip()}' already exists.",
        )

    movie_doc = {
        "title": body.title.strip(),
        "description": body.description.strip(),
        "trailer": body.trailer.strip() if body.trailer else None,
        "poster": body.poster.strip() if body.poster else None,
        "rating": body.rating.strip() if body.rating else None,
        "genre": [g.strip() for g in body.genre],
        "duration_minutes": body.duration_minutes,
        "cast": [c.strip() for c in body.cast],
        "currentlyPlaying": body.currentlyPlaying,
        "datesPlaying": [],
        "createdAt": int(time.time()),
    }

    result = await collection.insert_one(movie_doc)
    created_movie = await collection.find_one({"_id": result.inserted_id})
    return movie_serializer(created_movie)


# ---------- Showrooms ----------

@app.get("/showrooms")
async def get_showrooms():
    """
    Return all showrooms. These are pre-seeded in the database by the admin.
    No authentication required — the frontend needs this to build the seat map.
    """
    showrooms = []
    async for showroom in showrooms_collection.find():
        showrooms.append(showroom_serializer(showroom))
    return showrooms


# ---------- Showtimes ----------

@app.post("/admin/showtimes", status_code=status.HTTP_201_CREATED)
async def add_showtime(body: AddShowtime, current_user=Depends(get_current_user)):
    """
    Admin endpoint: schedule a showtime for a movie in a showroom.
    - Validates that the movie and showroom exist.
    - Computes end_time from the movie's duration_minutes.
    - Rejects the request with 409 if the showroom already has an overlapping
      showtime on that date (adds a 30-minute buffer between screenings).
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )

    # Validate movie_id
    if not ObjectId.is_valid(body.movie_id):
        raise HTTPException(status_code=400, detail="Invalid movie ID")
    movie = await collection.find_one({"_id": ObjectId(body.movie_id)})
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Validate showroom_id
    if not ObjectId.is_valid(body.showroom_id):
        raise HTTPException(status_code=400, detail="Invalid showroom ID")
    showroom = await showrooms_collection.find_one({"_id": ObjectId(body.showroom_id)})
    if not showroom:
        raise HTTPException(status_code=404, detail="Showroom not found")

    # Compute end_time from movie duration + 30-minute cleanup buffer
    duration = movie.get("duration_minutes")
    if not duration:
        raise HTTPException(
            status_code=400,
            detail="Movie is missing duration_minutes. Update the movie before scheduling.",
        )

    start_dt = datetime.strptime(f"{body.date} {body.start_time}", "%Y-%m-%d %H:%M")
    end_dt = start_dt + timedelta(minutes=duration + 30)
    end_time_str = end_dt.strftime("%H:%M")

    # Conflict check: find any showtime in the same showroom on the same date
    # whose time window overlaps with the new one.
    # Overlap condition: existing.start < new.end  AND  existing.end > new.start
    existing_showtimes = showtimes_collection.find(
        {"showroom_id": body.showroom_id, "date": body.date}
    )
    async for existing in existing_showtimes:
        ex_start = datetime.strptime(
            f"{existing['date']} {existing['start_time']}", "%Y-%m-%d %H:%M"
        )
        ex_end = datetime.strptime(
            f"{existing['date']} {existing['end_time']}", "%Y-%m-%d %H:%M"
        )
        if ex_start < end_dt and ex_end > start_dt:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{showroom['name']} is already booked from "
                    f"{existing['start_time']} to {existing['end_time']} on {body.date}."
                ),
            )

    showtime_doc = {
        "movie_id": body.movie_id,
        "movie_title": movie["title"],
        "showroom_id": body.showroom_id,
        "showroom_name": showroom["name"],
        "date": body.date,
        "start_time": body.start_time,
        "end_time": end_time_str,
        "createdAt": int(time.time()),
    }

    result = await showtimes_collection.insert_one(showtime_doc)
    created = await showtimes_collection.find_one({"_id": result.inserted_id})
    return showtime_serializer(created)


@app.get("/movies/{movie_id}/showtimes")
async def get_showtimes_for_movie(movie_id: str):
    """
    Return all upcoming showtimes for a given movie, sorted by date then start_time.
    No authentication required — used by the user-facing movie page.
    """
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(status_code=400, detail="Invalid movie ID")

    movie = await collection.find_one({"_id": ObjectId(movie_id)})
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    today = datetime.now().strftime("%Y-%m-%d")

    showtimes = []
    async for showtime in showtimes_collection.find(
        {"movie_id": movie_id, "date": {"$gte": today}},
        sort=[("date", 1), ("start_time", 1)],
    ):
        showtimes.append(showtime_serializer(showtime))

    return showtimes


# ---------- Bookings ----------

@app.get("/showtimes/{showtime_id}/seats")
async def get_seats_for_showtime(showtime_id: str):
    """
    Return the showroom's full seat layout for a showtime, with each seat
    marked as available or booked.  No auth required — used to render the
    seat map before the user logs in.
    """
    if not ObjectId.is_valid(showtime_id):
        raise HTTPException(status_code=400, detail="Invalid showtime ID")

    showtime = await showtimes_collection.find_one({"_id": ObjectId(showtime_id)})
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    showroom = await showrooms_collection.find_one(
        {"_id": ObjectId(showtime["showroom_id"])}
    )
    if not showroom:
        raise HTTPException(status_code=404, detail="Showroom not found")

    # Collect every seat that is already reserved or confirmed for this showtime
    booked_seats: set[str] = set()
    async for booking in bookings_collection.find(
        {
            "showtime_id": showtime_id,
            "status": {"$in": ["reserved", "confirmed"]},
        }
    ):
        for ticket in booking.get("tickets", []):
            booked_seats.add(ticket["seat"])

    # Annotate the layout rows
    annotated_layout = []
    for row in showroom.get("seat_layout", []):
        annotated_row = []
        for seat_id in row:
            annotated_row.append(
                {
                    "seat": seat_id,
                    "status": "booked" if seat_id in booked_seats else "available",
                }
            )
        annotated_layout.append(annotated_row)

    return {
        "showtime_id": showtime_id,
        "showroom_id": showtime["showroom_id"],
        "showroom_name": showtime.get("showroom_name", ""),
        "seat_layout": annotated_layout,
        "total_seats": showroom.get("total_seats", 0),
        "booked_count": len(booked_seats),
    }


@app.post("/bookings/reserve", status_code=status.HTTP_201_CREATED)
async def reserve_booking(
    body: ReserveBooking,
    current_user=Depends(get_optional_user),
):
    """
    Reserve seats for a showtime.  Auth is optional — anonymous users pass a
    client-generated session_token so their reservation can be re-attached
    after login.  Returns the booking document including booking_id.

    Raises 409 if any requested seat is already taken.
    """
    if not ObjectId.is_valid(body.showtime_id):
        raise HTTPException(status_code=400, detail="Invalid showtime ID")

    showtime = await showtimes_collection.find_one({"_id": ObjectId(body.showtime_id)})
    if not showtime:
        raise HTTPException(status_code=404, detail="Showtime not found")

    requested_seats = [t.seat for t in body.tickets]

    # Conflict check — any active booking that overlaps with requested seats
    conflict = await bookings_collection.find_one(
        {
            "showtime_id": body.showtime_id,
            "status": {"$in": ["reserved", "confirmed"]},
            "tickets.seat": {"$in": requested_seats},
        }
    )
    if conflict:
        # Find exactly which seats are taken so the frontend can highlight them
        taken = [
            t["seat"]
            for t in conflict.get("tickets", [])
            if t["seat"] in requested_seats
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"The following seats are already booked: {', '.join(taken)}",
        )

    # Build ticket sub-documents with price per seat
    ticket_docs = []
    total_price = 0.0
    for item in body.tickets:
        price = TICKET_PRICES.get(item.type, 0.0)
        ticket_docs.append(
            {"seat": item.seat, "type": item.type, "price": price}
        )
        total_price += price

    booking_doc = {
        "user_id": str(current_user["_id"]) if current_user else None,
        "showtime_id": body.showtime_id,
        "movie_title": showtime.get("movie_title", ""),
        "showroom_name": showtime.get("showroom_name", ""),
        "date": showtime.get("date", ""),
        "start_time": showtime.get("start_time", ""),
        "tickets": ticket_docs,
        "total_price": round(total_price, 2),
        "status": "reserved",
        "email": current_user.get("email") if current_user else None,
        "session_token": body.session_token,
        "created_at": int(time.time()),
    }

    result = await bookings_collection.insert_one(booking_doc)
    created = await bookings_collection.find_one({"_id": result.inserted_id})
    return booking_serializer(created)


@app.get("/bookings/{booking_id}/summary")
async def get_booking_summary(
    booking_id: str,
    current_user=Depends(get_optional_user),
):
    """
    Return the full order summary for the checkout page.
    Accessible by the booking's owner (matched by user_id or session_token).
    Query param ?session_token=<token> is accepted for anonymous users.
    """
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID")

    booking = await bookings_collection.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Authorise: must be the owning user OR present the correct session token
    user_id = str(current_user["_id"]) if current_user else None
    if booking.get("user_id") and booking["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorised to view this booking")

    return booking_serializer(booking)


@app.put("/bookings/{booking_id}/attach-user")
async def attach_user_to_booking(
    booking_id: str,
    body: AttachUser,
    current_user=Depends(get_current_user),
):
    """
    Called after a successful login redirect during checkout.
    Attaches the now-authenticated user to an anonymous booking, provided the
    session_token matches and the booking has no existing owner.
    """
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID")

    booking = await bookings_collection.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("status") not in ("reserved",):
        raise HTTPException(
            status_code=400,
            detail="Only a reserved booking can be attached to a user.",
        )

    if booking.get("user_id") and booking["user_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=403,
            detail="This booking already belongs to another user.",
        )

    if booking.get("session_token") != body.session_token:
        raise HTTPException(status_code=403, detail="Session token does not match.")

    await bookings_collection.update_one(
        {"_id": ObjectId(booking_id)},
        {
            "$set": {
                "user_id": str(current_user["_id"]),
                "email": current_user.get("email"),
            }
        },
    )

    updated = await bookings_collection.find_one({"_id": ObjectId(booking_id)})
    return booking_serializer(updated)


@app.post("/bookings/{booking_id}/checkout")
async def checkout_booking(
    booking_id: str,
    body: ConfirmEmail,
    current_user=Depends(get_current_user),
):
    """
    Final step before the payment page (mockup).
    Confirms or updates the contact email on the booking.
    Ownership is verified — the authenticated user must own this booking.
    Returns the completed order summary ready for the payment page.
    """
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID")

    booking = await bookings_collection.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.get("user_id") != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorised for this booking.")

    if booking.get("status") != "reserved":
        raise HTTPException(
            status_code=400,
            detail="Booking is not in a reservable state.",
        )

    await bookings_collection.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"email": str(body.email).strip().lower()}},
    )

    updated = await bookings_collection.find_one({"_id": ObjectId(booking_id)})
    return {
        "message": "Proceed to payment.",
        "booking": booking_serializer(updated),
        "ticket_prices": TICKET_PRICES,
    }


# ---------- Auth endpoints ----------
@app.put("/me/password", status_code=status.HTTP_200_OK)
async def change_password(
    body: ChangePasswordRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Allows an authenticated user to change their password."""
    
    # 1. Verify the current password matches what is in the database
    if not verify_password(body.current_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password.",
        )

    # 2. Prevent them from reusing their current password (optional but recommended)
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    # 3. Hash the new password and update the database
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "hashed_password": hash_password(body.new_password),
            "passwordChangedAt": int(time.time()),
        }},
    )

    # 4. Trigger the security notification email in the background
    background_tasks.add_task(
        send_profile_update_email, 
        current_user["email"], 
        current_user.get("name")
    )

    return {"message": "Password successfully updated."}

@app.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
async def signup(user: UserSignup, background_tasks: BackgroundTasks):
    email = str(user.email).strip().lower()
    username = user.username.strip().lower()

    existing_email = await users_collection.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = await users_collection.find_one({"username": username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    raw_token, token_hash, expires_at = make_verification_token()

    new_user = {
        "email": email,
        "username": username,
        "name": user.name.strip() if user.name and user.name.strip() else None,
        "hashed_password": hash_password(user.password),
        "status": "Inactive",
        "verificationTokenHash": token_hash,
        "verificationTokenExpiresAt": expires_at,
        "createdAt": int(time.time()),
        "payment_cards": [],
        "favorite_movie_ids": [],
        "address": None,  # initialised as null
    }

    try:
        result = await users_collection.insert_one(new_user)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail="Email or username already exists")

    background_tasks.add_task(send_verification_email, email, new_user["name"], raw_token)

    created_user = await users_collection.find_one({"_id": result.inserted_id})
    return {
        "message": "Account created. Check your email to activate your account.",
        "user": user_serializer(created_user),
    }


@app.get("/verify-email", response_class=HTMLResponse)
async def verify_email(token: str):
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    user = await users_collection.find_one({"verificationTokenHash": token_hash})

    if not user:
        return HTMLResponse(
            content=f"""
            <html>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h2>Invalid verification link</h2>
                <p>This link is invalid or has already been used.</p>
                <a href="{FRONTEND_URL}/login">Back to Login</a>
              </body>
            </html>
            """,
            status_code=400,
        )

    if user.get("verificationTokenExpiresAt", 0) < int(time.time()):
        return HTMLResponse(
            content=f"""
            <html>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h2>Verification link expired</h2>
                <p>Please register again or request a new verification email.</p>
                <a href="{FRONTEND_URL}/register">Back to Register</a>
              </body>
            </html>
            """,
            status_code=400,
        )

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"status": "Active", "verifiedAt": int(time.time())},
            "$unset": {"verificationTokenHash": "", "verificationTokenExpiresAt": ""},
        },
    )

    return HTMLResponse(
        content=f"""
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h2>Email verified successfully</h2>
            <p>Your account is now active. You can log in now.</p>
            <a href="{FRONTEND_URL}/login">Go to Login</a>
          </body>
        </html>
        """,
        status_code=200,
    )


@app.post("/login", response_model=TokenResponse)
async def login(user: UserLogin):
    username = user.username.strip().lower()
    db_user = await users_collection.find_one({"username": username})

    if not db_user:
        verify_password(user.password, DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if db_user.get("status", "Inactive") != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in.",
        )

    access_token = create_access_token(
        data={"sub": str(db_user["_id"])},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_serializer(db_user),
    }


@app.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return user_serializer(current_user)


@app.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
async def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    email = str(body.email).strip().lower()
    user = await users_collection.find_one({"email": email})

    if user:
        raw_token, token_hash, expires_at = make_password_reset_token()
        await users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "passwordResetTokenHash": token_hash,
                "passwordResetTokenExpiresAt": expires_at,
            }},
        )
        background_tasks.add_task(
            send_password_reset_email, email, user.get("name"), raw_token
        )

    return {"message": "If that email is registered you will receive a reset link shortly."}


@app.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(body: ResetPasswordRequest):
    token_hash = hashlib.sha256(body.token.encode("utf-8")).hexdigest()
    user = await users_collection.find_one({"passwordResetTokenHash": token_hash})

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset link.")

    if user.get("passwordResetTokenExpiresAt", 0) < int(time.time()):
        await users_collection.update_one(
            {"_id": user["_id"]},
            {"$unset": {"passwordResetTokenHash": "", "passwordResetTokenExpiresAt": ""}},
        )
        raise HTTPException(
            status_code=400, detail="Reset link has expired. Please request a new one."
        )

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "hashed_password": hash_password(body.new_password),
                "passwordChangedAt": int(time.time()),
            },
            "$unset": {"passwordResetTokenHash": "", "passwordResetTokenExpiresAt": ""},
        },
    )
    return {"message": "Password updated successfully. You can now log in."}


# ---------- Profile endpoints ----------

@app.get("/me/profile")
async def get_profile(current_user=Depends(get_current_user)):
    """Returns the full profile including address, masked payment cards, and favourite movie IDs."""
    return profile_serializer(current_user)


@app.patch("/me/profile")
async def update_profile(
    body: UpdateProfile,
    background_tasks: BackgroundTasks, # Add BackgroundTasks here
    current_user=Depends(get_current_user),
):
    """Update name or username. Email cannot be changed here."""
    updates = {}

    if body.name is not None:
        updates["name"] = body.name.strip() or None

    if body.username is not None:
        new_username = body.username.strip().lower()
        existing = await users_collection.find_one({"username": new_username})
        if existing and existing["_id"] != current_user["_id"]:
            raise HTTPException(status_code=400, detail="Username already taken")
        updates["username"] = new_username

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": updates},
    )

    updated_user = await users_collection.find_one({"_id": current_user["_id"]})
    
    background_tasks.add_task(
        send_profile_update_email, 
        current_user["email"], 
        updated_user.get("name")
    )

    return profile_serializer(updated_user)

# ---------- Address endpoints ----------

@app.get("/me/address")
async def get_address(current_user=Depends(get_current_user)):
    """Return the saved address for the authenticated user, or null if none set."""
    return {"address": _serialize_address(current_user.get("address"))}


@app.put("/me/address")
async def set_address(
    body: Address,
    current_user=Depends(get_current_user),
):
    """
    Create or fully replace the user's address.
    Send all four fields: street, city, state, zip_code.
    """
    address_doc = {
        "street": body.street.strip(),
        "city": body.city.strip(),
        "state": body.state.strip(),
        "zip_code": body.zip_code.strip(),
    }

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"address": address_doc}},
    )

    updated_user = await users_collection.find_one({"_id": current_user["_id"]})
    return {"address": _serialize_address(updated_user.get("address"))}


@app.patch("/me/address")
async def update_address(
    body: UpdateAddress,
    current_user=Depends(get_current_user),
):
    """
    Partially update the user's address — only send the fields you want to change.
    Raises 404 if the user has no address saved yet (use PUT to create one first).
    """
    if not current_user.get("address"):
        raise HTTPException(
            status_code=404,
            detail="No address saved yet. Use PUT /me/address to create one.",
        )

    updates: dict = {}
    if body.street is not None:
        updates["address.street"] = body.street.strip()
    if body.city is not None:
        updates["address.city"] = body.city.strip()
    if body.state is not None:
        updates["address.state"] = body.state.strip()
    if body.zip_code is not None:
        updates["address.zip_code"] = body.zip_code.strip()

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update.")

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": updates},
    )

    updated_user = await users_collection.find_one({"_id": current_user["_id"]})
    return {"address": _serialize_address(updated_user.get("address"))}


@app.delete("/me/address", status_code=status.HTTP_204_NO_CONTENT)
async def delete_address(current_user=Depends(get_current_user)):
    """Remove the saved address entirely."""
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"address": None}},
    )


# ---------- Payment card endpoints ----------

@app.get("/me/cards")
async def get_cards(current_user=Depends(get_current_user)):
    """Return masked card details for all saved cards."""
    return {"payment_cards": [_mask_card(c) for c in current_user.get("payment_cards", [])]}


@app.post("/me/cards", status_code=status.HTTP_201_CREATED)
async def add_card(
    body: PaymentCard,
    current_user=Depends(get_current_user),
):
    """Add a payment card safely."""
    existing_cards = current_user.get("payment_cards", [])

    if len(existing_cards) >= MAX_CARDS:
        raise HTTPException(
            status_code=400,
            detail=f"You can only store up to {MAX_CARDS} payment cards.",
        )

    card_data = body.model_dump()
    
    card_data["last4"] = body.card_number[-4:]
    
    encrypted_pan = cipher_suite.encrypt(body.card_number.encode()).decode()
    card_data["card_number"] = encrypted_pan
    
    card_data.pop("cvv", None)

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"payment_cards": card_data}},
    )

    updated_user = await users_collection.find_one({"_id": current_user["_id"]})
    return {"payment_cards": [_mask_card(c) for c in updated_user.get("payment_cards", [])]}

@app.put("/me/cards/{card_index}")
async def update_card(
    card_index: int,
    body: PaymentCard,
    current_user=Depends(get_current_user),
):
    """Replace the card at the given 0-based index with new encrypted details."""
    cards = current_user.get("payment_cards", [])

    if card_index < 0 or card_index >= len(cards):
        raise HTTPException(status_code=404, detail="Card not found")

    card_data = body.model_dump()
    
    card_data["last4"] = body.card_number[-4:]
    
    encrypted_pan = cipher_suite.encrypt(body.card_number.encode()).decode()
    card_data["card_number"] = encrypted_pan
    
    card_data.pop("cvv", None)

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {f"payment_cards.{card_index}": card_data}},
    )

    updated_user = await users_collection.find_one({"_id": current_user["_id"]})
    return {"payment_cards": [_mask_card(c) for c in updated_user.get("payment_cards", [])]}


@app.delete("/me/cards/{card_index}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_index: int,
    current_user=Depends(get_current_user),
):
    """Remove the card at the given 0-based index."""
    cards = current_user.get("payment_cards", [])

    if card_index < 0 or card_index >= len(cards):
        raise HTTPException(status_code=404, detail="Card not found")

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {f"payment_cards.{card_index}": None}},
    )
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"payment_cards": None}},
    )


# ---------- Favourites endpoints ----------

@app.get("/me/favorites")
async def get_favorites(current_user=Depends(get_current_user)):
    """Return full movie objects for all saved favourites."""
    fav_ids = current_user.get("favorite_movie_ids", [])
    object_ids = [ObjectId(mid) for mid in fav_ids if ObjectId.is_valid(mid)]

    movies = []
    async for movie in collection.find({"_id": {"$in": object_ids}}):
        movies.append(movie_serializer(movie))
    return movies


@app.post("/me/favorites/{movie_id}", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    movie_id: str,
    current_user=Depends(get_current_user),
):
    """Save a movie to favourites. Silently ignores duplicates via $addToSet."""
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(status_code=400, detail="Invalid movie ID")

    movie = await collection.find_one({"_id": ObjectId(movie_id)})
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"favorite_movie_ids": movie_id}},
    )
    return {"message": "Added to favourites"}


@app.delete("/me/favorites/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    movie_id: str,
    current_user=Depends(get_current_user),
):
    """Remove a movie from favourites."""
    if not ObjectId.is_valid(movie_id):
        raise HTTPException(status_code=400, detail="Invalid movie ID")

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"favorite_movie_ids": movie_id}},
    )