from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


# ── Symbol is now a plain validated string so any ticker works ──
# Legacy enum kept as a reference set (for mock provider defaults)
class _LegacySymbol(str, Enum):
    AAPL = "AAPL"
    MSFT = "MSFT"
    TSLA = "TSLA"

# Type alias – any 1-10 uppercase ASCII string
Symbol = Annotated[str, Field(min_length=1, max_length=10)]


def validate_symbol(v: str) -> str:
    """Normalise to uppercase and check basic shape."""
    v = v.strip().upper()
    if not v.isalpha():
        raise ValueError(f"Invalid symbol: {v!r}")
    return v


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


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
    updated_at: datetime


class StreamRequest(BaseModel):
    symbol: str
    channel: Literal["trades", "quotes"] = "quotes"

    @field_validator("symbol", mode="before")
    @classmethod
    def _normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()
