import pytest
import pytest_asyncio
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from packages.api import create_app
from packages.db.engine import get_session_ctx
from packages.db.models import UserDB
from packages.shared import auth0 as auth0_module

pytestmark = pytest.mark.asyncio(loop_scope="module")


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def client():
    app = create_app()

    def _verify_auth0_token(token: str, settings):
        if token == "test-token":
            return {"sub": "test-user", "email": "test@example.com"}
        raise HTTPException(status_code=401, detail="Invalid token")

    auth0_module.verify_auth0_token = _verify_auth0_token

    async with get_session_ctx() as session:
        existing = await session.get(UserDB, "test-user")
        if existing is None:
            session.add(
                UserDB(
                    id="test-user",
                    username="test_user",
                    password_hash="not-used",
                    is_active=True,
                )
            )
            await session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://localhost",
    ) as ac:
        yield ac


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def auth_headers():
    return {"Authorization": "Bearer test-token"}


async def test_health_live(client):
    r = await client.get("/health/live")
    assert r.status_code == 200


async def test_health_ready(client):
    r = await client.get("/health/ready")
    assert r.status_code == 200


async def test_protected_requires_auth(client):
    r = await client.get("/api/v1/portfolio")
    assert r.status_code == 403


async def test_settings_crud(client, auth_headers):
    user_id = "test-user"
    headers = auth_headers

    # GET settings (auto-creates row)
    r = await client.get(f"/api/v1/settings?userId={user_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["tradingMode"] in ("paper", "live")

    # POST settings update
    r = await client.post(
        "/api/v1/settings",
        headers=headers,
        json={
            "userId": user_id,
            "tradingMode": "live",
            "geminiEnabled": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["tradingMode"] == "live"


async def test_portfolio_and_trades(client, auth_headers):
    headers = auth_headers

    # GET portfolio (empty)
    r = await client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    initial_cash = float(r.json()["cash"])

    # POST trade
    r = await client.post(
        "/api/v1/trades",
        headers=headers,
        json={
            "symbol": "AAPL",
            "side": "BUY",
            "quantity": 1,
            "price": 195.50,
            "confidence": 0.82,
        },
    )
    assert r.status_code == 200
    assert r.json()["symbol"] == "AAPL"

    # GET portfolio reflects trade
    r = await client.get("/api/v1/portfolio", headers=headers)
    assert r.status_code == 200
    assert float(r.json()["cash"]) < initial_cash


async def test_agent_status(client, auth_headers):
    headers = auth_headers

    r = await client.get("/api/v1/agent", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "epsilon" in data
    assert "buffer_size" in data
    assert "step_count" in data
