from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from packages.agent.ddqn import DDQNAgent
from packages.agent.feature_engine import FeatureEngine
from packages.data.provider import DataProvider
from packages.shared.metrics import track_inference_latency
from packages.shared.schemas import (
    AgentAction,
    AgentState,
    AgentStatus,
    OrderSide,
)

_MODEL_PATH = Path("models/ddqn_weights.pt")
_STATE_DIM = 14
_ACTION_DIM = 3  # 0=HOLD 1=BUY 2=SELL


class AgentService:
    def __init__(
        self,
        provider: DataProvider,
        model_version: str = "ddqn-v1",
    ) -> None:
        self._provider = provider
        self._model_version = model_version
        self._state = AgentState.IDLE

        self._agent = DDQNAgent(
            state_dim=_STATE_DIM,
            action_dim=_ACTION_DIM,
        )
        self._features = FeatureEngine()

        # Load saved weights if they exist
        if _MODEL_PATH.exists():
            self._agent.load(str(_MODEL_PATH))
            self._state = AgentState.IDLE

        self._last_action = AgentAction(
            symbol="AAPL",
            side=OrderSide.HOLD,
            confidence=0.0,
            generated_at=datetime.now(timezone.utc),
        )

    # -- Feed quote into feature engine -----------------------------
    def on_quote(self, quote: dict) -> None:
        """Call this from the WebSocket quote handler on every tick."""
        self._features.update(quote)

    # -- Request a trading decision ---------------------------------
    def get_action(
        self,
        symbol: str,
        portfolio: dict,
    ) -> AgentAction:
        with track_inference_latency():
            state = self._features.get_state(portfolio)

            if state is None:
                # Not enough data yet — hold
                return AgentAction(
                    symbol=symbol,
                    side=OrderSide.HOLD,
                    confidence=0.0,
                    generated_at=datetime.now(timezone.utc),
                )

            action_idx = self._agent.act(state, training=False)
            q_vals = self._agent.q_values(state)
            conf = self._agent.confidence(q_vals)

            side_map = {0: OrderSide.HOLD, 1: OrderSide.BUY, 2: OrderSide.SELL}
            self._last_action = AgentAction(
                symbol=symbol,
                side=side_map[action_idx],
                confidence=conf,
                generated_at=datetime.now(timezone.utc),
            )
            self._state = AgentState.IDLE
            return self._last_action

    # -- Training step (one batch from replay buffer) ---------------
    def train_step(
        self,
        state: np.ndarray,
        action: int,
        reward: float,
        next_state: np.ndarray,
        done: bool,
    ) -> float | None:
        self._agent.remember(state, action, reward, next_state, done)
        loss = self._agent.train_step()
        if loss is not None:
            _MODEL_PATH.parent.mkdir(exist_ok=True)
            self._agent.save(str(_MODEL_PATH))
        return loss

    # -- Status (used by existing GET /agent/status route) ----------
    def get_status(self) -> AgentStatus:
        return AgentStatus(
            state=self._state,
            model_version=self._model_version,
            last_action=self._last_action,
            epsilon=round(self._agent.epsilon, 4),
            buffer_size=len(self._agent.replay),
            step_count=self._agent.step_count,
            last_trained=self._agent.last_trained,
            updated_at=datetime.now(timezone.utc),
        )

    # Backward-compatible async wrappers for existing route handlers.
    async def status(self) -> AgentStatus:
        return self.get_status()

    async def next_action(self) -> AgentAction:
        return self.get_action(
            symbol=self._last_action.symbol,
            portfolio={
                "position_flag": 0,
                "unrealized_pnl_pct": 0.0,
                "cash": 0.0,
                "total_value": 1.0,
                "trade_count_today": 0,
            },
        )
