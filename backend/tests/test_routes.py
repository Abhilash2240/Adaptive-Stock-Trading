import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from packages.api import create_app

pytestmark = pytest.mark.asyncio(loop_scope="module")


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def client():
    app = create_app()
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://localhost",
    ) as ac:
        yield ac


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def auth_user(client):
    username = f"test_{uuid.uuid4().hex[:8]}"
    password = "TestPass123!"
    r = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert r.status_code in (200, 201), r.text
    payload = r.json()
    token = payload["access_token"]
    user_id = payload["user"]["id"]
    return {
        "username": username,
        "password": password,
        "token": token,
        "user_id": user_id,
        "headers": {"Authorization": f"Bearer {token}"},
    }


async def test_health_live(client):
    r = await client.get("/health/live")
    assert r.status_code == 200


async def test_health_ready(client):
    r = await client.get("/health/ready")
    assert r.status_code == 200


async def test_register_and_login(client):
    username = f"test_{uuid.uuid4().hex[:8]}"
    password = "TestPass123!"

    # Register
    r = await client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": password},
    )
    assert r.status_code in (200, 201)
    token = r.json().get("access_token")
    assert token

    # Login
    r = await client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert r.status_code == 200
    assert r.json().get("access_token")

    # Me endpoint
    r = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert r.json()["username"] == username


async def test_settings_crud(client, auth_user):
    user_id = auth_user["user_id"]
    headers = auth_user["headers"]

    # GET settings (auto-creates row)
    r = await client.get(f"/settings?userId={user_id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["tradingMode"] == "paper"

    # POST settings update
    r = await client.post(
        "/settings",
        headers=headers,
        json={
            "userId": user_id,
            "tradingMode": "live",
            "geminiEnabled": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["tradingMode"] == "live"


async def test_portfolio_and_trades(client, auth_user):
    headers = auth_user["headers"]

    # GET portfolio (empty)
    r = await client.get("/portfolio", headers=headers)
    assert r.status_code == 200
    assert r.json()["cash"] == 10000.0

    # POST trade
    r = await client.post(
        "/trades",
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
    r = await client.get("/portfolio", headers=headers)
    assert r.status_code == 200
    assert r.json()["cash"] < 10000.0


async def test_agent_status(client, auth_user):
    headers = auth_user["headers"]

    r = await client.get("/agent/status", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "epsilon" in data
    assert "buffer_size" in data
    assert "step_count" in data
