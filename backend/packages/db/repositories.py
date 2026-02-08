"""
Repository layer — async CRUD helpers backed by PostgreSQL.

Each repository receives an ``AsyncSession`` and is stateless.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from packages.db.models import (
    AuditLogDB,
    UserDB,
    UserSettingsDB,
    QuoteDB,
    OHLCVDB,
    OrderDB,
    PositionDB,
    AgentActionDB,
    ModelArtifactDB,
    TrainingRunDB,
    TrainingMetricDB,
    BacktestRunDB,
    new_uuid,
    utcnow,
)

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
#  User Repository
# --------------------------------------------------------------------------- #

class UserRepository:
    """CRUD for the ``users`` table."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, username: str, password_hash: str) -> UserDB:
        user = UserDB(
            id=new_uuid(),
            username=username,
            password_hash=password_hash,
            is_active=True,
            created_at=utcnow(),
        )
        self.session.add(user)
        await self.session.flush()
        return user

    async def get_by_id(self, user_id: str) -> UserDB | None:
        stmt = select(UserDB).where(UserDB.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> UserDB | None:
        stmt = select(UserDB).where(UserDB.username == username)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def set_active(self, user_id: str, active: bool) -> None:
        stmt = update(UserDB).where(UserDB.id == user_id).values(is_active=active)
        await self.session.execute(stmt)


# --------------------------------------------------------------------------- #
#  User Settings Repository
# --------------------------------------------------------------------------- #

class UserSettingsRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, user_id: str) -> UserSettingsDB | None:
        stmt = select(UserSettingsDB).where(UserSettingsDB.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(self, user_id: str, **kwargs) -> UserSettingsDB:
        existing = await self.get(user_id)
        if existing:
            for k, v in kwargs.items():
                if hasattr(existing, k):
                    setattr(existing, k, v)
            existing.updated_at = utcnow()
            self.session.add(existing)
            await self.session.flush()
            return existing

        settings = UserSettingsDB(user_id=user_id, **kwargs)
        self.session.add(settings)
        await self.session.flush()
        return settings


# --------------------------------------------------------------------------- #
#  Quote Repository (time-series)
# --------------------------------------------------------------------------- #

class QuoteRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def insert(self, symbol: str, price: float, volume: int, timestamp: datetime) -> None:
        quote = QuoteDB(symbol=symbol, price=price, volume=volume, timestamp=timestamp)
        self.session.add(quote)

    async def insert_batch(self, quotes: list[dict]) -> None:
        objects = [QuoteDB(**q) for q in quotes]
        self.session.add_all(objects)

    async def get_latest(self, symbol: str, limit: int = 100) -> Sequence[QuoteDB]:
        stmt = (
            select(QuoteDB)
            .where(QuoteDB.symbol == symbol)
            .order_by(QuoteDB.timestamp.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


# --------------------------------------------------------------------------- #
#  OHLCV Repository
# --------------------------------------------------------------------------- #

class OHLCVRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def insert_batch(self, candles: list[dict]) -> None:
        objects = [OHLCVDB(**c) for c in candles]
        self.session.add_all(objects)

    async def get_range(
        self,
        symbol: str,
        start: datetime,
        end: datetime,
    ) -> Sequence[OHLCVDB]:
        stmt = (
            select(OHLCVDB)
            .where(
                OHLCVDB.symbol == symbol,
                OHLCVDB.timestamp >= start,
                OHLCVDB.timestamp <= end,
            )
            .order_by(OHLCVDB.timestamp.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


# --------------------------------------------------------------------------- #
#  Order Repository
# --------------------------------------------------------------------------- #

class OrderRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> OrderDB:
        order = OrderDB(**kwargs)
        self.session.add(order)
        await self.session.flush()
        return order

    async def get_user_orders(
        self, user_id: str, limit: int = 50
    ) -> Sequence[OrderDB]:
        stmt = (
            select(OrderDB)
            .where(OrderDB.user_id == user_id)
            .order_by(OrderDB.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update_status(
        self, order_id: str, status: str, filled_price: float | None = None
    ) -> None:
        values: dict = {"status": status}
        if filled_price is not None:
            values["filled_price"] = filled_price
            values["filled_at"] = utcnow()
        stmt = update(OrderDB).where(OrderDB.id == order_id).values(**values)
        await self.session.execute(stmt)


# --------------------------------------------------------------------------- #
#  Position Repository
# --------------------------------------------------------------------------- #

class PositionRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_user_positions(self, user_id: str) -> Sequence[PositionDB]:
        stmt = select(PositionDB).where(PositionDB.user_id == user_id)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def upsert(self, user_id: str, symbol: str, **kwargs) -> PositionDB:
        stmt = select(PositionDB).where(
            PositionDB.user_id == user_id, PositionDB.symbol == symbol
        )
        result = await self.session.execute(stmt)
        pos = result.scalar_one_or_none()

        if pos:
            for k, v in kwargs.items():
                if hasattr(pos, k):
                    setattr(pos, k, v)
            pos.updated_at = utcnow()
            self.session.add(pos)
            await self.session.flush()
            return pos

        pos = PositionDB(user_id=user_id, symbol=symbol, **kwargs)
        self.session.add(pos)
        await self.session.flush()
        return pos


# --------------------------------------------------------------------------- #
#  Agent Action Repository
# --------------------------------------------------------------------------- #

class AgentActionRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(self, symbol: str, side: str, confidence: float, model_version: str) -> None:
        action = AgentActionDB(
            symbol=symbol,
            side=side,
            confidence=confidence,
            model_version=model_version,
        )
        self.session.add(action)

    async def get_recent(self, limit: int = 100) -> Sequence[AgentActionDB]:
        stmt = (
            select(AgentActionDB)
            .order_by(AgentActionDB.timestamp.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


# --------------------------------------------------------------------------- #
#  Model Artifact Repository
# --------------------------------------------------------------------------- #

class ModelArtifactRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def register(self, name: str, version: str, artifact_uri: str = "", metrics: dict | None = None) -> ModelArtifactDB:
        artifact = ModelArtifactDB(
            name=name, version=version, artifact_uri=artifact_uri, metrics=metrics
        )
        self.session.add(artifact)
        await self.session.flush()
        return artifact

    async def get_by_name(self, name: str) -> ModelArtifactDB | None:
        stmt = select(ModelArtifactDB).where(ModelArtifactDB.name == name)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all(self) -> Sequence[ModelArtifactDB]:
        stmt = select(ModelArtifactDB).order_by(ModelArtifactDB.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()


# --------------------------------------------------------------------------- #
#  Training Repository
# --------------------------------------------------------------------------- #

class TrainingRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_run(self, model_name: str, hyperparameters: dict | None = None) -> TrainingRunDB:
        run = TrainingRunDB(model_name=model_name, hyperparameters=hyperparameters)
        self.session.add(run)
        await self.session.flush()
        return run

    async def log_metric(self, run_id: str, episode: int, loss: float, reward: float, **kwargs) -> None:
        metric = TrainingMetricDB(run_id=run_id, episode=episode, loss=loss, reward=reward, **kwargs)
        self.session.add(metric)

    async def complete_run(self, run_id: str, best_reward: float | None = None, final_loss: float | None = None) -> None:
        values = {"status": "completed", "completed_at": utcnow()}
        if best_reward is not None:
            values["best_reward"] = best_reward
        if final_loss is not None:
            values["final_loss"] = final_loss
        stmt = update(TrainingRunDB).where(TrainingRunDB.id == run_id).values(**values)
        await self.session.execute(stmt)

    async def get_run(self, run_id: str) -> TrainingRunDB | None:
        stmt = select(TrainingRunDB).where(TrainingRunDB.id == run_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_runs(self, limit: int = 20) -> Sequence[TrainingRunDB]:
        stmt = select(TrainingRunDB).order_by(TrainingRunDB.started_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()


# --------------------------------------------------------------------------- #
#  Backtest Repository
# --------------------------------------------------------------------------- #

class BacktestRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> BacktestRunDB:
        run = BacktestRunDB(**kwargs)
        self.session.add(run)
        await self.session.flush()
        return run

    async def get_user_backtests(self, user_id: str, limit: int = 20) -> Sequence[BacktestRunDB]:
        stmt = (
            select(BacktestRunDB)
            .where(BacktestRunDB.user_id == user_id)
            .order_by(BacktestRunDB.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()


# --------------------------------------------------------------------------- #
#  Audit Log Repository
# --------------------------------------------------------------------------- #

class AuditLogRepository:

    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        event_type: str,
        *,
        user_id: str | None = None,
        username: str | None = None,
        success: bool = True,
        ip_address: str | None = None,
        action: str | None = None,
        details: dict | None = None,
    ) -> None:
        entry = AuditLogDB(
            event_type=event_type,
            user_id=user_id,
            username=username,
            success=success,
            ip_address=ip_address,
            action=action,
            details=details,
        )
        self.session.add(entry)

    async def get_recent(self, limit: int = 100) -> Sequence[AuditLogDB]:
        stmt = (
            select(AuditLogDB)
            .order_by(AuditLogDB.timestamp.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
