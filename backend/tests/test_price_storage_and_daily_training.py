import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from fastapi import HTTPException

from packages.api import create_app
from packages.agent.historical import DatabaseDataLoader
from packages.agent.service import AgentService, _DEFAULT_USER_ID
from packages.data.adapters.mock import MockDataProvider
from packages.data.provider import set_data_provider
from packages.data.storage import QuoteStorageService, reset_storage_service, get_storage_service
from packages.db.engine import get_session_ctx
from packages.db.models import QuoteDB, OHLCVDB, UserDB
from packages.db.repositories import QuoteRepository, OHLCVRepository, TrainingRepository
from packages.shared import clerk_auth as clerk_module

pytestmark = pytest.mark.asyncio(loop_scope="module")


@pytest_asyncio.fixture(scope="module", loop_scope="module", autouse=True)
async def setup_test_provider():
    provider = MockDataProvider(symbols=["AAPL", "TSLA", "MSFT"])
    set_data_provider(provider)
    reset_storage_service()
    yield
    reset_storage_service()


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
                    username="test_user_db_train",
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


async def test_quote_and_ohlcv_repositories():
    """Verify storing and querying quotes and OHLCV in the database."""
    now = datetime.now(timezone.utc)
    sym = "TESTSYM"

    async with get_session_ctx() as session:
        q_repo = QuoteRepository(session)
        o_repo = OHLCVRepository(session)

        # Insert quotes
        await q_repo.insert(sym, 150.0, 1000, now - timedelta(minutes=2))
        await q_repo.insert(sym, 152.5, 1200, now - timedelta(minutes=1))
        await q_repo.insert(sym, 151.0, 1100, now)

        # Insert OHLCV candle
        await o_repo.insert(
            symbol=sym,
            open=149.0,
            high=153.0,
            low=148.5,
            close=151.0,
            volume=50000,
            timestamp=now,
        )

        # Verify counts
        assert await q_repo.count(sym) >= 3
        assert await o_repo.count(sym) >= 1

        # Verify historical ascending order
        q_hist = await q_repo.get_history(sym, limit=10)
        assert len(q_hist) >= 3
        assert q_hist[0].timestamp <= q_hist[1].timestamp <= q_hist[2].timestamp


async def test_quote_storage_service():
    """Verify QuoteStorageService buffering, direct write, and sync."""
    provider = MockDataProvider(symbols=["AAPL"])
    storage = QuoteStorageService(batch_size=5, flush_interval_seconds=1.0, provider=provider)

    # Record quotes into buffer
    for i in range(4):
        await storage.record_quote({
            "symbol": "AAPL",
            "price": 170.0 + i,
            "volume": 2000,
            "timestamp": datetime.now(timezone.utc),
        })

    # Flush buffer to database
    written = await storage.flush()
    assert written == 4

    # Sync daily prices
    synced = await storage.sync_daily_prices("AAPL", days=15)
    assert synced >= 15

    # Retrieve stored prices
    stored = await storage.get_stored_prices("AAPL", limit=50)
    assert len(stored) >= 15
    assert all("price" in p and "close" in p for p in stored)


async def test_database_data_loader_and_agent_training():
    """Verify DatabaseDataLoader loads stored prices and AgentService trains on them."""
    import time as _time
    now = datetime.now(timezone.utc)
    # Use a unique symbol per test run to avoid cross-run contamination
    sym = f"DBTRAIN_{int(_time.time())}"

    # Seed 35 OHLCV records in the database
    candles = []
    base_price = 100.0
    for i in range(35):
        price = base_price + (i * 0.5)
        candles.append({
            "symbol": sym,
            "open": price - 0.2,
            "high": price + 0.8,
            "low": price - 0.5,
            "close": price,
            "volume": 10000 + i * 200,
            "timestamp": now - timedelta(days=35 - i),
        })

    async with get_session_ctx() as session:
        o_repo = OHLCVRepository(session)
        await o_repo.insert_batch(candles)

        # Load from database via DatabaseDataLoader (limit=50 returns at most 35 for this symbol)
        loaded = await DatabaseDataLoader.load_from_db(session, sym, limit=50)
        assert len(loaded) == 35, f"Expected 35 candles, got {len(loaded)}"
        assert loaded[0]["timestamp"] < loaded[-1]["timestamp"]

    # Train agent using stored database quotes
    provider = MockDataProvider(symbols=[sym])
    agent_svc = AgentService(provider=provider, model_version="test-v1")
    train_res = agent_svc.train_on_quotes(loaded, user_id="test-user", epochs=1)

    assert train_res["steps"] > 0
    assert "epsilon" in train_res
    assert "buffer_size" in train_res


async def test_api_stock_sync_and_history(client, auth_headers):
    """Test POST /api/v1/stocks/sync and GET /api/v1/stocks/history."""
    # Sync stock prices
    r = await client.post("/api/v1/stocks/sync?symbol=TSLA&days=20", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert data["symbol"] == "TSLA"
    assert data["synced_days"] >= 20

    # Get history
    r_hist = await client.get("/api/v1/stocks/history?symbol=TSLA&limit=30", headers=auth_headers)
    assert r_hist.status_code == 200
    hist_data = r_hist.json()
    assert hist_data["symbol"] == "TSLA"
    assert hist_data["count"] >= 20
    assert len(hist_data["prices"]) >= 20


async def test_api_rl_train_and_daily_train(client, auth_headers):
    """Test POST /api/v1/rl/train and POST /api/v1/rl/daily-train using database prices."""
    # Run regular train endpoint
    r_train = await client.post("/api/v1/rl/train?symbol=AAPL", headers=auth_headers)
    assert r_train.status_code == 200
    res = r_train.json()
    assert res["status"] == "success"
    assert res["source"] == "database"
    assert res["data_points"] > 0
    assert "steps" in res

    # Run daily train endpoint
    r_daily = await client.post("/api/v1/rl/daily-train?symbols=AAPL&epochs=1", headers=auth_headers)
    assert r_daily.status_code == 200
    daily_res = r_daily.json()
    assert daily_res["status"] == "success"
    assert "Daily training completed" in daily_res["message"]
    assert daily_res["training_results"]["steps"] > 0

    # Verify training run was logged in database
    r_runs = await client.get("/api/v1/rl/training-runs?limit=10", headers=auth_headers)
    assert r_runs.status_code == 200
    runs = r_runs.json()
    assert len(runs) >= 1
    assert runs[0]["status"] == "completed"
