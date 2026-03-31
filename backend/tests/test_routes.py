import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import packages.api.app as api_app
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


async def test_health_live(client):
    r = await client.get("/health/live")
    assert r.status_code == 200


async def test_health_ready(client):
    r = await client.get("/health/ready")
    assert r.status_code == 200


async def test_portfolio_open_access(client):
    r = await client.get("/api/v1/portfolio")
    assert r.status_code == 200


async def test_settings_crud(client):
    user_id = "anonymous-user"

    # GET settings (auto-creates row)
    r = await client.get(f"/api/v1/settings?userId={user_id}")
    assert r.status_code == 200
    assert r.json()["tradingMode"] in ("paper", "live")

    # POST settings update
    r = await client.post(
        "/api/v1/settings",
        json={
            "userId": user_id,
            "tradingMode": "live",
            "geminiEnabled": True,
        },
    )
    assert r.status_code == 200
    assert r.json()["tradingMode"] == "live"


async def test_portfolio_and_trades(client):
    # GET portfolio (empty)
    r = await client.get("/api/v1/portfolio")
    assert r.status_code == 200
    initial_cash = float(r.json()["cash"])

    # POST trade
    r = await client.post(
        "/api/v1/trades",
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
    r = await client.get("/api/v1/portfolio")
    assert r.status_code == 200
    assert float(r.json()["cash"]) < initial_cash


async def test_agent_status(client):
    r = await client.get("/api/v1/agent")
    assert r.status_code == 200
    data = r.json()
    assert "epsilon" in data
    assert "buffer_size" in data
    assert "step_count" in data


async def test_chat_requires_gemini_enabled(client):
    user_id = "anonymous-user"
    await client.post(
        "/api/v1/settings",
        json={"userId": user_id, "geminiEnabled": False},
    )

    r = await client.post(
        "/api/v1/chat",
        json={"userId": user_id, "message": "What is RSI?"},
    )
    assert r.status_code == 400


async def test_chat_success_with_mocked_gemini(client, monkeypatch):
    class DummyGemini:
        model = "dummy-model"
        is_configured = True

        async def generate_reply(self, question: str, symbol: str | None = None) -> str:
            return f"Mocked Gemini answer for: {question}"

    monkeypatch.setattr(api_app, "get_gemini_service", lambda: DummyGemini())

    user_id = "anonymous-user"
    await client.post(
        "/api/v1/settings",
        json={"userId": user_id, "geminiEnabled": True},
    )

    r = await client.post(
        "/api/v1/chat",
        json={"userId": user_id, "message": "Explain stop loss", "symbol": "AAPL"},
    )
    assert r.status_code == 200
    payload = r.json()
    assert "Mocked Gemini answer" in payload["answer"]
    assert payload["model"] == "dummy-model"
