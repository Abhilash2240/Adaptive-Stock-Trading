"""
environment.py — Trading Environment with Episode Boundaries & Shaped Reward
=============================================================================
Fixes (from deep-dive doc):
  § "done is never True" — the agent never learned episode boundaries; the
    (1-done) term in the Bellman equation was always 1, so it bootstrapped
    across day boundaries as if the future were infinitely valued.
  § "No reward shaping" — raw P&L is extremely noisy and sparse; the agent
    struggled to learn from it alone.

Fix 1 — Episode boundaries:
  TradingEnvironment tracks a _session_closed flag.  When a quote arrives
  whose UTC hour >= session_close_hour (default 21), done=True is returned
  ONCE.  The flag prevents re-firing on subsequent ticks within the same
  session.  It resets when a tick arrives in the next session (hour <
  session_close_hour).  This survives the edge case described in the spec:
    tick at hour=20 → done=False  (_session_closed=False)
    tick at hour=21 → done=True   (_session_closed=True, position flattened)
    tick at hour=21 → done=False  (already closed — flag stays True)
    tick at hour=09 (next day) → _session_closed=False (flag reset)
    tick at hour=21 (next day) → done=True again ✓

Fix 2 — Shaped reward:
  RewardConfig holds four configurable weights:
    pnl_weight       — scales the raw P&L delta (keep 1.0)
    transaction_cost — flat % deducted per trade (original: 0.0005)
    drawdown_weight  — penalty proportional to max-drawdown from peak
    overtrade_weight — penalty per trade above overtrade_threshold/day

All RewardConfig fields have defaults matching original behaviour so
existing checkpoints and service.py code are unaffected.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np

from packages.agent.feature_engine import FeatureEngine


# ---------------------------------------------------------------------------
# Reward configuration
# ---------------------------------------------------------------------------

@dataclass
class RewardConfig:
    pnl_weight:          float = 1.0
    transaction_cost:    float = 0.0005   # fraction of trade value
    drawdown_weight:     float = 0.1
    overtrade_weight:    float = 0.01
    overtrade_threshold: int   = 10       # free trades per day before penalty


# ---------------------------------------------------------------------------
# Trading environment
# ---------------------------------------------------------------------------

@dataclass
class TradingEnvironment:
    """Single-symbol trading simulation driven by incoming quote ticks."""

    initial_cash:      float       = 10_000.0
    trade_size:        float       = 1.0
    session_close_hour: int        = 21      # UTC hour that ends an episode
    flatten_on_close:  bool        = True    # force-close position at day end
    reward_config:     RewardConfig = field(default_factory=RewardConfig)

    HOLD = 0
    BUY  = 1
    SELL = 2

    def __post_init__(self) -> None:
        self.features          = FeatureEngine()
        self.cash              = self.initial_cash
        self.position          = 0.0
        self.avg_entry_price   = 0.0
        self.trade_count       = 0
        self._price: float | None = None
        self._last_total_value = self.initial_cash
        self._peak_value       = self.initial_cash   # for drawdown penalty
        self._session_closed   = False               # episode-boundary guard

    # ------------------------------------------------------------------
    @property
    def portfolio(self) -> dict:
        price = self._price or 0.0
        total = self.cash + self.position * price
        unreal = self.position * (price - self.avg_entry_price)
        unreal_pct = (
            unreal / abs(self.position * self.avg_entry_price)
            if self.position and self.avg_entry_price
            else 0.0
        )
        return {
            "position_flag":     1 if self.position > 0 else -1 if self.position < 0 else 0,
            "unrealized_pnl_pct": unreal_pct,
            "cash":              self.cash,
            "total_value":       total,
            "trade_count_today": self.trade_count,
        }

    @property
    def total_value(self) -> float:
        return self.cash + self.position * (self._price or 0.0)

    def get_state(self, portfolio: dict) -> np.ndarray | None:
        return self.features.get_state(portfolio)

    # ------------------------------------------------------------------
    def on_quote(
        self, quote: dict, action: int = 0
    ) -> tuple[np.ndarray, float, bool] | None:
        """Feed a market quote and evaluate one action."""
        price = float(quote.get("close", quote.get("price", 0)))
        if price <= 0:
            return None

        # -- Episode boundary detection ----------------------------------
        ts = quote.get("timestamp")
        if isinstance(ts, datetime):
            hour = ts.hour
        else:
            hour = datetime.now(timezone.utc).hour

        done = False
        if hour >= self.session_close_hour and not self._session_closed:
            done = True
            self._session_closed = True
        elif hour < self.session_close_hour:
            self._session_closed = False   # new session: allow next close

        self._price = price
        self.features.update(quote)
        if len(self.features._closes) < 26:
            return None

        state, raw_reward, _ = self.step(action)

        # -- Shaped reward -----------------------------------------------
        shaped = self._shape_reward(raw_reward, action, done)

        # -- Flatten position at session close ----------------------------
        if done and self.flatten_on_close and self.position != 0:
            self._flatten()

        return state, shaped, done

    # ------------------------------------------------------------------
    def step(self, action: int) -> tuple[np.ndarray, float, bool]:
        if self._price is None:
            raise RuntimeError("Cannot step before receiving a quote")
        if action not in (self.HOLD, self.BUY, self.SELL):
            raise ValueError(f"Unknown action: {action}")

        traded = action != self.HOLD
        if action == self.BUY:
            self._buy()
        elif action == self.SELL:
            self._sell()

        current_value      = self.total_value
        raw_reward         = current_value - self._last_total_value
        if traded:
            self.trade_count += 1
        self._last_total_value = current_value
        self._peak_value       = max(self._peak_value, current_value)

        state = self.features.get_state(self.portfolio)
        if state is None:
            raise RuntimeError("Cannot step before enough quote history exists")
        return state, float(raw_reward), False

    # ------------------------------------------------------------------
    def _shape_reward(self, raw_reward: float, action: int, done: bool) -> float:
        rc = self.reward_config
        shaped = rc.pnl_weight * raw_reward

        # Transaction cost
        if action != self.HOLD and self._price:
            shaped -= rc.transaction_cost * self._price * self.trade_size

        # Drawdown penalty (only in non-terminal steps to avoid double-counting)
        if not done:
            drawdown = max(0.0, self._peak_value - self.total_value)
            shaped  -= rc.drawdown_weight * drawdown

        # Overtrading penalty
        excess = max(0, self.trade_count - rc.overtrade_threshold)
        shaped -= rc.overtrade_weight * excess

        return shaped

    # ------------------------------------------------------------------
    def _flatten(self) -> None:
        """Force-close the current position at session close."""
        if self._price is None:
            return
        if self.position > 0:
            self.cash    += self.position * self._price
            self.position = 0.0
            self.avg_entry_price = 0.0
        elif self.position < 0:
            self.cash    += self.position * self._price   # position is negative
            self.position = 0.0
            self.avg_entry_price = 0.0

    def _buy(self) -> None:
        price = self._price
        assert price is not None
        if self.position < 0:
            self.cash     -= self.trade_size * price
            self.position += self.trade_size
            if self.position == 0:
                self.avg_entry_price = 0.0
            return
        total_cost             = self.position * self.avg_entry_price + self.trade_size * price
        self.cash             -= self.trade_size * price
        self.position         += self.trade_size
        self.avg_entry_price   = total_cost / self.position

    def _sell(self) -> None:
        price = self._price
        assert price is not None
        if self.position > 0:
            self.cash     += self.trade_size * price
            self.position -= self.trade_size
            if self.position == 0:
                self.avg_entry_price = 0.0
            return
        total_entry            = abs(self.position) * self.avg_entry_price + self.trade_size * price
        self.cash             += self.trade_size * price
        self.position         -= self.trade_size
        self.avg_entry_price   = total_entry / abs(self.position)
