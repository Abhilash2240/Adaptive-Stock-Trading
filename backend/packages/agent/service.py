from __future__ import annotations

import asyncio
import hashlib
import logging
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

import numpy as np

from packages.agent.ddqn import DDQNAgent
from packages.agent.environment import TradingEnvironment
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
_HOLD_ACTION = TradingEnvironment.HOLD
_DEFAULT_USER_ID = "__global_default__"  # For backward compatibility

logger = logging.getLogger(__name__)


def _get_user_model_path(user_id: str) -> Path:
    """Get a deterministic, filesystem-safe file path for a user's model weights."""
    models_dir = Path("models")
    model_path = models_dir / f"{hashlib.sha256(user_id.encode()).hexdigest()[:16]}.pt"

    legacy_path = models_dir / f"{user_id}.pt"
    try:
        legacy_is_in_models = legacy_path.resolve().parent == models_dir.resolve()
        if not model_path.exists() and legacy_is_in_models and legacy_path.exists():
            legacy_path.rename(model_path)
    except OSError as exc:
        logger.warning("Failed to migrate legacy model file for user %s: %s", user_id, exc)

    return model_path


class AgentService:
    def __init__(
        self,
        provider: DataProvider,
        model_version: str = "ddqn-v1",
        train_interval: int = 32,
        idle_timeout_seconds: float = 1800.0,
        cleanup_interval_seconds: float = 300.0,
    ) -> None:
        self._provider = provider
        self._model_version = model_version
        self._state = AgentState.IDLE

        # Per-user agent instances
        self._user_agents: dict[str, DDQNAgent] = {}
        # Per-user environments (symbol -> TradingEnvironment)
        self._user_environments: dict[str, dict[str, TradingEnvironment]] = {}
        # Per-user training state tracking
        self._user_training_ticks: dict[str, dict[str, int]] = {}
        self._user_training_state: dict[str, dict[str, np.ndarray | None]] = {}
        self._user_training_action: dict[str, dict[str, int]] = {}
        self._user_last_used: dict[str, datetime] = {}
        self._active_users: set[str] = set()
        self._background_tasks: set[asyncio.Task] = set()
        self._cleanup_task: asyncio.Task | None = None

        self._train_interval = max(1, train_interval)
        self._idle_timeout_seconds = max(0.0, idle_timeout_seconds)
        self._cleanup_interval_seconds = max(0.1, cleanup_interval_seconds)
        self._agent_lock = RLock()

        # For backward compatibility: keep a reference to the default agent
        self._agent = self._get_user_agent(_DEFAULT_USER_ID)
        self._environments = self._user_environments.get(_DEFAULT_USER_ID, {})

        self._last_action = AgentAction(
            symbol="AAPL",
            side=OrderSide.HOLD,
            confidence=0.0,
            generated_at=datetime.now(timezone.utc),
        )

    def _handle_background_task_done(self, task: asyncio.Task) -> None:
        """Keep task references bounded and log any exception raised in background work."""
        self._background_tasks.discard(task)

        if task.cancelled():
            return

        try:
            exc = task.exception()
        except asyncio.CancelledError:
            return

        if exc is not None:
            logger.exception(
                "Background agent training task failed",
                exc_info=(type(exc), exc, exc.__traceback__),
            )

    def start_cleanup_task(self) -> None:
        """Start the periodic idle-user cleanup loop once an event loop is running."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop_cleanup_task(self) -> None:
        """Stop the periodic idle-user cleanup loop during application shutdown."""
        if self._cleanup_task is None:
            return

        self._cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await self._cleanup_task
        self._cleanup_task = None

    async def _cleanup_loop(self) -> None:
        while True:
            await asyncio.sleep(self._cleanup_interval_seconds)
            self.cleanup_idle_users()

    def _begin_user_operation(self, user_id: str) -> None:
        with self._agent_lock:
            self._active_users.add(user_id)

    def _end_user_operation(self, user_id: str) -> None:
        with self._agent_lock:
            self._active_users.discard(user_id)

    def cleanup_idle_users(self, now: datetime | None = None) -> list[str]:
        """Evict non-default users that have exceeded the configured idle timeout."""
        current_time = now or datetime.now(timezone.utc)
        evicted_users: list[str] = []

        with self._agent_lock:
            for user_id, last_used in list(self._user_last_used.items()):
                if user_id == _DEFAULT_USER_ID or user_id in self._active_users:
                    continue
                idle_seconds = (current_time - last_used).total_seconds()
                if idle_seconds <= self._idle_timeout_seconds:
                    continue

                self._user_agents.pop(user_id, None)
                self._user_environments.pop(user_id, None)
                self._user_training_ticks.pop(user_id, None)
                self._user_training_state.pop(user_id, None)
                self._user_training_action.pop(user_id, None)
                self._user_last_used.pop(user_id, None)
                evicted_users.append(user_id)

        return evicted_users

    # -- Per-user agent management ----------------------------------
    def _get_user_agent(self, user_id: str) -> DDQNAgent:
        """
        Get or create a DDQNAgent for the given user.
        Attempts to load from disk first; creates fresh if not found.
        """
        with self._agent_lock:
            if user_id not in self._user_agents:
                agent = DDQNAgent(
                    state_dim=_STATE_DIM,
                    action_dim=_ACTION_DIM,
                )

                # Try to load existing weights for this user
                model_path = _get_user_model_path(user_id)
                if model_path.exists():
                    try:
                        agent.load(str(model_path))
                    except Exception as exc:
                        # If load fails, log and continue with fresh model
                        logger.warning("Failed to load model for user %s: %s", user_id, exc)

                self._user_agents[user_id] = agent
                # Initialize tracking dicts for this user
                self._user_environments[user_id] = {}
                self._user_training_ticks[user_id] = {}
                self._user_training_state[user_id] = {}
                self._user_training_action[user_id] = {}
            self._user_last_used[user_id] = datetime.now(timezone.utc)
            return self._user_agents[user_id]

    # -- Feed quote into feature engine -----------------------------
    def _get_environment(self, symbol: str, user_id: str | None = None) -> TradingEnvironment:
        """Get or create a TradingEnvironment for the given symbol and user."""
        if user_id is None:
            user_id = _DEFAULT_USER_ID

        with self._agent_lock:
            self._user_last_used[user_id] = datetime.now(timezone.utc)
            normalized_symbol = symbol.strip().upper()

            # Ensure user exists in environments dict
            if user_id not in self._user_environments:
                self._user_environments[user_id] = {}
                self._user_training_ticks[user_id] = {}
                self._user_training_state[user_id] = {}
                self._user_training_action[user_id] = {}

            if normalized_symbol not in self._user_environments[user_id]:
                self._user_environments[user_id][normalized_symbol] = TradingEnvironment()
                self._user_training_ticks[user_id][normalized_symbol] = 0
                self._user_training_state[user_id][normalized_symbol] = None
                self._user_training_action[user_id][normalized_symbol] = _HOLD_ACTION

            return self._user_environments[user_id][normalized_symbol]

    def _get_environment_legacy(self, symbol: str) -> TradingEnvironment:
        """Backward compatibility: get environment for default user."""
        return self._get_environment(symbol, user_id=_DEFAULT_USER_ID)

    def on_quote(self, quote: dict, user_id: str | None = None) -> None:
        """Feed a quote into a user agent without allowing concurrent eviction."""
        resolved_user_id = user_id or _DEFAULT_USER_ID
        self._begin_user_operation(resolved_user_id)
        try:
            self._on_quote(quote, resolved_user_id)
        finally:
            self._end_user_operation(resolved_user_id)

    def _on_quote(self, quote: dict, user_id: str) -> None:
        """
        Call this from the WebSocket quote handler on every tick.
        """
        symbol = str(quote.get("symbol") or "").strip().upper()
        if not symbol:
            return

        agent = self._get_user_agent(user_id)
        environment = self._get_environment(symbol, user_id=user_id)
        transition = environment.on_quote(
            quote, self._user_training_action[user_id][symbol]
        )
        if transition is None:
            return

        next_state, reward, done = transition
        previous_state = self._user_training_state[user_id][symbol]
        state = previous_state if previous_state is not None else next_state
        action = self._user_training_action[user_id][symbol]
        with self._agent_lock:
            agent.remember(state, action, reward, next_state, done)
        self._user_training_ticks[user_id][symbol] += 1
        if self._user_training_ticks[user_id][symbol] % self._train_interval == 0:
            try:
                loop = asyncio.get_running_loop()
                task = loop.create_task(
                    asyncio.to_thread(self._train_and_save, user_id)
                )
                self._background_tasks.add(task)
                task.add_done_callback(self._handle_background_task_done)
            except RuntimeError:
                # Keep synchronous callers usable outside an event loop.
                self._train_and_save(user_id)

        self._user_training_state[user_id][symbol] = next_state
        with self._agent_lock:
            self._user_training_action[user_id][symbol] = agent.act(
                next_state, training=True
            )

    def _train_and_save(self, user_id: str | None = None) -> None:
        """Train and persist weights while protecting the user from eviction."""
        resolved_user_id = user_id or _DEFAULT_USER_ID
        self._begin_user_operation(resolved_user_id)
        try:
            self._train_and_save_locked(resolved_user_id)
        finally:
            self._end_user_operation(resolved_user_id)

    def _train_and_save_locked(self, user_id: str) -> None:
        """Train and persist weights without concurrent agent access."""
        agent = self._get_user_agent(user_id)
        with self._agent_lock:
            loss = agent.train_step()
            if loss is not None:
                # Save to per-user file
                model_path = _get_user_model_path(user_id)
                model_path.parent.mkdir(exist_ok=True)
                agent.save(str(model_path))

    # -- Request a trading decision ---------------------------------
    def get_action(
        self,
        symbol: str,
        portfolio: dict,
        user_id: str | None = None,
    ) -> AgentAction:
        """Get a user action without allowing concurrent eviction."""
        resolved_user_id = user_id or _DEFAULT_USER_ID
        self._begin_user_operation(resolved_user_id)
        try:
            return self._get_action(symbol, portfolio, resolved_user_id)
        finally:
            self._end_user_operation(resolved_user_id)

    def _get_action(
        self,
        symbol: str,
        portfolio: dict,
        user_id: str,
    ) -> AgentAction:
        """
        Get the action for a symbol and portfolio.
        """
        with track_inference_latency():
            agent = self._get_user_agent(user_id)
            environment = self._get_environment(symbol, user_id=user_id)
            state = environment.get_state(portfolio)

            if state is None:
                # Not enough data yet — hold
                return AgentAction(
                    symbol=symbol,
                    side=OrderSide.HOLD,
                    confidence=0.0,
                    generated_at=datetime.now(timezone.utc),
                )

            with self._agent_lock:
                action_idx = agent.act(state, training=False)
                q_vals = agent.q_values(state)
                conf = agent.confidence(q_vals)

            side_map = {0: OrderSide.HOLD, 1: OrderSide.BUY, 2: OrderSide.SELL}
            self._last_action = AgentAction(
                symbol=symbol,
                side=side_map[action_idx],
                confidence=conf,
                generated_at=datetime.now(timezone.utc),
            )
            self._state = AgentState.IDLE
            return self._last_action

    def get_indicator_snapshot(self, symbol: str, user_id: str | None = None) -> dict[str, float | str]:
        """Return the latest raw indicators for a symbol without changing agent state."""
        if user_id is None:
            user_id = _DEFAULT_USER_ID
        
        environment = self._get_environment(symbol, user_id=user_id)
        closes = np.asarray(environment.features._closes, dtype=np.float64)
        if len(closes) < 26:
            return {}

        highs = np.asarray(environment.features._highs, dtype=np.float64)
        lows = np.asarray(environment.features._lows, dtype=np.float64)
        return {
            "rsi": environment.features._rsi(closes, 14),
            "macd_histogram": environment.features._macd(closes),
            "bollinger_position": environment.features._bb_position(closes, 20),
            "ema_cross_direction": "bullish"
            if environment.features._ema(closes, 9) > environment.features._ema(closes, 21)
            else "bearish",
            "atr": environment.features._atr(highs, lows, closes, 14),
        }

    # -- Training step (one batch from replay buffer) ---------------
    def train_step(
        self,
        state: np.ndarray,
        action: int,
        reward: float,
        next_state: np.ndarray,
        done: bool,
        user_id: str | None = None,
    ) -> float | None:
        """Manual training step for a specific user."""
        if user_id is None:
            user_id = _DEFAULT_USER_ID
        
        agent = self._get_user_agent(user_id)
        agent.remember(state, action, reward, next_state, done)
        loss = agent.train_step()
        if loss is not None:
            # Save to per-user file
            model_path = _get_user_model_path(user_id)
            model_path.parent.mkdir(exist_ok=True)
            agent.save(str(model_path))
        return loss

    # -- Status (used by existing GET /agent/status route) ----------
    def get_status(self, user_id: str | None = None) -> AgentStatus:
        """Get status for a specific user."""
        if user_id is None:
            user_id = _DEFAULT_USER_ID
        
        agent = self._get_user_agent(user_id)
        return AgentStatus(
            state=self._state,
            model_version=self._model_version,
            last_action=self._last_action,
            epsilon=round(agent.epsilon, 4),
            buffer_size=len(agent.replay),
            step_count=agent.step_count,
            last_trained=agent.last_trained,
            updated_at=datetime.now(timezone.utc),
        )

    # Backward-compatible async wrappers for existing route handlers.
    async def status(self, user_id: str | None = None) -> AgentStatus:
        return self.get_status(user_id=user_id)

    async def next_action(self, user_id: str | None = None) -> AgentAction:
        return self.get_action(
            symbol=self._last_action.symbol,
            portfolio={
                "position_flag": 0,
                "unrealized_pnl_pct": 0.0,
                "cash": 0.0,
                "total_value": 1.0,
                "trade_count_today": 0,
            },
            user_id=user_id,
        )
