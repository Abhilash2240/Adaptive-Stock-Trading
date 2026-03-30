from __future__ import annotations

from collections import deque
from datetime import datetime, timezone

import numpy as np


class FeatureEngine:
    """
    Converts raw OHLCV quotes + portfolio state into the
    14-dimensional state vector the DDQN agent expects.

    State vector layout:
      [0]  price_normalized
      [1]  price_change_1
      [2]  price_change_5
      [3]  volume_ratio
      [4]  rsi_14
      [5]  macd_signal
      [6]  bb_position
      [7]  ema_9_cross_21
      [8]  atr_normalized
      [9]  position_flag
      [10] unrealized_pnl_pct
      [11] cash_ratio
      [12] trade_count_today
      [13] time_of_day
    """

    STATE_DIM = 14
    WINDOW = 100  # candles kept in memory

    def __init__(self):
        self._closes: deque[float] = deque(maxlen=self.WINDOW)
        self._volumes: deque[float] = deque(maxlen=self.WINDOW)
        self._highs: deque[float] = deque(maxlen=self.WINDOW)
        self._lows: deque[float] = deque(maxlen=self.WINDOW)
        self._52w_high: float = 0.0
        self._52w_low: float = float("inf")

    # -- Feed incoming quote ----------------------------------------
    def update(self, quote: dict) -> None:
        """Call this every time a new quote arrives from the provider."""
        c = float(quote.get("close", quote.get("price", 0)))
        self._closes.append(c)
        self._volumes.append(float(quote.get("volume", 1)))
        self._highs.append(float(quote.get("high", c)))
        self._lows.append(float(quote.get("low", c)))
        self._52w_high = max(self._52w_high, c)
        self._52w_low = min(self._52w_low, c)

    # -- Build state vector -----------------------------------------
    def get_state(self, portfolio: dict) -> np.ndarray | None:
        """
        Returns a (14,) float32 array or None if not enough data yet.
        portfolio dict keys:
          position_flag      int   -- 1 long, 0 flat, -1 short
          unrealized_pnl_pct float -- e.g. 0.032 for +3.2%
          cash               float
          total_value        float
          trade_count_today  int
        """
        if len(self._closes) < 26:  # need at least 26 for MACD
            return None

        closes = np.array(self._closes, dtype=np.float64)
        volumes = np.array(self._volumes, dtype=np.float64)
        highs = np.array(self._highs, dtype=np.float64)
        lows = np.array(self._lows, dtype=np.float64)

        price = closes[-1]
        prev = closes[-2] if len(closes) > 1 else price

        # [0] price_normalized
        rng = self._52w_high - self._52w_low
        p_norm = (price - self._52w_low) / rng if rng > 0 else 0.5

        # [1] price_change_1
        pc1 = (price - prev) / prev if prev else 0.0

        # [2] price_change_5
        p5 = closes[-6] if len(closes) >= 6 else closes[0]
        pc5 = (price - p5) / p5 if p5 else 0.0

        # [3] volume_ratio
        vol_avg = volumes[-20:].mean() if len(volumes) >= 20 else volumes.mean()
        vol_ratio = volumes[-1] / vol_avg if vol_avg > 0 else 1.0

        # [4] RSI 14
        rsi = self._rsi(closes, 14)

        # [5] MACD histogram (clipped)
        macd_hist = self._macd(closes)

        # [6] Bollinger band position
        bb_pos = self._bb_position(closes, 20)

        # [7] EMA 9 vs EMA 21 cross
        ema9 = self._ema(closes, 9)
        ema21 = self._ema(closes, 21)
        ema_cross = 1.0 if ema9 > ema21 else -1.0

        # [8] ATR normalized
        atr = self._atr(highs, lows, closes, 14)
        atr_norm = atr / price if price > 0 else 0.0

        # [9-13] Portfolio features
        pos_flag = float(portfolio.get("position_flag", 0))
        pnl_pct = float(portfolio.get("unrealized_pnl_pct", 0.0))
        cash = float(portfolio.get("cash", 0.0))
        total = float(portfolio.get("total_value", 1.0))
        cash_ratio = cash / total if total > 0 else 1.0
        trade_today = float(portfolio.get("trade_count_today", 0)) / 10.0
        hour = datetime.now(timezone.utc).hour
        time_of_day = hour / 24.0

        state = np.array([
            p_norm, pc1, pc5, vol_ratio,
            rsi, macd_hist, bb_pos, ema_cross,
            atr_norm, pos_flag, pnl_pct,
            cash_ratio, trade_today, time_of_day,
        ], dtype=np.float32)

        return np.clip(state, -10.0, 10.0)

    # -- Indicator helpers ------------------------------------------
    @staticmethod
    def _ema(series: np.ndarray, period: int) -> float:
        k = 2.0 / (period + 1)
        ema = series[0]
        for v in series[1:]:
            ema = v * k + ema * (1 - k)
        return ema

    @staticmethod
    def _rsi(closes: np.ndarray, period: int = 14) -> float:
        if len(closes) < period + 1:
            return 0.5
        deltas = np.diff(closes[-(period + 1):])
        gains = deltas[deltas > 0].mean() if (deltas > 0).any() else 1e-9
        losses = -deltas[deltas < 0].mean() if (deltas < 0).any() else 1e-9
        rs = gains / losses
        return float(1 - 1 / (1 + rs))

    @staticmethod
    def _macd(closes: np.ndarray) -> float:
        def ema(s, p):
            k = 2.0 / (p + 1)
            e = s[0]
            for v in s[1:]:
                e = v * k + e * (1 - k)
            return e
        if len(closes) < 26:
            return 0.0
        macd_line = ema(closes, 12) - ema(closes, 26)
        return float(np.clip(macd_line / (closes[-1] + 1e-9), -1, 1))

    @staticmethod
    def _bb_position(closes: np.ndarray, period: int = 20) -> float:
        if len(closes) < period:
            return 0.5
        window = closes[-period:]
        mid = window.mean()
        std = window.std()
        upper = mid + 2 * std
        lower = mid - 2 * std
        rng = upper - lower
        return float((closes[-1] - lower) / rng) if rng > 0 else 0.5

    @staticmethod
    def _atr(highs, lows, closes, period: int = 14) -> float:
        if len(closes) < 2:
            return 0.0
        trs = []
        for i in range(1, min(period + 1, len(closes))):
            tr = max(
                highs[-i] - lows[-i],
                abs(highs[-i] - closes[-(i + 1)]),
                abs(lows[-i] - closes[-(i + 1)]),
            )
            trs.append(tr)
        return float(np.mean(trs)) if trs else 0.0
