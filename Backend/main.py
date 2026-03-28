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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("verificationTokenHash")
    await users_collection.create_index("passwordResetTokenHash")
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


# ---------- Auth endpoints ----------

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