"""
Authentication routes for user registration, login, and token management.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from packages.shared.config import Settings, get_settings
from packages.shared.security import (
    AuditLogger,
    JWTManager,
    Token,
    User,
    UserCreate,
    UserLogin,
    authenticate_user,
    audit_logger,
    create_user_account,
    get_current_user,
    limiter,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
security_scheme = HTTPBearer()

@router.post("/register", response_model=dict, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/15minutes")  # 5 registration attempts per 15 minutes
async def register(
    request: Request,
    user_data: UserCreate,
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict:
    """Register a new user account."""
    try:
        # Create user account
        user = create_user_account(user_data.username, user_data.password)
        
        # Log successful registration
        client_ip = getattr(request.client, 'host', 'unknown') if request.client else 'unknown'
        audit_logger.log_auth_attempt(user_data.username, True, client_ip)
        
        # Create JWT token
        jwt_manager = JWTManager(settings)
        access_token = jwt_manager.create_access_token(
            data={"sub": user.username, "user_id": user.id}
        )
        
        return {
            "message": "User registered successfully",
            "user": {
                "id": user.id,
                "username": user.username,
                "created_at": user.created_at.isoformat(),
            },
            "access_token": access_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        # Log failed registration attempt
        client_ip = getattr(request.client, 'host', 'unknown') if request.client else 'unknown'
        audit_logger.log_auth_attempt(user_data.username, False, client_ip)
        raise
    except Exception as e:
        # Log failed registration attempt
        client_ip = getattr(request.client, 'host', 'unknown') if request.client else 'unknown'
        audit_logger.log_auth_attempt(user_data.username, False, client_ip)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=Token)
@limiter.limit("5/15minutes")  # 5 login attempts per 15 minutes
async def login(
    request: Request,
    user_credentials: UserLogin,
    settings: Annotated[Settings, Depends(get_settings)]
) -> Token:
    """Authenticate user and return access token."""
    client_ip = getattr(request.client, 'host', 'unknown') if request.client else 'unknown'
    
    try:
        # Authenticate user
        user = authenticate_user(user_credentials.username, user_credentials.password)
        
        if not user:
            audit_logger.log_auth_attempt(user_credentials.username, False, client_ip)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password"
            )
        
        # Log successful login
        audit_logger.log_auth_attempt(user_credentials.username, True, client_ip)
        
        # Create JWT token
        jwt_manager = JWTManager(settings)
        access_token = jwt_manager.create_access_token(
            data={"sub": user.username, "user_id": user.id}
        )
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=1440 * 60  # 24 hours in seconds
        )
        
    except HTTPException:
        raise
    except Exception as e:
        audit_logger.log_auth_attempt(user_credentials.username, False, client_ip)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@router.get("/me", response_model=User)
async def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """Get current authenticated user information."""
    return current_user

@router.post("/verify")
async def verify_token(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)],
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict:
    """Verify if the provided token is valid."""
    try:
        jwt_manager = JWTManager(settings)
        token_data = jwt_manager.verify_token(credentials.credentials)
        
        return {
            "valid": True,
            "username": token_data.username,
            "user_id": token_data.user_id
        }
    except HTTPException as e:
        return {
            "valid": False,
            "error": e.detail
        }

@router.post("/refresh")
async def refresh_token(
    current_user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)]
) -> Token:
    """Refresh the user's access token."""
    jwt_manager = JWTManager(settings)
    access_token = jwt_manager.create_access_token(
        data={"sub": current_user.username, "user_id": current_user.id}
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=1440 * 60  # 24 hours in seconds
    )