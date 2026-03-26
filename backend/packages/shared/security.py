"""
Security middleware and authentication for FastAPI backend.
Implements JWT authentication, rate limiting, input validation, and security headers.
"""

import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Annotated, Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from packages.shared.config import Settings, get_settings

# Security configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
BCRYPT_ROUNDS = 12

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

# JWT Secret key management
def get_jwt_secret(settings: Settings) -> str:
    """Get JWT secret from environment or generate a secure one."""
    if hasattr(settings, 'jwt_secret_key') and settings.jwt_secret_key:
        return settings.jwt_secret_key
    # Generate a secure secret if not provided (not recommended for production)
    print("⚠️  WARNING: JWT_SECRET_KEY not set in environment. Using generated secret.")
    print("⚠️  This is NOT secure for production use!")
    return secrets.token_urlsafe(64)

# Models for authentication
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=30, pattern="^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=8)
    
class UserLogin(BaseModel):
    username: str = Field(..., min_length=1, max_length=30)
    password: str = Field(..., min_length=1)

class User(BaseModel):
    id: str
    username: str
    created_at: datetime
    is_active: bool = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_EXPIRE_MINUTES * 60

class TokenData(BaseModel):
    username: str | None = None
    user_id: str | None = None

# Password utilities
class PasswordManager:
    """Secure password hashing and verification."""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password with bcrypt."""
        password_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    
    @staticmethod
    def validate_password_strength(password: str) -> bool:
        """Validate password meets strength requirements."""
        if len(password) < 8:
            return False
        
        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        
        return has_upper and has_lower and has_digit

# JWT utilities
class JWTManager:
    """JWT token creation and validation."""
    
    def __init__(self, settings: Settings):
        self.secret_key = get_jwt_secret(settings)
        self.algorithm = settings.jwt_algorithm
        self.expire_minutes = settings.jwt_access_token_expire_minutes
    
    def create_access_token(self, data: dict) -> str:
        """Create a new JWT access token."""
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(minutes=self.expire_minutes)
        to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> TokenData:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            username: str = payload.get("sub")
            user_id: str = payload.get("user_id")
            
            if username is None or user_id is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload"
                )
            
            return TokenData(username=username, user_id=user_id)
        
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

# Database-backed user store (PostgreSQL via asyncpg)
def _db_user_to_model(db_user) -> User:
    """Convert a UserDB row to the Pydantic User model."""
    return User(
        id=db_user.id,
        username=db_user.username,
        created_at=db_user.created_at,
        is_active=db_user.is_active,
    )


class UserStore:
    """Async PostgreSQL-backed user store."""

    async def create_user(self, username: str, hashed_password: str) -> User:
        """Create a new user in the database."""
        from packages.db.engine import get_session_ctx
        from packages.db.repositories import UserRepository

        async with get_session_ctx() as session:
            repo = UserRepository(session)
            existing = await repo.get_by_username(username)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username already exists",
                )
            db_user = await repo.create(username, hashed_password)
            return _db_user_to_model(db_user)

    async def get_user_by_username(self, username: str) -> User | None:
        """Get user by username from the database."""
        from packages.db.engine import get_session_ctx
        from packages.db.repositories import UserRepository

        async with get_session_ctx() as session:
            repo = UserRepository(session)
            db_user = await repo.get_by_username(username)
            return _db_user_to_model(db_user) if db_user else None

    async def get_user_by_id(self, user_id: str) -> User | None:
        """Get user by ID from the database."""
        from packages.db.engine import get_session_ctx
        from packages.db.repositories import UserRepository

        async with get_session_ctx() as session:
            repo = UserRepository(session)
            db_user = await repo.get_by_id(user_id)
            return _db_user_to_model(db_user) if db_user else None

    async def get_user_with_hash(self, username: str) -> dict | None:
        """Get user data including password hash (for authentication)."""
        from packages.db.engine import get_session_ctx
        from packages.db.repositories import UserRepository

        async with get_session_ctx() as session:
            repo = UserRepository(session)
            db_user = await repo.get_by_username(username)
            if not db_user:
                return None
            return {
                "id": db_user.id,
                "username": db_user.username,
                "password_hash": db_user.password_hash,
                "created_at": db_user.created_at,
                "is_active": db_user.is_active,
            }

    async def authenticate_user(self, username: str, password: str) -> User | None:
        """Authenticate user with username and password."""
        user_data = await self.get_user_with_hash(username)
        if not user_data:
            return None
        if not password_manager.verify_password(password, user_data["password_hash"]):
            return None
        return User(
            id=user_data["id"],
            username=user_data["username"],
            created_at=user_data["created_at"],
            is_active=user_data["is_active"],
        )

# Global instances
user_store = UserStore()
password_manager = PasswordManager()

# Security dependencies
security_scheme = HTTPBearer()

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)],
    settings: Annotated[Settings, Depends(get_settings)]
) -> User:
    """Get current authenticated user from JWT token."""
    jwt_manager = JWTManager(settings)
    
    try:
        token_data = jwt_manager.verify_token(credentials.credentials)
        user = await user_store.get_user_by_id(token_data.user_id)
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user"
            )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# Rate limiting decorators
def rate_limit(limit: str):
    """Rate limiting decorator for endpoints."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            try:
                return await limiter.limit(limit)(func)(request, *args, **kwargs)
            except RateLimitExceeded:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded"
                )
        return wrapper
    return decorator

# Input validation utilities
class InputValidator:
    """Input validation utilities."""
    
    @staticmethod
    def validate_symbol(symbol: str) -> bool:
        """Validate stock symbol format."""
        if not symbol or len(symbol) > 10:
            return False
        return symbol.isalpha() and symbol.isupper()
    
    @staticmethod
    def validate_amount(amount: float) -> bool:
        """Validate monetary amounts."""
        return isinstance(amount, (int, float)) and amount >= 0 and amount <= 1000000
    
    @staticmethod
    def sanitize_string(text: str, max_length: int = 1000) -> str:
        """Sanitize string input."""
        if not isinstance(text, str):
            return ""
        
        # Remove null bytes and control characters
        sanitized = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t\r')
        
        # Truncate to max length
        return sanitized[:max_length]
    
    @staticmethod
    def validate_stream_request(data: dict) -> dict:
        """Validate stream request data."""
        validated = {}
        
        # Validate symbol
        symbol = data.get("symbol", "").strip().upper()
        if not symbol or not re.match(r'^[A-Z]{1,10}$', symbol):
            raise ValueError("Invalid symbol format")
        validated["symbol"] = symbol
        
        # Validate channel  
        channel = data.get("channel", "").strip()
        if not channel or channel not in ["quotes", "trades", "aggs"]:
            raise ValueError("Invalid channel")
        validated["channel"] = channel
        
        return validated

# Security middleware
def add_security_headers(response):
    """Add security headers to response."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' ws: wss:;"
    )
    return response

# Audit logging — persists to PostgreSQL + prints to stdout
class AuditLogger:
    """Audit logger that writes to the database and to stdout."""

    @staticmethod
    async def log_auth_attempt(username: str, success: bool, ip: str = "unknown"):
        """Log authentication attempts."""
        timestamp = datetime.now(timezone.utc).isoformat()
        status_label = "SUCCESS" if success else "FAILED"
        print(f"[AUDIT] {timestamp} - AUTH {status_label} - User: {username} - IP: {ip}")
        try:
            from packages.db.engine import get_session_ctx
            from packages.db.repositories import AuditLogRepository
            async with get_session_ctx() as session:
                repo = AuditLogRepository(session)
                await repo.log(
                    event_type="AUTH",
                    username=username,
                    success=success,
                    ip_address=ip,
                    action="login" if success else "login_failed",
                )
        except Exception as exc:
            print(f"[AUDIT] DB write failed: {exc}")

    @staticmethod
    async def log_api_access(user_id: str, endpoint: str, ip: str = "unknown"):
        """Log API access."""
        timestamp = datetime.now(timezone.utc).isoformat()
        print(f"[AUDIT] {timestamp} - API ACCESS - User: {user_id} - Endpoint: {endpoint} - IP: {ip}")
        try:
            from packages.db.engine import get_session_ctx
            from packages.db.repositories import AuditLogRepository
            async with get_session_ctx() as session:
                repo = AuditLogRepository(session)
                await repo.log(
                    event_type="API_ACCESS",
                    user_id=user_id,
                    action=endpoint,
                    ip_address=ip,
                )
        except Exception as exc:
            print(f"[AUDIT] DB write failed: {exc}")

    @staticmethod
    async def log_user_action(user_id: str | int, action: str, details: dict | None = None):
        """Log a user action."""
        timestamp = datetime.now(timezone.utc).isoformat()
        print(f"[AUDIT] {timestamp} - ACTION - User: {user_id} - Action: {action}")
        try:
            from packages.db.engine import get_session_ctx
            from packages.db.repositories import AuditLogRepository
            async with get_session_ctx() as session:
                repo = AuditLogRepository(session)
                await repo.log(
                    event_type="USER_ACTION",
                    user_id=str(user_id),
                    action=action,
                    details=details,
                )
        except Exception as exc:
            print(f"[AUDIT] DB write failed: {exc}")

audit_logger = AuditLogger()

# Utility functions for authentication
async def authenticate_user(username: str, password: str) -> User | None:
    """Authenticate user with username and password."""
    return await user_store.authenticate_user(username, password)

async def create_user_account(username: str, password: str) -> User:
    """Create a new user account."""
    if not password_manager.validate_password_strength(password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet strength requirements"
        )
    
    hashed_password = password_manager.hash_password(password)
    return await user_store.create_user(username, hashed_password)