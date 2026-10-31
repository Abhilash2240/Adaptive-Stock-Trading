from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import asyncio
import logging
import time

from fastapi import Body, Depends, FastAPI, Query, Request, Response, WebSocket
from fastapi import WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import select
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from typing import Annotated

from packages.agent.service import AgentService
from packages.agent.rationale import RationaleService
from packages.data.provider import DataProvider, get_data_provider
from packages.db.engine import get_session_ctx
from packages.db.models import AgentActionDB
from packages.db.repositories import UserSettingsRepository
from packages.shared.config import Settings, get_settings
from packages.shared.clerk_auth import (
    AuthenticatedUser,
    get_current_user,
    require_admin,
    verify_clerk_token,
)
from packages.shared.metrics import websocket_closed, websocket_connected, websocket_message_sent
from packages.shared.schemas import (
    AgentAction,
    AgentStatus,
    OrderSide,
    SaveSettingsPayload,
    StreamRequest,
    UserSettingsResponse,
)
from packages.shared.security import (
    InputValidator,
    audit_logger,
    limiter,
)
from .routes import health
from .routes.portfolio import get_agent_portfolio, router as portfolio_router

# Security setup
security_scheme = HTTPBearer()
validator = InputValidator()
logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Initialize database (create tables if needed)
    try:
        from packages.db.engine import init_db, close_db
        await init_db()
        logger.info("PostgreSQL database connected and tables ready")
    except Exception as exc:
        logger.warning("Database init skipped: %s", exc)

    provider = get_data_provider()
    await provider.start()

    from packages.data.storage import get_storage_service, reset_storage_service
    storage = get_storage_service()
    await storage.start()

    agent = get_agent_service()
    settings = get_settings()
    try:
        app.state.data_provider = provider
        app.state.storage_service = storage
        app.state.agent_service = agent
        agent.start_cleanup_task()
        if settings.daily_train_enabled:
            agent.start_daily_scheduler(interval_hours=settings.daily_train_interval_hours)
        yield
    finally:
        await agent.stop_daily_scheduler()
        await agent.stop_cleanup_task()
        await storage.stop()
        await provider.stop()
        reset_storage_service()
        reset_agent_service()
        # Close database connections
        try:
            from packages.db.engine import close_db
            await close_db()
        except Exception as exc:  # nosec B110
            logger.debug("Database close handled: %s", exc)


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(
        lifespan=lifespan,
        title="Adaptive Stock Trading API",
        description="Secure API for adaptive stock trading with RL agents",
        version="1.0.0"
    )
    
    # Security middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[
            "localhost",
            "127.0.0.1",
            "*.onrender.com",
            "*.vercel.app",
            # add your production domain here when known
        ],
    )

    # Parse comma-separated origins from Settings
    cors_origins = [o.strip() for o in resolved_settings.allowed_origins.split(",") if o.strip()]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.add_middleware(SecurityHeadersMiddleware)

    # Rate limiting middleware
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.state.settings = resolved_settings

    # Include routers
    app.include_router(getattr(health, "router", health))
    app.include_router(portfolio_router)

    instrumentator = Instrumentator(should_ignore_untemplated=True)
    instrumentator.instrument(app).expose(
        app,
        include_in_schema=False,
        should_gzip=True,
    )

    # Root route
    @app.get("/")
    async def root():
        """API root endpoint with basic information."""
        return {
            "message": "Adaptive Stock Trading API",
            "version": "1.0.0",
            "status": "running",
            "docs": "/docs",
            "health": "/api/v1/health",
            "features": [
                "Clerk JWT Authentication",
                "Real-time Stock Data Streaming",
                "AI Trading Agent",
                "Rate Limiting",
                "Security Headers",
                "Audit Logging"
            ]
        }

    # API status endpoint
    @app.get("/api/v1/status")
    async def api_status():
        """Get API status and configuration."""
        return {
            "status": "operational",
            "environment": resolved_settings.environment,
            "security": {
                "authentication": "Clerk JWT",
                "rate_limiting": "enabled",
                "cors": "configured",
                "security_headers": "enabled"
            },
            "endpoints": {
                "docs": "/docs",
                "health": "/api/v1/health",
                "stream": "/api/v1/stream",
                "websocket": "/ws/quotes",
                "agent_status": "/api/v1/agent"
            }
        }

    # ── Stock quote REST endpoint (powered by Twelve Data) ────────
    @app.get("/api/v1/quotes")
    @limiter.limit("30/minute")
    async def get_quote(
        request: Request,
        symbol: str = "AAPL",
        provider: DataProvider = Depends(get_data_provider),
    ) -> dict:
        """
        Return a single-stock quote.
        If the active provider is TwelveData, fetches rich data (open/high/low/
        close/volume/change).  Otherwise returns the latest streamed price.
        """
        sym = symbol.strip().upper()
        from packages.data.adapters.twelvedata import TwelveDataProvider
        if isinstance(provider, TwelveDataProvider):
            try:
                data = await provider.fetch_quote_detail(sym)
                from packages.data.storage import get_storage_service
                await get_storage_service().store_quote_direct(
                    symbol=sym,
                    price=float(data.get("close") or data.get("price") or 0),
                    volume=int(float(data.get("volume") or 0)),
                    open_price=float(data.get("open") or 0),
                    high=float(data.get("high") or 0),
                    low=float(data.get("low") or 0),
                )
                return {
                    "symbol": data.get("symbol", sym),
                    "name": data.get("name", sym),
                    "price": float(data.get("close", 0)),
                    "open": float(data.get("open", 0)),
                    "high": float(data.get("high", 0)),
                    "low": float(data.get("low", 0)),
                    "volume": int(data.get("volume", 0)),
                    "change": float(data.get("change", 0)),
                    "percent_change": float(data.get("percent_change", 0)),
                    "currency": data.get("currency", "USD"),
                    "exchange": data.get("exchange", ""),
                    "provider": "twelvedata",
                }
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Twelve Data error: {exc}")
        return {"symbol": sym, "price": 0, "provider": provider.name, "currency": "USD"}

    @app.post("/api/v1/stream")
    @limiter.limit("10/minute")  # Rate limit stream requests
    async def request_stream(
        request: Request,
        stream_request: StreamRequest,
        provider: DataProvider = Depends(get_data_provider),
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> dict[str, str]:
        # Validate and sanitize input
        validated_data = validator.validate_stream_request({
            "symbol": stream_request.symbol,
            "channel": stream_request.channel
        })
        
        await audit_logger.log_user_action(
            user_id=current_user.id,
            action="stream_request", 
            details={"symbol": validated_data["symbol"], "channel": validated_data["channel"]}
        )
        
        await provider.subscribe(stream_request.symbol, stream_request.channel)
        return {"status": "subscribed"}

    @app.get("/api/v1/settings", response_model=UserSettingsResponse)
    async def get_settings_route(
        userId: str = Query(...),
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> UserSettingsResponse:
        if current_user.id != userId:
            raise HTTPException(status_code=403, detail="Forbidden")

        async with get_session_ctx() as session:
            repo = UserSettingsRepository(session)
            row = await repo.get(userId)
            if row is None:
                row = await repo.upsert(userId)
            return UserSettingsResponse.from_db(row)

    @app.post("/api/v1/settings", response_model=UserSettingsResponse)
    async def save_settings_route(
        payload: SaveSettingsPayload,
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> UserSettingsResponse:
        if current_user.id != payload.userId:
            raise HTTPException(status_code=403, detail="Forbidden")

        updates: dict = {}
        if payload.tradingMode is not None:
            updates["trading_mode"] = payload.tradingMode
        if payload.marketDataProvider is not None:
            updates["market_data_provider"] = payload.marketDataProvider
        if payload.llmRationaleEnabled is not None:
            updates["gemini_enabled"] = payload.llmRationaleEnabled
        if payload.notificationsEnabled is not None:
            updates["notifications_enabled"] = payload.notificationsEnabled

        async with get_session_ctx() as session:
            repo = UserSettingsRepository(session)
            row = await repo.upsert(payload.userId, **updates)
            return UserSettingsResponse.from_db(row)

    @app.websocket("/ws/quotes")
    async def quotes_websocket(
        websocket: WebSocket,
        provider: DataProvider = Depends(get_data_provider),
    ) -> None:
        endpoint = "/ws/quotes"
        await websocket.accept()
        try:
            auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=5.0)
            if (
                not isinstance(auth_message, dict)
                or auth_message.get("type") != "auth"
                or not isinstance(auth_message.get("token"), str)
                or not auth_message["token"]
            ):
                await websocket.close(code=4401, reason="Authentication required")
                return

            token = auth_message["token"]
            payload = verify_clerk_token(token, resolved_settings)
            user_id = str(payload.get("sub") or "")

            if not user_id:
                await websocket.close(code=4401, reason="Invalid authentication")
                return
                
            await audit_logger.log_user_action(
                user_id=str(user_id),
                action="websocket_connect",
                details={"endpoint": endpoint}
            )
            await websocket.send_json({"type": "auth_ack", "status": "authenticated"})
        except (asyncio.TimeoutError, ValueError, WebSocketDisconnect):
            await websocket.close(code=4401, reason="Authentication required")
            return
        except Exception:
            await websocket.close(code=4401, reason="Authentication failed")
            return

        websocket_connected(endpoint)
        agent_service = get_agent_service()
        user_portfolio: dict[str, float | int] | None = None
        portfolio_refreshed_at = 0.0
        try:
            from packages.data.storage import get_storage_service
            storage_service = get_storage_service()
            async for quote in provider.stream_quotes():
                quote_payload = quote.model_dump(mode="json")
                agent_service.on_quote(quote_payload, user_id=user_id)
                # Persist stock price in database
                await storage_service.record_quote(quote_payload)

                now = time.monotonic()
                if user_portfolio is None or now - portfolio_refreshed_at >= 4.0:
                    async with get_session_ctx() as session:
                        user_portfolio = await get_agent_portfolio(session, user_id)
                    portfolio_refreshed_at = now

                agent_action = agent_service.get_action(
                    symbol=quote_payload["symbol"],
                    portfolio=user_portfolio,
                    user_id=user_id,
                )

                last_price = float(quote_payload.get("price", 0.0))
                broadcast_payload = {
                    **quote_payload,
                    "open": last_price,
                    "high": last_price,
                    "low": last_price,
                    "close": last_price,
                    "action_signal": agent_action.side.value,
                    "confidence": round(agent_action.confidence, 4),
                    "signal_timestamp": agent_action.generated_at.isoformat(),
                    "portfolio": user_portfolio,
                }

                await websocket.send_json(broadcast_payload)
                websocket_message_sent(endpoint)
        except WebSocketDisconnect as exc:
            websocket_closed(endpoint, code=str(exc.code or "disconnect"))
        except Exception:
            websocket_closed(endpoint, code="error")
            raise
        else:
            websocket_closed(endpoint, code="complete")

    @app.get("/api/v1/agent", response_model=AgentStatus)
    @limiter.limit("30/minute")  # Rate limit agent status requests
    async def agent_status(
        request: Request,
        agent: AgentService = Depends(get_agent_service),
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AgentStatus:
        await audit_logger.log_user_action(
            user_id=current_user.id,
            action="agent_status_check",
            details={}
        )
        return await agent.status(user_id=current_user.id)

    @app.post("/api/v1/agent/action", response_model=AgentAction)
    async def get_agent_action(
        symbol: str,
        portfolio: dict = Body(...),
        current_user: AuthenticatedUser = Depends(get_current_user),
        agent: AgentService = Depends(get_agent_service),
    ) -> AgentAction:
        return agent.get_action(
            symbol=symbol,
            portfolio=portfolio,
            user_id=current_user.id,
        )

    @app.post("/api/v1/agent/rationale", response_model=dict)
    @limiter.limit("30/minute")
    async def get_agent_rationale(
        request: Request,
        payload: dict = Body(...),
        current_user: AuthenticatedUser = Depends(get_current_user),
        agent: AgentService = Depends(get_agent_service),
    ) -> dict:
        symbol = str(payload.get("symbol") or "").strip().upper()
        if not symbol:
            raise HTTPException(status_code=422, detail="symbol is required")

        settings = get_settings()
        async with get_session_ctx() as session:
            user_settings = await UserSettingsRepository(session).get(current_user.id)
            if user_settings is None or not user_settings.gemini_enabled:
                return {"rationale": None, "reason": "disabled"}

            result = await session.execute(
                select(AgentActionDB)
                .where(
                    AgentActionDB.user_id == current_user.id,
                    AgentActionDB.symbol == symbol,
                )
                .order_by(AgentActionDB.executed_at.desc())
                .limit(1)
            )
            latest_action = result.scalar_one_or_none()

        if latest_action is None:
            return {"rationale": None, "model": settings.openrouter_model}

        action = AgentAction(
            symbol=latest_action.symbol,
            side=OrderSide(latest_action.side.upper()),
            confidence=float(latest_action.confidence or 0.0),
            generated_at=latest_action.executed_at,
        )
        rationale = await RationaleService(settings=settings).explain(
            symbol,
            action,
            agent.get_indicator_snapshot(symbol, user_id=current_user.id),
        )
        return {"rationale": rationale, "model": settings.openrouter_model}

    @app.post("/api/v1/rl/train", response_model=dict)
    async def trigger_training(
        symbol: str | None = Query(None, description="Optional stock symbol to train on"),
        current_user: AuthenticatedUser = Depends(get_current_user),
        agent_service: AgentService = Depends(get_agent_service),
    ) -> dict:
        """
        Train the RL agent on stock prices stored in the database.
        Ensures daily stock price records exist and runs a DDQN training cycle.
        """
        from packages.data.storage import get_storage_service
        from packages.agent.historical import DatabaseDataLoader
        from packages.db.repositories import TrainingRepository

        user_id = current_user.id
        settings = get_settings()
        storage = get_storage_service()

        train_symbols = [s.strip().upper() for s in (symbol or settings.symbols).split(",") if s.strip()]
        if not train_symbols:
            train_symbols = ["AAPL"]

        # Ensure database contains stored stock prices for training
        for sym in train_symbols:
            async with get_session_ctx() as session:
                stored = await DatabaseDataLoader.load_from_db(session, sym, limit=300)
            if len(stored) < 20:
                await storage.sync_daily_prices(sym, days=30)

        # Load stored stock prices from PostgreSQL/SQLite database
        all_quotes = []
        async with get_session_ctx() as session:
            for sym in train_symbols:
                sym_quotes = await DatabaseDataLoader.load_from_db(session, sym, limit=300)
                all_quotes.extend(sym_quotes)

        # Train on database stored prices
        if all_quotes:
            train_res = agent_service.train_on_quotes(all_quotes, user_id=user_id, epochs=1)
            loss = train_res.get("mean_loss")
            agent = agent_service._get_user_agent(user_id)
            epsilon = agent.epsilon

            # Persist training run in database
            try:
                async with get_session_ctx() as session:
                    t_repo = TrainingRepository(session)
                    run = await t_repo.create_run(
                        model_name=settings.agent_model_name,
                        hyperparameters={
                            "source": "database",
                            "symbols": train_symbols,
                            "quotes_count": len(all_quotes),
                        },
                    )
                    if loss is not None:
                        await t_repo.log_metric(
                            run_id=run.id,
                            episode=1,
                            loss=float(loss),
                            reward=float(train_res.get("total_reward", 0.0)),
                            epsilon=float(epsilon),
                        )
                    await t_repo.complete_run(
                        run_id=run.id,
                        best_reward=train_res.get("total_reward"),
                        final_loss=loss,
                    )
            except Exception as exc:
                logger.warning("Could not log training run to DB: %s", exc)

            return {
                "status": "success",
                "source": "database",
                "symbols": train_symbols,
                "data_points": len(all_quotes),
                "loss": round(loss, 6) if loss is not None else None,
                "epsilon": round(epsilon, 4),
                "steps": agent.step_count,
            }

        # Fallback to in-memory train step if no DB data available
        loss = agent_service._get_user_agent(user_id).train_step()
        agent = agent_service._get_user_agent(user_id)
        return {
            "status": "success",
            "source": "memory",
            "loss": round(loss, 6) if loss is not None else None,
            "epsilon": round(agent.epsilon, 4),
            "steps": agent.step_count,
        }

    @app.post("/api/v1/rl/daily-train", response_model=dict)
    async def daily_training_endpoint(
        symbols: str | None = Query(None, description="Comma-separated symbols to daily train on"),
        epochs: int = Query(1, ge=1, le=10),
        current_user: AuthenticatedUser = Depends(get_current_user),
        agent_service: AgentService = Depends(get_agent_service),
    ) -> dict:
        """
        Trigger an automated daily training run using stock prices stored in the database.
        """
        from packages.data.storage import get_storage_service
        from packages.agent.historical import DatabaseDataLoader
        from packages.db.repositories import TrainingRepository

        user_id = current_user.id
        settings = get_settings()
        storage = get_storage_service()

        train_symbols = [s.strip().upper() for s in (symbols or settings.symbols).split(",") if s.strip()]
        if not train_symbols:
            train_symbols = ["AAPL"]

        # 1. Sync any missing daily prices into the database
        for sym in train_symbols:
            await storage.sync_daily_prices(sym, days=30)

        # 2. Load all historical stock prices from DB
        all_quotes = []
        async with get_session_ctx() as session:
            for sym in train_symbols:
                quotes = await DatabaseDataLoader.load_from_db(session, sym, limit=500)
                all_quotes.extend(quotes)

        # 3. Train agent across epochs
        result = agent_service.train_on_quotes(all_quotes, user_id=user_id, epochs=epochs)

        # 4. Record the daily training run in the DB
        try:
            async with get_session_ctx() as session:
                t_repo = TrainingRepository(session)
                run = await t_repo.create_run(
                    model_name=settings.agent_model_name,
                    hyperparameters={
                        "type": "daily_training",
                        "source": "database",
                        "symbols": train_symbols,
                        "epochs": epochs,
                        "quotes_count": len(all_quotes),
                    },
                )
                if result.get("mean_loss") is not None:
                    await t_repo.log_metric(
                        run_id=run.id,
                        episode=epochs,
                        loss=float(result["mean_loss"]),
                        reward=float(result.get("total_reward", 0.0)),
                        epsilon=float(result.get("epsilon", 0.0)),
                    )
                await t_repo.complete_run(
                    run_id=run.id,
                    best_reward=result.get("total_reward"),
                    final_loss=result.get("final_loss"),
                )
        except Exception as exc:
            logger.warning("Could not log daily training run: %s", exc)

        return {
            "status": "success",
            "message": "Daily training completed on stored database stock prices",
            "symbols": train_symbols,
            "data_points": len(all_quotes),
            "epochs": epochs,
            "training_results": result,
        }

    @app.post("/api/v1/stocks/sync", response_model=dict)
    async def sync_stock_prices_endpoint(
        symbol: str = Query("AAPL"),
        days: int = Query(30, ge=1, le=365),
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> dict:
        """Fetch and store daily stock prices into PostgreSQL/SQLite database."""
        from packages.data.storage import get_storage_service
        storage = get_storage_service()
        synced_count = await storage.sync_daily_prices(symbol=symbol, days=days)
        stats = await storage.get_stored_stats()
        return {
            "status": "success",
            "symbol": symbol.upper(),
            "synced_days": synced_count,
            "database_stats": stats,
        }

    @app.get("/api/v1/stocks/history", response_model=dict)
    async def get_stock_history_endpoint(
        symbol: str = Query("AAPL"),
        limit: int = Query(100, ge=1, le=1000),
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> dict:
        """Get stored historical stock prices from the database for a symbol."""
        from packages.data.storage import get_storage_service
        storage = get_storage_service()
        prices = await storage.get_stored_prices(symbol=symbol, limit=limit)
        return {
            "symbol": symbol.upper(),
            "count": len(prices),
            "prices": prices,
        }

    @app.get("/api/v1/stocks/stats", response_model=dict)
    async def get_stock_db_stats_endpoint(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> dict:
        """Get statistics about stock prices stored in the database."""
        from packages.data.storage import get_storage_service
        storage = get_storage_service()
        stats = await storage.get_stored_stats()
        return {"status": "operational", "database_stats": stats}

    @app.get("/api/v1/rl/training-runs", response_model=list[dict])
    async def get_training_runs_endpoint(
        limit: int = Query(20, ge=1, le=100),
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> list[dict]:
        """List historical training runs from the database."""
        from packages.db.repositories import TrainingRepository
        async with get_session_ctx() as session:
            repo = TrainingRepository(session)
            runs = await repo.list_runs(limit=limit)
            return [
                {
                    "id": r.id,
                    "model_name": r.model_name,
                    "hyperparameters": r.hyperparameters,
                    "status": r.status,
                    "total_episodes": r.total_episodes,
                    "best_reward": r.best_reward,
                    "final_loss": r.final_loss,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                }
                for r in runs
            ]

    return app


_agent_service: AgentService | None = None


def get_agent_service() -> AgentService:
    global _agent_service
    if _agent_service is None:
        settings = get_settings()
        provider = get_data_provider()
        _agent_service = AgentService(
            provider,
            model_version=settings.agent_model_name,
            train_interval=settings.agent_train_interval,
            idle_timeout_seconds=settings.agent_idle_timeout_seconds,
            cleanup_interval_seconds=settings.agent_cleanup_interval_seconds,
        )
    return _agent_service


def reset_agent_service() -> None:
    global _agent_service
    _agent_service = None
