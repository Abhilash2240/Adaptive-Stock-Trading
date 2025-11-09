from datetime import datetime, timezone

from packages.data.provider import DataProvider
from packages.shared.metrics import track_inference_latency
from packages.shared.schemas import AgentAction, AgentState, AgentStatus, OrderSide, Symbol


class AgentService:
    def __init__(self, provider: DataProvider, model_version: str = "ppo-default") -> None:
        self._provider = provider
        self._model_version = model_version
        self._last_action = AgentAction(
            symbol=Symbol.AAPL,
            side=OrderSide.BUY,
            confidence=0.0,
            generated_at=datetime.now(timezone.utc),
        )
        self._state = AgentState.IDLE

    async def status(self) -> AgentStatus:
        return AgentStatus(
            state=self._state,
            model_version=self._model_version,
            updated_at=datetime.now(timezone.utc),
        )

    async def next_action(self) -> AgentAction:
        self._state = AgentState.RUNNING
        try:
            with track_inference_latency():
                action = AgentAction(
                    symbol=self._last_action.symbol,
                    side=self._last_action.side,
                    confidence=0.5,
                    generated_at=datetime.now(timezone.utc),
                )
                self._last_action = action
        except Exception:
            self._state = AgentState.ERROR
            raise
        else:
            self._state = AgentState.IDLE
            return action
