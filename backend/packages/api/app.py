from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, WebSocket
from fastapi import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from packages.agent.service import AgentService
from packages.data.provider import DataProvider, get_data_provider
from packages.shared.config import Settings, get_settings
from packages.shared.metrics import websocket_closed, websocket_connected, websocket_message_sent
from packages.shared.schemas import AgentStatus, StreamRequest
from .routes import health


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
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


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or get_settings()
    app = FastAPI(lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.settings = resolved_settings

    app.include_router(getattr(health, "router", health))

    instrumentator = Instrumentator(should_ignore_untemplated=True)
    instrumentator.instrument(app).expose(
        app,
        include_in_schema=False,
        should_gzip=True,
    )

    @app.post("/stream")
    async def request_stream(
        request: StreamRequest,
        provider: DataProvider = Depends(get_data_provider),
    ) -> dict[str, str]:
        await provider.subscribe(request.symbol.value, request.channel)
        return {"status": "subscribed"}

    @app.websocket("/ws/quotes")
    async def quotes_websocket(
        websocket: WebSocket,
        provider: DataProvider = Depends(get_data_provider),
    ) -> None:
        endpoint = "/ws/quotes"
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
    async def agent_status(
        agent: AgentService = Depends(get_agent_service),
    ) -> AgentStatus:
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
