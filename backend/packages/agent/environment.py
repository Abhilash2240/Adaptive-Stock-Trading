from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from packages.agent.feature_engine import FeatureEngine


@dataclass
class TradingEnvironment:
    """Single-symbol trading simulation driven by incoming quote ticks."""

    initial_cash: float = 10_000.0
    trade_size: float = 1.0

    HOLD = 0
    BUY = 1
    SELL = 2

    def __post_init__(self) -> None:
        self.features = FeatureEngine()
        self.cash = self.initial_cash
        self.position = 0.0
        self.avg_entry_price = 0.0
        self.trade_count = 0
        self._price: float | None = None
        self._last_total_value = self.initial_cash

    @property
    def portfolio(self) -> dict[str, float | int]:
        total_value = self.total_value
        unrealized_pnl = self.position * (
            (self._price or 0.0) - self.avg_entry_price
        )
        unrealized_pnl_pct = (
            unrealized_pnl / abs(self.position * self.avg_entry_price)
            if self.position and self.avg_entry_price
            else 0.0
        )
        return {
            "position_flag": 1 if self.position > 0 else -1 if self.position < 0 else 0,
            "unrealized_pnl_pct": unrealized_pnl_pct,
            "cash": self.cash,
            "total_value": total_value,
            "trade_count_today": self.trade_count,
        }

    @property
    def total_value(self) -> float:
        return self.cash + self.position * (self._price or 0.0)

    def get_state(self, portfolio: dict) -> np.ndarray | None:
        """Build a state using this environment's quote history."""
        return self.features.get_state(portfolio)

    def step(self, action: int) -> tuple[np.ndarray, float, bool]:
        """Apply one action at the latest price and return state, reward, done."""
        if self._price is None:
            raise RuntimeError("Cannot step before receiving a quote")

        if action not in (self.HOLD, self.BUY, self.SELL):
            raise ValueError(f"Unknown action: {action}")

        traded = action != self.HOLD
        if action == self.BUY:
            self._buy()
        elif action == self.SELL:
            self._sell()

        current_value = self.total_value
        reward = current_value - self._last_total_value
        if traded:
            self.trade_count += 1
            reward -= 0.0005 * current_value
        self._last_total_value = current_value

        state = self.features.get_state(self.portfolio)
        if state is None:
            raise RuntimeError("Cannot step before enough quote history exists")
        return state, float(reward), False

    def on_quote(
        self, quote: dict, action: int = HOLD
    ) -> tuple[np.ndarray, float, bool] | None:
        """Feed a quote and evaluate one action after the warmup period."""
        price = float(quote.get("close", quote.get("price", 0)))
        if price <= 0:
            return None
        self._price = price
        self.features.update(quote)
        if len(self.features._closes) < 26:
            return None
        return self.step(action)

    def _buy(self) -> None:
        price = self._price
        assert price is not None
        if self.position < 0:
            self.cash -= self.trade_size * price
            self.position += self.trade_size
            if self.position == 0:
                self.avg_entry_price = 0.0
            return
        total_cost = self.position * self.avg_entry_price + self.trade_size * price
        self.cash -= self.trade_size * price
        self.position += self.trade_size
        self.avg_entry_price = total_cost / self.position

    def _sell(self) -> None:
        price = self._price
        assert price is not None
        if self.position > 0:
            self.cash += self.trade_size * price
            self.position -= self.trade_size
            if self.position == 0:
                self.avg_entry_price = 0.0
            return
        total_entry = abs(self.position) * self.avg_entry_price + self.trade_size * price
        self.cash += self.trade_size * price
        self.position -= self.trade_size
        self.avg_entry_price = total_entry / abs(self.position)