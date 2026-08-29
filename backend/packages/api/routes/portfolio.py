from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.db.engine import get_session
from packages.db.models import AgentActionDB, PortfolioStateDB
from packages.data.provider import get_data_provider
from packages.shared.schemas import (
    LogTradePayload,
    PortfolioStateResponse,
    Position,
    TradeRecord,
)
from packages.shared.clerk_auth import AuthenticatedUser, get_current_user

router = APIRouter(tags=["portfolio"])


async def _get_or_create_portfolio(
    session: AsyncSession,
    user_id: str,
) -> PortfolioStateDB:
    stmt = select(PortfolioStateDB).where(PortfolioStateDB.user_id == user_id)
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()

    if row is None:
        row = PortfolioStateDB(user_id=user_id, cash=10_000.0)
        session.add(row)
        await session.commit()
        await session.refresh(row)

    return row


def _build_positions(
    trades: list[AgentActionDB],
    current_prices: dict[str, float],
) -> tuple[list[Position], float]:
    holdings: dict[str, dict[str, float]] = {}

    for t in trades:
        sym = t.symbol
        if sym not in holdings:
            holdings[sym] = {"quantity": 0.0, "cost_basis": 0.0}

        side = (t.side or "").upper()
        if side == "BUY":
            prev_q = holdings[sym]["quantity"]
            prev_cost = holdings[sym]["cost_basis"]
            new_q = prev_q + float(t.quantity or 0.0)
            holdings[sym]["quantity"] = new_q
            holdings[sym]["cost_basis"] = (
                (prev_cost * prev_q + float(t.price or 0.0) * float(t.quantity or 0.0)) / new_q
                if new_q > 0
                else 0.0
            )
        elif side == "SELL":
            holdings[sym]["quantity"] = max(
                0.0,
                holdings[sym]["quantity"] - float(t.quantity or 0.0),
            )

    positions: list[Position] = []
    total_pnl = 0.0

    for sym, h in holdings.items():
        if h["quantity"] <= 0:
            continue

        curr = float(current_prices.get(sym, h["cost_basis"]))
        pnl = (curr - h["cost_basis"]) * h["quantity"]
        pnl_pct = (
            (curr - h["cost_basis"]) / h["cost_basis"] if h["cost_basis"] > 0 else 0.0
        )
        total_pnl += pnl

        positions.append(
            Position(
                symbol=sym,
                quantity=h["quantity"],
                avg_price=round(h["cost_basis"], 4),
                current_price=curr,
                unrealized_pnl=round(pnl, 4),
                unrealized_pnl_pct=round(pnl_pct, 6),
            )
        )

    return positions, total_pnl


async def _load_portfolio_snapshot(
    session: AsyncSession,
    user_id: str,
) -> tuple[PortfolioStateDB, list[Position], float, int]:
    """Load the shared portfolio data used by REST and agent responses."""
    portfolio_row = await _get_or_create_portfolio(session, user_id)

    stmt = (
        select(AgentActionDB)
        .where(AgentActionDB.user_id == user_id)
        .order_by(AgentActionDB.executed_at)
    )
    result = await session.execute(stmt)
    trades = list(result.scalars().all())

    last_prices = {t.symbol: float(t.price or 0.0) for t in trades}
    provider = get_data_provider()
    live_prices = {
        symbol: price
        for symbol in last_prices
        if (price := provider.get_latest_price(symbol)) is not None and price > 0
    }
    positions, total_pnl = _build_positions(trades, {**last_prices, **live_prices})
    today = datetime.now(timezone.utc).date()
    trade_count_today = sum(
        1 for trade in trades if trade.executed_at and trade.executed_at.date() == today
    )
    return portfolio_row, positions, total_pnl, trade_count_today


async def get_agent_portfolio(
    session: AsyncSession,
    user_id: str,
) -> dict[str, float | int]:
    """Build the compact, user-specific portfolio input expected by the agent."""
    portfolio_row, positions, total_pnl, trade_count_today = await _load_portfolio_snapshot(
        session,
        user_id,
    )
    position_value = sum(position.quantity * position.current_price for position in positions)
    cash = float(portfolio_row.cash)
    total_value = cash + position_value
    invested_value = sum(position.quantity * position.avg_price for position in positions)
    return {
        "position_flag": int(bool(positions)),
        "unrealized_pnl_pct": total_pnl / invested_value if invested_value > 0 else 0.0,
        "cash": cash,
        "total_value": total_value,
        "trade_count_today": trade_count_today,
    }


@router.get("/api/v1/portfolio", response_model=PortfolioStateResponse)
async def get_portfolio(
    session: AsyncSession = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> PortfolioStateResponse:
    portfolio_row, positions, total_pnl, _ = await _load_portfolio_snapshot(
        session,
        current_user.id,
    )

    position_value = sum(p.quantity * p.current_price for p in positions)
    total_value = float(portfolio_row.cash) + position_value

    return PortfolioStateResponse(
        user_id=current_user.id,
        cash=round(float(portfolio_row.cash), 2),
        total_value=round(total_value, 2),
        unrealized_pnl=round(total_pnl, 2),
        positions=positions,
        updated_at=portfolio_row.updated_at,
    )


@router.get("/api/v1/trades", response_model=list[TradeRecord])
async def get_trades(
    limit: int = 50,
    offset: int = 0,
    symbol: str | None = None,
    side: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    session: AsyncSession = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> list[TradeRecord]:
    filters = [AgentActionDB.user_id == current_user.id]
    if symbol:
        filters.append(AgentActionDB.symbol == symbol.strip().upper())
    if side:
        filters.append(func.lower(AgentActionDB.side) == side.strip().lower())
    if from_date:
        filters.append(AgentActionDB.executed_at >= from_date)
    if to_date:
        filters.append(AgentActionDB.executed_at <= to_date)

    stmt = (
        select(AgentActionDB)
        .where(*filters)
        .order_by(AgentActionDB.executed_at.desc())
        .offset(max(offset, 0))
        .limit(max(limit, 0))
    )
    result = await session.execute(stmt)
    trades = list(result.scalars().all())

    return [
        TradeRecord(
            id=int(t.id or 0),
            user_id=t.user_id or current_user.id,
            symbol=t.symbol,
            side=t.side,
            quantity=float(t.quantity or 0.0),
            price=float(t.price or 0.0),
            confidence=float(t.confidence or 0.0),
            executed_at=t.executed_at,
        )
        for t in trades
    ]


@router.post("/api/v1/trades", response_model=TradeRecord)
async def log_trade(
    payload: LogTradePayload,
    session: AsyncSession = Depends(get_session),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> TradeRecord:
    portfolio_row = await _get_or_create_portfolio(session, current_user.id)

    side = payload.side.upper()
    cost = float(payload.quantity) * float(payload.price)

    if side == "BUY":
        if float(portfolio_row.cash) < cost:
            raise HTTPException(status_code=400, detail="Insufficient cash")
        portfolio_row.cash = float(portfolio_row.cash) - cost
    elif side == "SELL":
        stmt = (
            select(AgentActionDB)
            .where(AgentActionDB.user_id == current_user.id)
            .order_by(AgentActionDB.executed_at)
        )
        result = await session.execute(stmt)
        trades = list(result.scalars().all())
        positions, _ = _build_positions(trades, {})
        held_quantity = next(
            (position.quantity for position in positions if position.symbol == payload.symbol.upper()),
            0.0,
        )
        if float(payload.quantity) > held_quantity:
            raise HTTPException(status_code=400, detail="Insufficient shares to sell")
        portfolio_row.cash = float(portfolio_row.cash) + cost

    portfolio_row.updated_at = datetime.now(timezone.utc)
    session.add(portfolio_row)

    trade = AgentActionDB(
        user_id=current_user.id,
        symbol=payload.symbol.upper(),
        side=side,
        quantity=float(payload.quantity),
        price=float(payload.price),
        confidence=float(payload.confidence),
        model_version="manual",
        executed_at=datetime.now(timezone.utc),
        timestamp=datetime.now(timezone.utc),
    )
    session.add(trade)
    await session.commit()
    await session.refresh(trade)

    return TradeRecord(
        id=int(trade.id or 0),
        user_id=trade.user_id or current_user.id,
        symbol=trade.symbol,
        side=trade.side,
        quantity=float(trade.quantity or 0.0),
        price=float(trade.price or 0.0),
        confidence=float(trade.confidence or 0.0),
        executed_at=trade.executed_at,
    )
