from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Symbol(str, Enum):
    AAPL = "AAPL"
    MSFT = "MSFT"
    TSLA = "TSLA"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class AgentState(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    ERROR = "error"


class Quote(BaseModel):
    symbol: Symbol
    price: float = Field(..., ge=0)
    volume: int = Field(..., ge=0)
    timestamp: datetime


class Order(BaseModel):
    symbol: Symbol
    quantity: int = Field(..., gt=0)
    side: OrderSide
    price_limit: float | None = Field(default=None, ge=0)


class AgentAction(BaseModel):
    symbol: Symbol
    side: OrderSide
    confidence: float = Field(..., ge=0, le=1)
    generated_at: datetime


class AgentStatus(BaseModel):
    state: AgentState
    model_version: str
    updated_at: datetime


class StreamRequest(BaseModel):
    symbol: Symbol
    channel: Literal["trades", "quotes"] = "quotes"
