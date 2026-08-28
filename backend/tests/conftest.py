import os
import pytest_asyncio

# Configure test environment BEFORE any imports that use Settings
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite://")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATA_PROVIDER", "mock")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Initialize the test database with tables."""
    from sqlalchemy import Integer

    # Reset globals in engine module to ensure we start fresh
    import packages.db.engine as engine_module
    from packages.db.models import AgentActionDB

    engine_module._engine = None
    engine_module._session_factory = None

    # SQLite only autoincrements an exact INTEGER PRIMARY KEY; production uses
    # BigInteger for PostgreSQL, so adapt the test table metadata only.
    AgentActionDB.__table__.c.id.type = Integer()

    # Now initialize database tables
    await engine_module.init_db()
    
    yield
    
    # Cleanup
    await engine_module.close_db()
