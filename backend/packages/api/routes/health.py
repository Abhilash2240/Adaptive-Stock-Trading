from fastapi import APIRouter, Depends, Request

from packages.shared.schemas import AgentStatus
from packages.shared.config import Settings, get_settings
from packages.agent.service import AgentService
from packages.data.provider import DataProvider, get_data_provider

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def ready(
    settings: Settings = Depends(get_settings),
    provider: DataProvider = Depends(get_data_provider),
) -> dict[str, object]:
    summary = {
        "environment": settings.environment,
        "provider": provider.name,
    }
    return {"status": "ok", "summary": summary}


@router.get("/agent", response_model=AgentStatus)
async def agent_status(request: Request) -> AgentStatus:
    agent: AgentService = request.app.state.agent_service
    return await agent.status()
