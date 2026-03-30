"""
SQLModel database models for the Adaptive Stock Trading platform.

Uses PostgreSQL (Neon) as the primary database with asyncpg driver.
All tables map to the data entities identified in the codebase analysis.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, Column, Relationship
from sqlalchemy import Text, DateTime, Index, JSON, BigInteger, func


# --------------------------------------------------------------------------- #
#  Helper
# --------------------------------------------------------------------------- #

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


# --------------------------------------------------------------------------- #
#  Users & Auth
# --------------------------------------------------------------------------- #

class UserDB(SQLModel, table=True):
    """Persistent user account."""

    __tablename__ = "users"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    username: str = Field(index=True, unique=True, max_length=30)
    password_hash: str = Field(sa_column=Column(Text, nullable=False))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )

    # relationships
    settings: Optional["UserSettingsDB"] = Relationship(back_populates="user")


class UserSettingsDB(SQLModel, table=True):
    """Per-user preferences (trading mode, notifications, etc.)."""

    __tablename__ = "user_settings"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True, index=True)
    trading_mode: str = Field(default="paper")  # paper | live
    market_data_provider: str = Field(default="twelvedata")
    gemini_enabled: bool = Field(default=False)
    notifications_enabled: bool = Field(default=True)
    theme: str = Field(default="light")
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )

    user: Optional[UserDB] = Relationship(back_populates="settings")


# --------------------------------------------------------------------------- #
#  Market Data (time-series)
# --------------------------------------------------------------------------- #

class QuoteDB(SQLModel, table=True):
    """Real-time streaming quote tick — high-volume, append-only."""

    __tablename__ = "quotes"
    __table_args__ = (
        Index("ix_quotes_symbol_ts", "symbol", "timestamp"),
    )

    id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, primary_key=True, autoincrement=True),
    )
    symbol: str = Field(max_length=10, index=True)
    price: float
    volume: int
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )


class OHLCVDB(SQLModel, table=True):
    """Historical candle data for training and backtesting."""

    __tablename__ = "ohlcv"
    __table_args__ = (
        Index("ix_ohlcv_symbol_ts", "symbol", "timestamp"),
    )

    id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, primary_key=True, autoincrement=True),
    )
    symbol: str = Field(max_length=10, index=True)
    open: float
    high: float
    low: float
    close: float
    volume: int
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )


# --------------------------------------------------------------------------- #
#  Trading — Orders, Positions, Portfolio
# --------------------------------------------------------------------------- #

class OrderDB(SQLModel, table=True):
    """Trade order (buy/sell) placed by user or agent."""

    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_user_created", "user_id", "created_at"),
    )

    id: str = Field(default_factory=new_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    symbol: str = Field(max_length=10)
    side: str = Field(max_length=4)  # buy | sell
    quantity: int
    price_limit: Optional[float] = None
    status: str = Field(default="pending", max_length=20)  # pending | filled | cancelled
    filled_price: Optional[float] = None
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    filled_at: Optional[datetime] = None


class PositionDB(SQLModel, table=True):
    """Current portfolio position for a user + symbol."""

    __tablename__ = "positions"
    __table_args__ = (
        Index("ix_positions_user_symbol", "user_id", "symbol", unique=True),
    )

    id: str = Field(default_factory=new_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    symbol: str = Field(max_length=10)
    quantity: int = Field(default=0)
    avg_entry_price: float = Field(default=0.0)
    current_value: float = Field(default=0.0)
    pnl: float = Field(default=0.0)
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class PortfolioStateDB(SQLModel, table=True):
    __tablename__ = "portfolio_state"

    id: int | None = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True)
    cash: float = Field(default=10_000.0)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow
    )


# --------------------------------------------------------------------------- #
#  Agent & RL
# --------------------------------------------------------------------------- #

class AgentActionDB(SQLModel, table=True):
    """Decision log — what the RL agent decided at each step."""

    __tablename__ = "agent_actions"
    __table_args__ = (
        Index("ix_agent_actions_ts", "timestamp"),
    )

    id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, primary_key=True, autoincrement=True),
    )
    user_id: Optional[str] = Field(default=None, index=True)
    symbol: str = Field(max_length=10, index=True)
    side: str = Field(max_length=4)  # buy | sell
    quantity: float = Field(default=0.0)
    price: float = Field(default=0.0)
    confidence: float
    model_version: str = Field(default="unknown", max_length=100)
    executed_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    timestamp: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class ModelArtifactDB(SQLModel, table=True):
    """Metadata for a trained model artifact (weights in object storage)."""

    __tablename__ = "model_artifacts"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    version: str = Field(max_length=50)
    artifact_uri: str = Field(default="", sa_column=Column(Text))  # GCS / local path
    metrics: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


# --------------------------------------------------------------------------- #
#  Training & Backtesting
# --------------------------------------------------------------------------- #

class TrainingRunDB(SQLModel, table=True):
    """A single training job with hyperparameters and result metrics."""

    __tablename__ = "training_runs"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    model_name: str = Field(max_length=100, index=True)
    hyperparameters: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    status: str = Field(default="running", max_length=20)  # running | completed | failed
    total_episodes: int = Field(default=0)
    best_reward: Optional[float] = None
    final_loss: Optional[float] = None
    started_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    completed_at: Optional[datetime] = None


class TrainingMetricDB(SQLModel, table=True):
    """Per-episode metric row for a training run — time-series."""

    __tablename__ = "training_metrics"
    __table_args__ = (
        Index("ix_training_metrics_run_ep", "run_id", "episode"),
    )

    id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, primary_key=True, autoincrement=True),
    )
    run_id: str = Field(foreign_key="training_runs.id", index=True)
    episode: int
    loss: float
    reward: float
    q_value: Optional[float] = None
    epsilon: Optional[float] = None
    timestamp: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class BacktestRunDB(SQLModel, table=True):
    """A completed backtest with performance summary."""

    __tablename__ = "backtest_runs"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    model_name: str = Field(max_length=100)
    symbols: str = Field(max_length=200)  # comma-separated
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    initial_capital: float = Field(default=100_000.0)
    final_value: Optional[float] = None
    total_return: Optional[float] = None
    cagr: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    total_trades: int = Field(default=0)
    status: str = Field(default="running", max_length=20)
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


# --------------------------------------------------------------------------- #
#  Audit Log
# --------------------------------------------------------------------------- #

class AuditLogDB(SQLModel, table=True):
    """Persistent audit log for security events and user actions."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_ts", "timestamp"),
        Index("ix_audit_logs_user", "user_id"),
    )

    id: Optional[int] = Field(
        default=None,
        sa_column=Column(BigInteger, primary_key=True, autoincrement=True),
    )
    event_type: str = Field(max_length=50, index=True)  # AUTH | API_ACCESS | TRADE | etc.
    user_id: Optional[str] = Field(default=None, max_length=100)
    username: Optional[str] = Field(default=None, max_length=30)
    success: bool = Field(default=True)
    ip_address: Optional[str] = Field(default=None, max_length=45)
    action: Optional[str] = Field(default=None, max_length=200)
    details: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    timestamp: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
