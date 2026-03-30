from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.db.engine import get_session
from packages.db.models import AgentActionDB, PortfolioStateDB
from packages.shared.schemas import (
    LogTradePayload,
    PortfolioStateResponse,
    Position,
    TradeRecord,
)
from packages.shared.security import User, get_current_user

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


@router.get("/portfolio", response_model=PortfolioStateResponse)
async def get_portfolio(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> PortfolioStateResponse:
    portfolio_row = await _get_or_create_portfolio(session, current_user.id)

    stmt = (
        select(AgentActionDB)
        .where(AgentActionDB.user_id == current_user.id)
        .order_by(AgentActionDB.executed_at)
    )
    result = await session.execute(stmt)
    trades = list(result.scalars().all())

    last_prices: dict[str, float] = {}
    for t in trades:
        last_prices[t.symbol] = float(t.price or 0.0)

    positions, total_pnl = _build_positions(trades, last_prices)

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


@router.get("/trades", response_model=list[TradeRecord])
async def get_trades(
    limit: int = 50,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> list[TradeRecord]:
    stmt = (
        select(AgentActionDB)
        .where(AgentActionDB.user_id == current_user.id)
        .order_by(AgentActionDB.executed_at.desc())
        .limit(limit)
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


@router.post("/trades", response_model=TradeRecord)
async def log_trade(
    payload: LogTradePayload,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TradeRecord:
    portfolio_row = await _get_or_create_portfolio(session, current_user.id)

    side = payload.side.upper()
    cost = float(payload.quantity) * float(payload.price)

    if side == "BUY":
        if float(portfolio_row.cash) < cost:
            raise HTTPException(status_code=400, detail="Insufficient cash")
        portfolio_row.cash = float(portfolio_row.cash) - cost
    elif side == "SELL":
        portfolio_row.cash = float(portfolio_row.cash) + cost

    portfolio_row.updated_at = datetime.utcnow()
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
