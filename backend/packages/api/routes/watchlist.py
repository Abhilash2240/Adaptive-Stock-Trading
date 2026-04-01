"""
Watchlist API routes with JWT authentication.

All endpoints require valid JWT token for user identification.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from packages.db.engine import get_session
from packages.db.models import WatchlistDB
from packages.shared.security import get_current_user, get_optional_user, validator

router = APIRouter(prefix="/api/v1/watchlist", tags=["watchlist"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class WatchlistItem(BaseModel):
    """Single watchlist item response."""
    id: str
    stock_symbol: str
    notes: Optional[str] = None
    alert_price_above: Optional[float] = None
    alert_price_below: Optional[float] = None
    created_at: datetime


class WatchlistResponse(BaseModel):
    """Full watchlist response."""
    items: list[WatchlistItem]
    count: int


class AddToWatchlistRequest(BaseModel):
    """Request to add a stock to watchlist."""
    stock_symbol: str = Field(..., min_length=1, max_length=10)
    notes: Optional[str] = Field(None, max_length=500)
    alert_price_above: Optional[float] = Field(None, ge=0)
    alert_price_below: Optional[float] = Field(None, ge=0)


class UpdateWatchlistRequest(BaseModel):
    """Request to update watchlist item."""
    notes: Optional[str] = Field(None, max_length=500)
    alert_price_above: Optional[float] = Field(None, ge=0)
    alert_price_below: Optional[float] = Field(None, ge=0)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=WatchlistResponse)
async def get_watchlist(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WatchlistResponse:
    """Get the authenticated user's watchlist."""
    user_id = current_user["user_id"]
    
    stmt = (
        select(WatchlistDB)
        .where(WatchlistDB.user_id == user_id)
        .order_by(WatchlistDB.created_at.desc())
    )
    result = await session.execute(stmt)
    items = list(result.scalars().all())
    
    return WatchlistResponse(
        items=[
            WatchlistItem(
                id=item.id,
                stock_symbol=item.stock_symbol,
                notes=item.notes,
                alert_price_above=item.alert_price_above,
                alert_price_below=item.alert_price_below,
                created_at=item.created_at,
            )
            for item in items
        ],
        count=len(items),
    )


@router.post("", response_model=WatchlistItem)
async def add_to_watchlist(
    request: AddToWatchlistRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WatchlistItem:
    """Add a stock to the authenticated user's watchlist."""
    user_id = current_user["user_id"]
    
    # Validate and normalize symbol
    symbol = validator.validate_symbol(request.stock_symbol)
    
    # Check if already in watchlist
    stmt = select(WatchlistDB).where(
        WatchlistDB.user_id == user_id,
        WatchlistDB.stock_symbol == symbol,
    )
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"{symbol} is already in your watchlist"
        )
    
    # Create new watchlist entry
    item = WatchlistDB(
        user_id=user_id,
        stock_symbol=symbol,
        notes=validator.sanitize_string(request.notes or "") or None,
        alert_price_above=request.alert_price_above,
        alert_price_below=request.alert_price_below,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    
    return WatchlistItem(
        id=item.id,
        stock_symbol=item.stock_symbol,
        notes=item.notes,
        alert_price_above=item.alert_price_above,
        alert_price_below=item.alert_price_below,
        created_at=item.created_at,
    )


@router.put("/{symbol}", response_model=WatchlistItem)
async def update_watchlist_item(
    symbol: str,
    request: UpdateWatchlistRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WatchlistItem:
    """Update a watchlist item for the authenticated user."""
    user_id = current_user["user_id"]
    symbol = validator.validate_symbol(symbol)
    
    stmt = select(WatchlistDB).where(
        WatchlistDB.user_id == user_id,
        WatchlistDB.stock_symbol == symbol,
    )
    result = await session.execute(stmt)
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail=f"{symbol} not in watchlist")
    
    # Update fields
    if request.notes is not None:
        item.notes = validator.sanitize_string(request.notes) or None
    if request.alert_price_above is not None:
        item.alert_price_above = request.alert_price_above
    if request.alert_price_below is not None:
        item.alert_price_below = request.alert_price_below
    
    session.add(item)
    await session.commit()
    await session.refresh(item)
    
    return WatchlistItem(
        id=item.id,
        stock_symbol=item.stock_symbol,
        notes=item.notes,
        alert_price_above=item.alert_price_above,
        alert_price_below=item.alert_price_below,
        created_at=item.created_at,
    )


@router.delete("/{symbol}")
async def remove_from_watchlist(
    symbol: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Remove a stock from the authenticated user's watchlist."""
    user_id = current_user["user_id"]
    symbol = validator.validate_symbol(symbol)
    
    stmt = delete(WatchlistDB).where(
        WatchlistDB.user_id == user_id,
        WatchlistDB.stock_symbol == symbol,
    )
    result = await session.execute(stmt)
    await session.commit()
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"{symbol} not in watchlist")
    
    return {"status": "removed", "symbol": symbol}
