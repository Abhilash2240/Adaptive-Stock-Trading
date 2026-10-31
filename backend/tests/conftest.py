"""
Test configuration for the backend test suite.

Sets environment variables BEFORE any package imports so that get_settings()
picks up the test overrides. For integration tests that need a live database,
the DB fixtures are defined here but are NOT autouse — opt in per test file.
"""
import os
import asyncio
from pathlib import Path

# ---------------------------------------------------------------------------
# Set env vars before any package imports so @lru_cache picks them up.
# Use SQLite for unit tests that need DB; integration tests opt into real DB.
# ---------------------------------------------------------------------------
_test_db_path = Path(__file__).parent / "test_trading.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_test_db_path.as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["DATA_PROVIDER"] = "mock"
os.environ.setdefault("TWELVEDATA_API_KEY", "")

# Clear the lru_cache so the new env vars take effect
from packages.shared.config import get_settings
get_settings.cache_clear()

# ---------------------------------------------------------------------------
# Session-scoped DB initialization: create all tables once per test session.
# We use a plain synchronous pytest fixture that calls asyncio.run() directly.
# This avoids pytest-asyncio loop management issues.
# ---------------------------------------------------------------------------

_WELL_KNOWN_TEST_IDS = [900001, 900002, 900003, 910004, 920001]


def _run_init_db() -> None:
    """Run init_db() and cleanup stale test data in a fresh event loop."""
    from packages.shared.config import get_settings
    from sqlalchemy import Integer

    get_settings.cache_clear()

    import packages.db.engine as engine_module
    from packages.db.models import AgentActionDB

    # Reset singletons so the test DB URL is picked up
    engine_module._engine = None
    engine_module._session_factory = None

    # SQLite doesn't support BigInteger PK natively — cast to Integer
    AgentActionDB.__table__.c.id.type = Integer()

    async def _init():
        await engine_module.init_db()
        # Clean up hard-coded test IDs so re-runs don't hit UNIQUE violations
        from packages.db.engine import get_session_ctx
        async with get_session_ctx() as session:
            for tid in _WELL_KNOWN_TEST_IDS:
                existing = await session.get(AgentActionDB, tid)
                if existing is not None:
                    await session.delete(existing)
            await session.commit()

    asyncio.run(_init())


# Run once at import time so tables exist before any test
_run_init_db()
