from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Any, Optional
import logging

from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter
from slowapi.util import get_remote_address
import jwt

from packages.shared.config import get_settings

logger = logging.getLogger(__name__)


class AuditLogger:
    """Audit logger for security events."""
    
    async def log_user_action(self, user_id: str, action: str, details: dict[str, Any]) -> None:
        logger.info("audit action=%s user=%s details=%s", action, user_id, details)

    async def log_auth_attempt(self, username: str, success: bool, ip_address: str) -> None:
        logger.info("auth username=%s success=%s ip=%s", username, success, ip_address)


class InputValidator:
    """Input validation and sanitization."""
    
    # Patterns for validation
    SYMBOL_PATTERN = re.compile(r"^[A-Z]{1,10}$")
    CHANNEL_WHITELIST = {"quotes", "trades", "ohlcv"}
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)",
        r"(--|#|/\*|\*/)",
        r"(\bOR\b\s+\d+\s*=\s*\d+)",
        r"(\bAND\b\s+\d+\s*=\s*\d+)",
        r"(;.*)",
    ]
    
    def validate_stream_request(self, payload: dict[str, Any]) -> dict[str, str]:
        """Validate and sanitize stream request parameters."""
        symbol = str(payload.get("symbol", "")).strip().upper()
        channel = str(payload.get("channel", "quotes")).strip().lower()
        
        if not symbol:
            raise HTTPException(status_code=400, detail="Symbol is required")
        if not self.SYMBOL_PATTERN.match(symbol):
            raise HTTPException(status_code=400, detail="Invalid symbol format")
        if channel not in self.CHANNEL_WHITELIST:
            raise HTTPException(status_code=400, detail="Invalid channel")
        
        return {"symbol": symbol, "channel": channel}
    
    def sanitize_string(self, value: str, max_length: int = 1000) -> str:
        """Sanitize a string input, checking for SQL injection patterns."""
        if not value:
            return ""
        
        value = value.strip()[:max_length]
        
        # Check for SQL injection patterns
        for pattern in self.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise HTTPException(status_code=400, detail="Invalid input detected")
        
        return value
    
    def validate_symbol(self, symbol: str) -> str:
        """Validate and normalize a stock symbol."""
        symbol = str(symbol).strip().upper()
        if not self.SYMBOL_PATTERN.match(symbol):
            raise HTTPException(status_code=400, detail=f"Invalid symbol: {symbol}")
        return symbol
    
    def validate_positive_number(self, value: Any, field_name: str) -> float:
        """Validate that a value is a positive number."""
        try:
            num = float(value)
            if num <= 0:
                raise ValueError()
            return num
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"{field_name} must be a positive number")


class JWTAuthenticator:
    """JWT token authentication handler."""
    
    def __init__(self):
        self._settings = None
    
    @property
    def settings(self):
        if self._settings is None:
            self._settings = get_settings()
        return self._settings
    
    def create_token(self, user_id: str, username: str, expires_in: int | None = None) -> str:
        """Create a JWT token for a user."""
        settings = self.settings
        expires_in = expires_in or settings.jwt_access_token_expire_minutes * 60
        
        payload = {
            "sub": user_id,
            "username": username,
            "iat": int(time.time()),
            "exp": int(time.time()) + expires_in,
        }
        
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    
    def verify_token(self, token: str) -> dict[str, Any]:
        """Verify and decode a JWT token."""
        settings = self.settings
        
        try:
            payload = jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=[settings.jwt_algorithm],
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    def get_user_id(self, token: str) -> str:
        """Extract user ID from a token."""
        payload = self.verify_token(token)
        return payload.get("sub", "")


# Security dependency for protected routes
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict[str, Any]:
    """
    FastAPI dependency to get the current authenticated user.
    
    Returns user info dict or raises 401 if not authenticated.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    authenticator = JWTAuthenticator()
    payload = authenticator.verify_token(credentials.credentials)
    
    return {
        "user_id": payload.get("sub"),
        "username": payload.get("username"),
    }


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> Optional[dict[str, Any]]:
    """
    FastAPI dependency to optionally get the current user.
    
    Returns user info dict if authenticated, None otherwise.
    """
    if credentials is None:
        return None
    
    try:
        authenticator = JWTAuthenticator()
        payload = authenticator.verify_token(credentials.credentials)
        return {
            "user_id": payload.get("sub"),
            "username": payload.get("username"),
        }
    except HTTPException:
        return None


# Keep permissive defaults in development to avoid blocking local work.
audit_logger = AuditLogger()
limiter = Limiter(key_func=get_remote_address, default_limits=["30/minute"])
jwt_auth = JWTAuthenticator()
validator = InputValidator()
