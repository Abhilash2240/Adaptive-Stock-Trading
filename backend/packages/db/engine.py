"""
Async database engine and session management.

Connects to Neon PostgreSQL (free tier) via asyncpg.
Falls back gracefully when DATABASE_URL is not configured.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel

from packages.shared.config import get_settings

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
#  Engine singleton
# --------------------------------------------------------------------------- #

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _build_connection_url(raw_url: str) -> str:
    """Convert a standard postgresql:// URL to asyncpg format.

    Also strips ``sslmode`` from the query string because asyncpg does not
    recognise it — we pass ``ssl`` via ``connect_args`` instead.
    """
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

    url = raw_url.strip()

    # --- driver prefix ---------------------------------------------------
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif not url.startswith("postgresql+asyncpg://"):
        url = f"postgresql+asyncpg://{url}"

    # --- strip sslmode (asyncpg uses connect_args.ssl instead) -----------
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    qs.pop("sslmode", None)
    clean_query = urlencode(qs, doseq=True)
    url = urlunparse(parsed._replace(query=clean_query))

    return url


def get_engine() -> AsyncEngine:
    """Return the global async engine (creates it on first call)."""
    global _engine
    if _engine is not None:
        return _engine

    settings = get_settings()
    raw_url = settings.database_url

    if not raw_url:
        raise RuntimeError(
            "DATABASE_URL is not set. "
            "Get a free PostgreSQL database at https://neon.tech and set DATABASE_URL in your .env"
        )

    url = _build_connection_url(raw_url)

    _engine = create_async_engine(
        url,
        echo=settings.log_level.upper() == "DEBUG",
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        # Neon serverless uses SSL by default
        connect_args={"ssl": "require"} if "neon.tech" in url else {},
    )

    logger.info("Database engine created — %s", url.split("@")[-1] if "@" in url else "(local)")
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the global async session factory."""
    global _session_factory
    if _session_factory is not None:
        return _session_factory

    engine = get_engine()
    _session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return _session_factory


# --------------------------------------------------------------------------- #
#  Dependency for FastAPI
# --------------------------------------------------------------------------- #

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session — use as a FastAPI ``Depends`` target."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def get_session_ctx() -> AsyncGenerator[AsyncSession, None]:
    """Context-manager variant for use outside of FastAPI."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# --------------------------------------------------------------------------- #
#  Lifecycle helpers (call from FastAPI lifespan)
# --------------------------------------------------------------------------- #

async def init_db() -> None:
    """Create all tables that don't exist yet (safe to call repeatedly)."""
    # Import models so SQLModel registers them
    import packages.db.models  # noqa: F401

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    logger.info("✅ Database tables verified / created.")


async def close_db() -> None:
    """Dispose the engine connection pool."""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database engine closed.")
