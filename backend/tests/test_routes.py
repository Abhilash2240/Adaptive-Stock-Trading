from datetime import datetime, timezone

import pytest
import pytest_asyncio
from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from packages.api import create_app
from packages.data.provider import get_data_provider
from packages.db.engine import get_session_ctx
from packages.db.models import AgentActionDB, PortfolioStateDB, UserDB
from packages.shared import clerk_auth as clerk_module

pytestmark = pytest.mark.asyncio(loop_scope="module")


@pytest_asyncio.fixture(scope="module", loop_scope="module")
async def client():
    app = create_app()

    def _verify_clerk_token(token: str, settings):
        if token == "test-token":
            return {"sub": "test-user", "email": "test@example.com", "role": ["admin"]}
        raise HTTPException(status_code=401, detail="Invalid token")

    clerk_module.verify_clerk_token = _verify_clerk_token

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
    r = await client.get("/api/v1/health/live")
    assert r.status_code == 200


async def test_health_ready(client):
    r = await client.get("/api/v1/health/ready")
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
            "llmRationaleEnabled": True,
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


async def test_trade_history_filters_by_symbol_and_side(client, auth_headers):
    headers = auth_headers

    async with get_session_ctx() as session:
        now = datetime.now(timezone.utc)
        session.add_all(
            [
                AgentActionDB(
                    id=900001,
                    user_id="test-user",
                    symbol="MSFT",
                    side="BUY",
                    quantity=1,
                    price=100,
                    confidence=0.5,
                    executed_at=now,
                    timestamp=now,
                ),
                AgentActionDB(
                    id=900002,
                    user_id="test-user",
                    symbol="TSLA",
                    side="SELL",
                    quantity=1,
                    price=100,
                    confidence=0.5,
                    executed_at=now,
                    timestamp=now,
                ),
            ]
        )
        await session.commit()

    response = await client.get(
        "/api/v1/trades?symbol=msft&side=buy",
        headers=headers,
    )

    assert response.status_code == 200
    assert [trade["symbol"] for trade in response.json()] == ["MSFT"]
    assert [trade["side"] for trade in response.json()] == ["BUY"]


async def test_sell_rejects_oversell_and_allows_owned_quantity(client, auth_headers):
    async with get_session_ctx() as session:
        now = datetime.now(timezone.utc)
        session.add(
            AgentActionDB(
                id=900003,
                user_id="test-user",
                symbol="NVDA",
                side="BUY",
                quantity=2,
                price=100,
                confidence=0.5,
                executed_at=now,
                timestamp=now,
            )
        )
        await session.commit()

    oversell = await client.post(
        "/api/v1/trades",
        headers=auth_headers,
        json={
            "symbol": "NVDA",
            "side": "SELL",
            "quantity": 3,
            "price": 110,
            "confidence": 0.5,
        },
    )
    assert oversell.status_code == 400
    assert oversell.json()["detail"] == "Insufficient shares to sell"

    valid_sell = await client.post(
        "/api/v1/trades",
        headers=auth_headers,
        json={
            "symbol": "NVDA",
            "side": "SELL",
            "quantity": 2,
            "price": 110,
            "confidence": 0.5,
        },
    )
    assert valid_sell.status_code == 200
    assert valid_sell.json()["side"] == "SELL"


async def test_portfolio_unrealized_pnl_uses_latest_quote(client, auth_headers):
    provider = get_data_provider()
    async with get_session_ctx() as session:
        now = datetime.now(timezone.utc)
        session.add(
            AgentActionDB(
                id=920001,
                user_id="test-user",
                symbol="AAPL",
                side="BUY",
                quantity=1,
                price=195.50,
                confidence=0.5,
                executed_at=now,
                timestamp=now,
            )
        )
        await session.commit()

    provider.set_latest_price("AAPL", 205.50)
    first = await client.get("/api/v1/portfolio", headers=auth_headers)
    first_pnl = first.json()["unrealized_pnl"]

    provider.set_latest_price("AAPL", 215.50)
    second = await client.get("/api/v1/portfolio", headers=auth_headers)
    second_pnl = second.json()["unrealized_pnl"]

    assert first.status_code == 200
    assert second.status_code == 200
    assert second_pnl > first_pnl


async def test_agent_status(client, auth_headers):
    headers = auth_headers

    r = await client.get("/api/v1/agent", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "epsilon" in data
    assert "buffer_size" in data
    assert "step_count" in data


async def test_websocket_broadcast_uses_user_portfolio(client, auth_headers, monkeypatch):
    import importlib

    api_module = importlib.import_module("packages.api.app")
    monkeypatch.setattr(
        api_module,
        "verify_clerk_token",
        lambda token, settings: {"sub": "test-user", "email": "test@example.com"},
    )

    async with get_session_ctx() as session:
        portfolio = await session.get(PortfolioStateDB, 1)
        if portfolio is None:
            portfolio = PortfolioStateDB(id=1, user_id="test-user", cash=9_800.0)
            session.add(portfolio)
        else:
            portfolio.user_id = "test-user"
            portfolio.cash = 9_800.0
        session.add(
            AgentActionDB(
                id=910004,
                user_id="test-user",
                symbol="AAPL",
                side="BUY",
                quantity=2,
                price=100,
                confidence=0.5,
                executed_at=datetime.now(timezone.utc),
                timestamp=datetime.now(timezone.utc),
            )
        )
        await session.commit()

    with TestClient(create_app(), base_url="http://localhost") as test_client:
        with test_client.websocket_connect(
            "/ws/quotes",
            headers={"host": "localhost"},
        ) as websocket:
            websocket.send_json({"type": "auth", "token": "test-token"})
            assert websocket.receive_json() == {
                "type": "auth_ack",
                "status": "authenticated",
            }
            message = websocket.receive_json()

    portfolio_payload = message["portfolio"]
    assert portfolio_payload["position_flag"] == 1
    assert portfolio_payload["cash"] == 9_800.0
    assert portfolio_payload["trade_count_today"] >= 1


async def test_websocket_without_auth_message_is_closed(client):
    """A client that never authenticates should not receive quote data."""
    with TestClient(create_app(), base_url="http://localhost") as test_client:
        with test_client.websocket_connect(
            "/ws/quotes",
            headers={"host": "localhost"},
        ) as websocket:
            with pytest.raises(WebSocketDisconnect) as disconnect:
                websocket.receive_json()

    assert disconnect.value.code == 4401
