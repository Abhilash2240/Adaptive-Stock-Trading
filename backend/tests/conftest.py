import asyncio
import os
import pytest
import pytest_asyncio

# Configure test environment BEFORE any imports that use Settings
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATA_PROVIDER", "mock")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def init_test_db():
    """Initialize the test database with tables."""
    # Reset globals in engine module to ensure we start fresh
    import packages.db.engine as engine_module
    engine_module._engine = None
    engine_module._session_factory = None
    
    # Now initialize database tables
    await engine_module.init_db()
    
    yield
    
    # Cleanup
    await engine_module.close_db()
