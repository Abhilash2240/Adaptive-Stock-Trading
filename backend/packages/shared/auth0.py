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


security_scheme = HTTPBearer(auto_error=True)


@lru_cache(maxsize=4)
def _get_jwks(domain: str) -> dict[str, Any]:
    url = f"https://{domain}/.well-known/jwks.json"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def verify_auth0_token(token: str, settings: Settings) -> dict:
    if not settings.auth0_domain or not settings.auth0_audience:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth0 is not configured",
        )

    try:
        jwks = _get_jwks(settings.auth0_domain)
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
            audience=settings.auth0_audience,
            issuer=f"https://{settings.auth0_domain}/",
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
    payload = verify_auth0_token(credentials.credentials, settings)
    sub = str(payload.get("sub") or "")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return AuthenticatedUser(
        id=sub,
        sub=sub,
        email=str(payload.get("email") or ""),
    )
