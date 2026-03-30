from __future__ import annotations

from functools import lru_cache
from typing import Any

import requests
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from packages.shared.config import Settings, get_settings

ALGORITHMS = ["RS256"]
security = HTTPBearer()


class AuthenticatedUser(BaseModel):
    id: str
    email: str = ""
    sub: str = ""
    name: str = ""
    picture: str = ""


def _auth0_enabled(settings: Settings) -> bool:
    return bool(settings.auth0_domain and settings.auth0_audience)


@lru_cache(maxsize=4)
def _get_jwks(domain: str) -> dict[str, Any]:
    url = f"https://{domain}/.well-known/jwks.json"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def verify_auth0_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    resolved = settings or get_settings()
    if not _auth0_enabled(resolved):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth0 is not configured",
        )

    try:
        jwks = _get_jwks(resolved.auth0_domain)
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
            algorithms=ALGORITHMS,
            audience=resolved.auth0_audience,
            issuer=f"https://{resolved.auth0_domain}/",
        )
        return payload
    except HTTPException:
        raise
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(exc)}",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    token = credentials.credentials

    # Auth0-first auth path.
    if _auth0_enabled(settings):
        payload = verify_auth0_token(token, settings)
        sub = str(payload.get("sub") or "")
        return AuthenticatedUser(
            id=sub,
            sub=sub,
            email=str(payload.get("email") or ""),
            name=str(payload.get("name") or ""),
            picture=str(payload.get("picture") or ""),
        )

    # Dev/test fallback for legacy local JWT flow when Auth0 is not configured.
    from packages.shared.security import get_current_user as legacy_get_current_user

    legacy_user = await legacy_get_current_user(credentials=credentials, settings=settings)
    return AuthenticatedUser(
        id=str(legacy_user.id),
        sub=str(legacy_user.id),
        email=legacy_user.username,
        name=legacy_user.username,
        picture="",
    )
