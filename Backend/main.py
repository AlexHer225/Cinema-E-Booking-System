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

if not MONGODB_URI:
    raise Exception("MONGODB_URI not found in .env file")

if not JWT_SECRET_KEY:
    raise Exception("JWT_SECRET_KEY not found in .env file")

# Connect to MongoDB
client = AsyncIOMotorClient(MONGODB_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]  # existing Movies collection
users_collection = db[USERS_COLLECTION_NAME]  # new users collection


@asynccontextmanager
async def lifespan(app: FastAPI):
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("verificationTokenHash")
    yield
    client.close()


app = FastAPI(lifespan=lifespan)

# Allow React frontend to connect
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

# Password hashing + bearer auth helpers
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
    }


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

    # Fail loudly instead of silently printing the link
    if not all([SMTP_HOST, SMTP_USER, SMTP_PASSWORD]):
        raise RuntimeError("SMTP is not configured. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD.")

    # Port 465 = implicit SSL, port 587 = STARTTLS
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


# ---------- New auth endpoints ----------
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