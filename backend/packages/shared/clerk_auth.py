from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from packages.shared.config import Settings, get_settings


@dataclass
class AuthenticatedUser:
    id: str
    sub: str
    email: str | None = None
    roles: tuple[str, ...] = ()

    @property
    def is_admin(self) -> bool:
        return "admin" in self.roles


security_scheme = HTTPBearer(auto_error=True)


@lru_cache(maxsize=4)
def _get_jwks(frontend_api: str) -> dict[str, Any]:
    url = f"https://{frontend_api}/.well-known/jwks.json"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def verify_clerk_token(token: str, settings: Settings) -> dict:
    if not settings.clerk_secret_key or not settings.clerk_frontend_api:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk is not configured",
        )

    try:
        jwks = _get_jwks(settings.clerk_frontend_api)
        unverified_header = jwt.get_unverified_header(token)

        rsa_key: dict[str, str] = {}
        for key in jwks.get("keys", []):
            if key.get("kid") == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate key",
            )

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(exc)}",
        ) from exc


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    payload = verify_clerk_token(credentials.credentials, settings)
    sub = str(payload.get("sub") or "")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    raw_role = payload.get("role")
    roles = (str(raw_role),) if isinstance(raw_role, str) and raw_role else ()

    return AuthenticatedUser(
        id=sub,
        sub=sub,
        email=str(payload.get("email") or ""),
        roles=roles,
    )


async def require_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required",
        )
    return current_user