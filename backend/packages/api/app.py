from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response, WebSocket
from fastapi import WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from typing import Annotated

from packages.agent.service import AgentService
from packages.data.provider import DataProvider, get_data_provider
from packages.shared.config import Settings, get_settings
from packages.shared.metrics import websocket_closed, websocket_connected, websocket_message_sent
from packages.shared.schemas import AgentStatus, StreamRequest
from packages.shared.security import (
    InputValidator,
    add_security_headers,
    audit_logger,
    get_current_user,
    limiter,
    User
)
from .routes import auth, health

# Security setup
security_scheme = HTTPBearer()
validator = InputValidator()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Initialize database (create tables if needed)
    try:
        from packages.db.engine import init_db, close_db
        await init_db()
        print("✅ PostgreSQL database connected and tables ready.")
    except Exception as exc:
        print(f"⚠️  Database init skipped: {exc}")
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
        allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"] if resolved_settings.environment == "production" else ["*"]
    )
    
    # CORS middleware with security configurations
    allowed_origins = (
        ["https://yourdomain.com", "https://app.yourdomain.com"] 
        if resolved_settings.environment == "production" 
        else [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://localhost:8001",
            "http://127.0.0.1:8001",
        ]
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        expose_headers=["X-Total-Count"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )

    # Rate limiting middleware
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.state.settings = resolved_settings

    # Include routers
    app.include_router(auth.router, prefix="/api/v1") 
    app.include_router(getattr(health, "router", health))

    # Add security headers middleware
    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        response = await call_next(request)
        add_security_headers(response)
        return response

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
                "JWT Authentication",
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
                "authentication": "JWT",
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

    @app.post("/stream")
    @limiter.limit("10/minute")  # Rate limit stream requests
    async def request_stream(
        request: Request,
        stream_request: StreamRequest,
        provider: DataProvider = Depends(get_data_provider),
        current_user: User = Depends(get_current_user),
    ) -> dict[str, str]:
        # Validate and sanitize input
        validated_data = validator.validate_stream_request({
            "symbol": stream_request.symbol.value,
            "channel": stream_request.channel
        })
        
        await audit_logger.log_user_action(
            user_id=current_user.id,
            action="stream_request", 
            details={"symbol": validated_data["symbol"], "channel": validated_data["channel"]}
        )
        
        await provider.subscribe(stream_request.symbol.value, stream_request.channel)
        return {"status": "subscribed"}

    @app.websocket("/ws/quotes")
    async def quotes_websocket(
        websocket: WebSocket,
        provider: DataProvider = Depends(get_data_provider),
    ) -> None:
        endpoint = "/ws/quotes"
        
        # WebSocket authentication - check for token in query params
        token = websocket.query_params.get("token")
        if token:
            try:
                # Verify JWT token for WebSocket connection
                from packages.shared.security import jwt_manager
                payload = jwt_manager.verify_token(token)
                user_id = payload.get("sub")
                if not user_id:
                    await websocket.close(code=4001, reason="Invalid authentication")
                    return
                    
                await audit_logger.log_user_action(
                    user_id=int(user_id),
                    action="websocket_connect",
                    details={"endpoint": endpoint}
                )
            except Exception as e:
                await websocket.close(code=4001, reason="Authentication failed")
                return
        else:
            await websocket.close(code=4001, reason="Authentication required")
            return
            
        await websocket.accept()
        websocket_connected(endpoint)
        try:
            async for quote in provider.stream_quotes():
                await websocket.send_json(quote.model_dump(mode="json"))
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
        current_user: User = Depends(get_current_user),
    ) -> AgentStatus:
        await audit_logger.log_user_action(
            user_id=current_user.id,
            action="agent_status_check",
            details={}
        )
        return await agent.status()

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
