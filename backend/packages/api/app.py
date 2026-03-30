from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import os

from fastapi import Body, Depends, FastAPI, Query, Request, Response, WebSocket
from fastapi import WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from typing import Annotated

from packages.agent.service import AgentService
from packages.data.provider import DataProvider, get_data_provider
from packages.db.engine import get_session_ctx
from packages.db.repositories import UserSettingsRepository
from packages.shared.config import Settings, get_settings
from packages.shared.auth0 import AuthenticatedUser, get_current_user, verify_auth0_token
from packages.shared.metrics import websocket_closed, websocket_connected, websocket_message_sent
from packages.shared.schemas import (
    AgentAction,
    AgentStatus,
    SaveSettingsPayload,
    StreamRequest,
    UserSettingsResponse,
)
from packages.shared.security import (
    InputValidator,
    audit_logger,
    limiter,
)
from .routes import auth, health, portfolio

# Security setup
security_scheme = HTTPBearer()
validator = InputValidator()


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
        print("[OK] PostgreSQL database connected and tables ready.")
    except Exception as exc:
        print(f"[WARN] Database init skipped: {exc}")
        print("   Set DATABASE_URL in .env to enable persistence.")

    provider = get_data_provider()
    await provider.start()
    agent = get_agent_service()
    try:
        app.state.data_provider = provider
        app.state.agent_service = agent
        yield
    finally:
        await provider.stop()
        reset_agent_service()
        # Close database connections
        try:
            from packages.db.engine import close_db
            await close_db()
        except Exception:
            pass


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
            "*.railway.app",
            "*.vercel.app",
            # add your production domain here when known
        ],
    )

    _raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    _origins = [o.strip() for o in _raw.split(",") if o.strip()]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_origins,
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
    app.include_router(auth.router, prefix="/api/v1") 
    app.include_router(getattr(health, "router", health))
    app.include_router(portfolio.router)

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
            "auth": "/api/v1/auth",
            "features": [
                "Auth0 JWT Authentication",
                "Real-time Stock Data Streaming",
                "AI Trading Agent",
                "Rate Limiting",
                "Security Headers",
                "Audit Logging"
            ]
        }

    # API status endpoint
    @app.get("/api/status")
    async def api_status():
        """Get API status and configuration."""
        return {
            "status": "operational",
            "environment": resolved_settings.environment,
            "security": {
                "authentication": "Auth0 JWT",
                "rate_limiting": "enabled",
                "cors": "configured",
                "security_headers": "enabled"
            },
            "endpoints": {
                "docs": "/docs",
                "health": "/api/v1/health",
                "auth": "/api/v1/auth",
                "stream": "/stream",
                "websocket": "/ws/quotes",
                "agent_status": "/agent/status"
            }
        }

    # ── Stock quote REST endpoint (powered by Twelve Data) ────────
    @app.get("/api/quote")
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

    @app.get("/api/stocks")
    @limiter.limit("10/minute")
    async def list_stocks(
        request: Request,
        symbol: str | None = None,
        exchange: str | None = None,
        country: str | None = None,
        type: str | None = None,
        provider: DataProvider = Depends(get_data_provider),
    ) -> dict:
        """
        Proxy to Twelve Data /stocks endpoint — returns available symbols.
        """
        from packages.data.adapters.twelvedata import TwelveDataProvider
        if not isinstance(provider, TwelveDataProvider):
            return {"data": [], "status": "ok", "provider": provider.name,
                    "message": "Stock listing only available with Twelve Data provider"}
        try:
            return await provider.fetch_stocks_list(
                symbol=symbol, exchange=exchange, country=country, stock_type=type
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Twelve Data error: {exc}")

    @app.post("/stream")
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

    @app.get("/settings", response_model=UserSettingsResponse)
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

    @app.post("/settings", response_model=UserSettingsResponse)
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
        if payload.geminiEnabled is not None:
            updates["gemini_enabled"] = payload.geminiEnabled
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
        
        # WebSocket authentication - check for token in query params
        token = websocket.query_params.get("token")
        if not token:
            await websocket.accept()
            await websocket.close(code=4001, reason="Authentication required")
            return

        try:
            if resolved_settings.auth0_domain and resolved_settings.auth0_audience:
                payload = verify_auth0_token(token, resolved_settings)
                user_id = str(payload.get("sub") or "")
            else:
                # Keep local dev/test compatibility when Auth0 is not configured.
                from packages.shared.security import JWTManager

                ws_jwt = JWTManager(resolved_settings)
                token_data = ws_jwt.verify_token(token)
                user_id = token_data.username

            if not user_id:
                await websocket.accept()
                await websocket.close(code=4001, reason="Invalid authentication")
                return
                
            await audit_logger.log_user_action(
                user_id=str(user_id),
                action="websocket_connect",
                details={"endpoint": endpoint}
            )
        except Exception as e:
            await websocket.accept()
            await websocket.close(code=4001, reason="Authentication failed")
            return
            
        await websocket.accept()
        websocket_connected(endpoint)
        agent_service = get_agent_service()
        try:
            async for quote in provider.stream_quotes():
                quote_payload = quote.model_dump(mode="json")
                agent_service.on_quote(quote_payload)

                _default_portfolio = {
                    "position_flag": 0,
                    "unrealized_pnl_pct": 0.0,
                    "cash": 10_000.0,
                    "total_value": 10_000.0,
                    "trade_count_today": 0,
                }

                agent_action = agent_service.get_action(
                    symbol=quote_payload["symbol"],
                    portfolio=_default_portfolio,
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

    @app.get("/agent/status", response_model=AgentStatus)
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
        return await agent.status()

    @app.post("/agent/action", response_model=AgentAction)
    async def get_agent_action(
        symbol: str,
        portfolio: dict = Body(...),
        current_user: AuthenticatedUser = Depends(get_current_user),
        agent: AgentService = Depends(get_agent_service),
    ) -> AgentAction:
        return agent.get_action(symbol=symbol, portfolio=portfolio)

    @app.post("/rl/train", response_model=dict)
    async def trigger_training(
        current_user: AuthenticatedUser = Depends(get_current_user),
        agent: AgentService = Depends(get_agent_service),
    ) -> dict:
        loss = agent._agent.train_step()
        return {
            "loss": loss,
            "epsilon": round(agent._agent.epsilon, 4),
            "steps": agent._agent.step_count,
        }

    return app


_agent_service: AgentService | None = None


def get_agent_service() -> AgentService:
    global _agent_service
    if _agent_service is None:
        settings = get_settings()
        provider = get_data_provider()
        _agent_service = AgentService(provider, model_version=settings.agent_model_name)
    return _agent_service


def reset_agent_service() -> None:
    global _agent_service
    _agent_service = None
