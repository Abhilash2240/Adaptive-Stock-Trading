"""
feature_engine.py — Market Feature Extractor (14-dim state vector)
===================================================================
Fixes (from deep-dive doc):
  § "No normalization persistence across restarts" — rolling stats
    (52-week high / low) reset every time the process restarted, making
    the price_normalized feature meaningless after a cold start.

Fix:
  FeatureEngine.save_stats(symbol) serialises _52w_high and _52w_low to
  a small JSON sidecar file in models/feature_stats_<SYMBOL>.json.
  FeatureEngine.load_stats(symbol) reloads them on startup, so the
  agent continues with the same normalisation reference it trained on.

State vector layout (unchanged — 14 dims):
  [0]  price_normalized   (price - 52w_low) / (52w_high - 52w_low)
  [1]  price_change_1     1-tick % return
  [2]  price_change_5     5-tick % return
  [3]  volume_ratio       volume / 20-tick avg volume
  [4]  rsi_14             RSI(14)
  [5]  macd_histogram     MACD(12,26) / price, clipped +-1
  [6]  bb_position        Bollinger Band(20) position 0..1
  [7]  ema_9_cross_21     +1 if EMA9 > EMA21, else -1
  [8]  atr_normalized     ATR(14) / price
  [9]  position_flag      +1 long / 0 flat / -1 short
  [10] unrealized_pnl_pct unrealized P&L %
  [11] cash_ratio         cash / total_portfolio_value
  [12] trade_count_today  trade_count / 10 (normalised)
  [13] time_of_day        utc_hour / 24
All values clipped to [-10, 10].
"""
from __future__ import annotations

import json
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


class FeatureEngine:
    """
    Converts raw OHLCV quotes + portfolio state into the
    14-dimensional state vector the DDQN agent expects.
    """

    STATE_DIM = 14
    WINDOW = 100

    def __init__(self) -> None:
        self._closes:  deque[float] = deque(maxlen=self.WINDOW)
        self._volumes: deque[float] = deque(maxlen=self.WINDOW)
        self._highs:   deque[float] = deque(maxlen=self.WINDOW)
        self._lows:    deque[float] = deque(maxlen=self.WINDOW)
        self._52w_high: float = 0.0
        self._52w_low:  float = float("inf")

    # ------------------------------------------------------------------
    # Feed quote
    # ------------------------------------------------------------------

    def update(self, quote: dict) -> None:
        c = float(quote.get("close", quote.get("price", 0)))
        self._closes.append(c)
        self._volumes.append(float(quote.get("volume", 1)))
        self._highs.append(float(quote.get("high", c)))
        self._lows.append(float(quote.get("low", c)))
        self._52w_high = max(self._52w_high, c)
        self._52w_low  = min(self._52w_low, c)

    # ------------------------------------------------------------------
    # Build state vector
    # ------------------------------------------------------------------

    def get_state(self, portfolio: dict) -> np.ndarray | None:
        if len(self._closes) < 26:
            return None

        closes  = np.array(self._closes,  dtype=np.float64)
        volumes = np.array(self._volumes, dtype=np.float64)
        highs   = np.array(self._highs,   dtype=np.float64)
        lows    = np.array(self._lows,    dtype=np.float64)

        price = closes[-1]
        prev  = closes[-2] if len(closes) > 1 else price

        rng   = self._52w_high - self._52w_low
        p_norm = (price - self._52w_low) / rng if rng > 0 else 0.5

        pc1 = (price - prev) / prev if prev else 0.0
        p5  = closes[-6] if len(closes) >= 6 else closes[0]
        pc5 = (price - p5) / p5 if p5 else 0.0

        vol_avg   = volumes[-20:].mean() if len(volumes) >= 20 else volumes.mean()
        vol_ratio = volumes[-1] / vol_avg if vol_avg > 0 else 1.0

        rsi      = self._rsi(closes, 14)
        macd_h   = self._macd(closes)
        bb_pos   = self._bb_position(closes, 20)
        ema9     = self._ema(closes, 9)
        ema21    = self._ema(closes, 21)
        ema_x    = 1.0 if ema9 > ema21 else -1.0
        atr      = self._atr(highs, lows, closes, 14)
        atr_norm = atr / price if price > 0 else 0.0

        pos_flag   = float(portfolio.get("position_flag", 0))
        pnl_pct    = float(portfolio.get("unrealized_pnl_pct", 0.0))
        cash       = float(portfolio.get("cash", 0.0))
        total      = float(portfolio.get("total_value", 1.0))
        cash_ratio = cash / total if total > 0 else 1.0
        trades_n   = float(portfolio.get("trade_count_today", 0)) / 10.0
        tod        = datetime.now(timezone.utc).hour / 24.0

        state = np.array([
            p_norm, pc1, pc5, vol_ratio,
            rsi, macd_h, bb_pos, ema_x,
            atr_norm, pos_flag, pnl_pct,
            cash_ratio, trades_n, tod,
        ], dtype=np.float32)
        return np.clip(state, -10.0, 10.0)

    # ------------------------------------------------------------------
    # Persistence — fix for "No normalization persistence across restarts"
    # ------------------------------------------------------------------

    @staticmethod
    def _stats_path(symbol: str) -> Path:
        return Path("models") / f"feature_stats_{symbol.upper()}.json"

    def save_stats(self, symbol: str) -> None:
        """Persist 52-week high/low so they survive process restarts."""
        path = self._stats_path(symbol)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "52w_high": self._52w_high,
            "52w_low":  self._52w_low if self._52w_low != float("inf") else 0.0,
        }
        path.write_text(json.dumps(data))

    def load_stats(self, symbol: str) -> None:
        """Reload 52-week high/low from disk (call once on startup)."""
        path = self._stats_path(symbol)
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text())
            high = float(data.get("52w_high", 0.0))
            low  = float(data.get("52w_low",  float("inf")))
            if high > 0:
                self._52w_high = max(self._52w_high, high)
            if low < float("inf") and low > 0:
                self._52w_low = min(self._52w_low, low)
        except (json.JSONDecodeError, ValueError):
            pass   # corrupt file — start fresh

    # ------------------------------------------------------------------
    # Indicator helpers (unchanged)
    # ------------------------------------------------------------------

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
        gains  = deltas[deltas > 0].mean() if (deltas > 0).any() else 1e-9
        losses = -deltas[deltas < 0].mean() if (deltas < 0).any() else 1e-9
        return float(1 - 1 / (1 + gains / losses))

    @staticmethod
    def _macd(closes: np.ndarray) -> float:
        def ema(s, p):
            k, e = 2.0 / (p + 1), s[0]
            for v in s[1:]:
                e = v * k + e * (1 - k)
            return e
        if len(closes) < 26:
            return 0.0
        line = ema(closes, 12) - ema(closes, 26)
        return float(np.clip(line / (closes[-1] + 1e-9), -1, 1))

    @staticmethod
    def _bb_position(closes: np.ndarray, period: int = 20) -> float:
        if len(closes) < period:
            return 0.5
        w   = closes[-period:]
        mid = w.mean()
        std = w.std()
        rng = 4 * std
        return float((closes[-1] - (mid - 2 * std)) / rng) if rng > 0 else 0.5

    @staticmethod
    def _atr(highs, lows, closes, period: int = 14) -> float:
        if len(closes) < 2:
            return 0.0
        trs = [
            max(highs[-i] - lows[-i],
                abs(highs[-i] - closes[-(i + 1)]),
                abs(lows[-i]  - closes[-(i + 1)]))
            for i in range(1, min(period + 1, len(closes)))
        ]
        return float(np.mean(trs)) if trs else 0.0
