import base64

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt

from packages.shared import clerk_auth
from packages.shared.config import Settings


def _base64url(value: int) -> str:
    byte_length = (value.bit_length() + 7) // 8
    encoded = value.to_bytes(byte_length, "big")
    return base64.urlsafe_b64encode(encoded).rstrip(b"=").decode()


@pytest.fixture
def clerk_token_and_settings():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_numbers = private_key.public_key().public_numbers()
    key_id = "clerk-test-key"
    jwk = {
        "kty": "RSA",
        "kid": key_id,
        "use": "sig",
        "n": _base64url(public_numbers.n),
        "e": _base64url(public_numbers.e),
    }
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    token = jwt.encode(
        {
            "sub": "user_clerk_123",
            "role": ["admin"],
            "email": "user@example.com",
            "iss": "https://example.clerk.accounts.dev",
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": key_id},
    )
    return token, jwk, private_pem, Settings(clerk_domain="example.clerk.accounts.dev")


def test_clerk_token_uses_clerk_issuer_and_jwks(monkeypatch, clerk_token_and_settings):
    token, jwk, _, settings = clerk_token_and_settings
    monkeypatch.setattr(clerk_auth, "_get_jwks", lambda domain: {"keys": [jwk]})

    payload = clerk_auth.verify_clerk_token(token, settings)

    assert payload["sub"] == "user_clerk_123"
    assert payload["role"] == ["admin"]


@pytest.mark.asyncio
async def test_clerk_role_claim_maps_to_admin(monkeypatch, clerk_token_and_settings):
    token, jwk, _, settings = clerk_token_and_settings
    monkeypatch.setattr(clerk_auth, "_get_jwks", lambda domain: {"keys": [jwk]})

    user = await clerk_auth.get_current_user(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
        settings,
    )

    assert user.id == "user_clerk_123"
    assert user.roles == ("admin",)
    assert user.is_admin


def test_clerk_token_rejects_wrong_issuer(monkeypatch, clerk_token_and_settings):
    _, jwk, private_pem, settings = clerk_token_and_settings
    monkeypatch.setattr(clerk_auth, "_get_jwks", lambda domain: {"keys": [jwk]})
    wrong_issuer_token = jwt.encode(
        {"sub": "user_clerk_123", "iss": "https://malicious.example.com"},
        private_pem,
        algorithm="RS256",
        headers={"kid": jwk["kid"]},
    )

    with pytest.raises(HTTPException) as error:
        clerk_auth.verify_clerk_token(wrong_issuer_token, settings)

    assert error.value.status_code == 401