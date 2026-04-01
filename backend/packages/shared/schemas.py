from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


# Type alias – any 1-10 uppercase ASCII string
Symbol = Annotated[str, Field(min_length=1, max_length=10)]


def validate_symbol(v: str) -> str:
    """Normalise to uppercase and check basic shape."""
    v = v.strip().upper()
    if not v.isalpha():
        raise ValueError(f"Invalid symbol: {v!r}")
    return v


class OrderSide(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class AgentState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"


class Quote(BaseModel):
    symbol: str
    price: float = Field(..., ge=0)
    volume: int = Field(..., ge=0)
    timestamp: datetime

    @field_validator("symbol", mode="before")
    @classmethod
    def _normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()


class Order(BaseModel):
    symbol: str
    quantity: int = Field(..., gt=0)
    side: OrderSide
    price_limit: float | None = Field(default=None, ge=0)

    @field_validator("symbol", mode="before")
    @classmethod
    def _normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()


class AgentAction(BaseModel):
    symbol: str
    side: OrderSide
    confidence: float = Field(..., ge=0, le=1)
    generated_at: datetime


class AgentStatus(BaseModel):
    state: AgentState
    model_version: str
    last_action: AgentAction | None = None
    epsilon: float = 1.0
    buffer_size: int = 0
    step_count: int = 0
    last_trained: datetime | None = None
    updated_at: datetime


class StreamRequest(BaseModel):
    symbol: str
    channel: Literal["trades", "quotes"] = "quotes"

    @field_validator("symbol", mode="before")
    @classmethod
    def _normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()


# -- Settings schemas ------------------------------------------------------
class UserSettingsResponse(BaseModel):
    userId: str
    tradingMode: str
    marketDataProvider: str
    geminiEnabled: bool
    notificationsEnabled: bool

    @classmethod
    def from_db(cls, row: "UserSettingsDB") -> "UserSettingsResponse":
        return cls(
            userId=row.user_id,
            tradingMode=row.trading_mode,
            marketDataProvider=row.market_data_provider,
            geminiEnabled=row.gemini_enabled,
            notificationsEnabled=row.notifications_enabled,
        )


class SaveSettingsPayload(BaseModel):
    userId: str
    tradingMode: str | None = None
    marketDataProvider: str | None = None
    geminiEnabled: bool | None = None
    notificationsEnabled: bool | None = None


class ChatContext(BaseModel):
    """Context for AI chat requests."""
    stock_symbol: str | None = Field(default=None, min_length=1, max_length=10)
    current_price: float | None = Field(default=None, ge=0)
    
    @field_validator("stock_symbol", mode="before")
    @classmethod
    def _normalize_symbol(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip().upper()


class ChatRequest(BaseModel):
    userId: str = "anonymous-user"
    message: str = Field(..., min_length=1, max_length=2000)
    symbol: str | None = Field(default=None, min_length=1, max_length=10)
    context: ChatContext | None = None  # Enhanced context support

    @field_validator("message", mode="before")
    @classmethod
    def _normalize_message(cls, v: str) -> str:
        return v.strip()

    @field_validator("symbol", mode="before")
    @classmethod
    def _normalize_optional_symbol(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip().upper()


class ChatResponse(BaseModel):
    answer: str
    model: str
    timestamp: datetime


# -- Portfolio schemas -----------------------------------------------------
class Position(BaseModel):
    symbol: str
    quantity: float
    avg_price: float
    current_price: float
    unrealized_pnl: float
    unrealized_pnl_pct: float


class PortfolioStateResponse(BaseModel):
    user_id: str
    cash: float
    total_value: float
    unrealized_pnl: float
    positions: list[Position]
    updated_at: datetime


# -- Trade schemas ---------------------------------------------------------
class TradeRecord(BaseModel):
    id: int
    user_id: str
    symbol: str
    side: str
    quantity: float
    price: float
    confidence: float
    executed_at: datetime


class LogTradePayload(BaseModel):
    symbol: str
    side: str
    quantity: float
    price: float
    confidence: float = 0.0
