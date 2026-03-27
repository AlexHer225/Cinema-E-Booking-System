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

VERIFICATION_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("VERIFICATION_TOKEN_EXPIRE_MINUTES", "60")
)

MAX_PAYMENT_METHODS = 3

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
    # We return hashed values — the raw card/payment data never comes back
    payment_methods: list[str] = []
    saved_movie_ids: list[str] = []


class SignupResponse(BaseModel):
    message: str
    user: UserResponse


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Payment method bodies
class PaymentMethodAdd(BaseModel):
    """
    Send the raw payment identifier (e.g. a card number or token string).
    It is SHA-256 hashed before storage; the plain value is never persisted.
    """
    payment_value: str = Field(min_length=1, max_length=512)


class PaymentMethodUpdate(BaseModel):
    """Replace one hashed payment method with a new one by index (0-2)."""
    index: int = Field(ge=0, lt=MAX_PAYMENT_METHODS)
    new_payment_value: str = Field(min_length=1, max_length=512)


# Movie ID bodies
class MovieIdBody(BaseModel):
    movie_id: str  # must be a valid MongoDB ObjectId string


# ---------- Serializers ----------

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
        # These return the hashed values (safe to expose — irreversible)
        "payment_methods": user.get("payment_methods", []),
        "saved_movie_ids": user.get("saved_movie_ids", []),
    }


# ---------- Auth utility functions ----------

def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def hash_payment_value(raw: str) -> str:
    """One-way SHA-256 hash of the raw payment identifier."""
    return hashlib.sha256(raw.strip().encode("utf-8")).hexdigest()


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

    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD]):
        raise RuntimeError("SMTP is not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD.")

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


# ---------- Existing movie endpoints ----------

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
        # New fields — initialised as empty arrays
        "payment_methods": [],   # max 3 hashed values
        "saved_movie_ids": [],   # unlimited ObjectId strings
    }

    try:
        result = await users_collection.insert_one(new_user)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=400,
            detail="Email or username already exists",
        )

    background_tasks.add_task(
        send_verification_email,
        email,
        new_user["name"],
        raw_token,
    )

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
            "$set": {
                "status": "Active",
                "verifiedAt": int(time.time()),
            },
            "$unset": {
                "verificationTokenHash": "",
                "verificationTokenExpiresAt": "",
            },
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


# =============================================================================
# Payment method endpoints  (all require a valid Bearer token)
# =============================================================================
#
# Stored document shape per user:
#   payment_methods: [ "<sha256hex>", "<sha256hex>", "<sha256hex>" ]  (max 3)
#
# The raw card / payment token is NEVER persisted.
# The SHA-256 hash is safe to return — it cannot be reversed.
#
# Endpoints:
#   GET    /me/payment-methods          → list hashed payment methods
#   POST   /me/payment-methods          → add a new one (fails if already at 3)
#   PUT    /me/payment-methods/{index}  → replace entry at index 0/1/2
#   DELETE /me/payment-methods/{index}  → remove entry at index 0/1/2
# =============================================================================

@app.get("/me/payment-methods")
async def list_payment_methods(current_user=Depends(get_current_user)):
    """Return the list of hashed payment methods for the authenticated user."""
    return {"payment_methods": current_user.get("payment_methods", [])}


@app.post("/me/payment-methods", status_code=status.HTTP_201_CREATED)
async def add_payment_method(
    body: PaymentMethodAdd,
    current_user=Depends(get_current_user),
):
    """
    Hash and append a payment method.
    Raises 400 if the user already has MAX_PAYMENT_METHODS (3) saved.
    Raises 409 if the exact same hashed value already exists.
    """
    current_methods: list = current_user.get("payment_methods", [])

    if len(current_methods) >= MAX_PAYMENT_METHODS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {MAX_PAYMENT_METHODS} payment methods allowed. "
                   "Delete one before adding another.",
        )

    new_hash = hash_payment_value(body.payment_value)

    if new_hash in current_methods:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This payment method is already saved.",
        )

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"payment_methods": new_hash}},
    )

    updated = await users_collection.find_one({"_id": current_user["_id"]})
    return {"payment_methods": updated.get("payment_methods", [])}


@app.put("/me/payment-methods/{index}")
async def update_payment_method(
    index: int,
    body: PaymentMethodAdd,
    current_user=Depends(get_current_user),
):
    """
    Replace the payment method at the given index (0-based).
    Raises 404 if index does not exist in the array.
    Raises 409 if the new value hashes to an already-saved entry.
    """
    current_methods: list = current_user.get("payment_methods", [])

    if index < 0 or index >= len(current_methods):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No payment method at index {index}.",
        )

    new_hash = hash_payment_value(body.payment_value)

    if new_hash in current_methods:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This payment method is already saved.",
        )

    # MongoDB positional update by array index using dot-notation key
    field_key = f"payment_methods.{index}"
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {field_key: new_hash}},
    )

    updated = await users_collection.find_one({"_id": current_user["_id"]})
    return {"payment_methods": updated.get("payment_methods", [])}


@app.delete("/me/payment-methods/{index}", status_code=status.HTTP_200_OK)
async def delete_payment_method(
    index: int,
    current_user=Depends(get_current_user),
):
    """
    Remove the payment method at the given index (0-based).

    MongoDB has no native "remove by index" operation, so we use a
    two-step approach: set the slot to a sentinel, then pull the sentinel.
    This is atomic enough for a single-user operation.
    """
    current_methods: list = current_user.get("payment_methods", [])

    if index < 0 or index >= len(current_methods):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No payment method at index {index}.",
        )

    SENTINEL = "__DELETE__"
    field_key = f"payment_methods.{index}"

    # Step 1: mark the slot
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {field_key: SENTINEL}},
    )
    # Step 2: pull the sentinel out
    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"payment_methods": SENTINEL}},
    )

    updated = await users_collection.find_one({"_id": current_user["_id"]})
    return {"payment_methods": updated.get("payment_methods", [])}


# =============================================================================
# Saved movie endpoints  (all require a valid Bearer token)
# =============================================================================
#
# Stored document shape per user:
#   saved_movie_ids: [ "<objectid_str>", "<objectid_str>", ... ]  (unlimited)
#
# Endpoints:
#   GET    /me/saved-movies             → list saved movie IDs
#   POST   /me/saved-movies             → add a movie ID
#   DELETE /me/saved-movies/{movie_id}  → remove a movie ID
# =============================================================================

@app.get("/me/saved-movies")
async def list_saved_movies(current_user=Depends(get_current_user)):
    """Return the list of saved movie ObjectId strings for the authenticated user."""
    return {"saved_movie_ids": current_user.get("saved_movie_ids", [])}


@app.post("/me/saved-movies", status_code=status.HTTP_201_CREATED)
async def add_saved_movie(
    body: MovieIdBody,
    current_user=Depends(get_current_user),
):
    """
    Save a movie by its ObjectId string.
    Raises 400 if the ID is not a valid ObjectId.
    Raises 404 if the movie does not exist in the Movies collection.
    Raises 409 if the movie is already saved.
    """
    if not ObjectId.is_valid(body.movie_id):
        raise HTTPException(status_code=400, detail="Invalid movie ID format.")

    movie = await collection.find_one({"_id": ObjectId(body.movie_id)})
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found.")

    saved: list = current_user.get("saved_movie_ids", [])
    if body.movie_id in saved:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Movie is already saved.",
        )

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$push": {"saved_movie_ids": body.movie_id}},
    )

    updated = await users_collection.find_one({"_id": current_user["_id"]})
    return {"saved_movie_ids": updated.get("saved_movie_ids", [])}


@app.delete("/me/saved-movies/{movie_id}", status_code=status.HTTP_200_OK)
async def remove_saved_movie(
    movie_id: str,
    current_user=Depends(get_current_user),
):
    """
    Remove a movie from the saved list by its ObjectId string.
    Raises 404 if the movie ID is not currently in the saved list.
    """
    saved: list = current_user.get("saved_movie_ids", [])

    if movie_id not in saved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie ID not found in saved list.",
        )

    await users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$pull": {"saved_movie_ids": movie_id}},
    )

    updated = await users_collection.find_one({"_id": current_user["_id"]})
    return {"saved_movie_ids": updated.get("saved_movie_ids", [])}