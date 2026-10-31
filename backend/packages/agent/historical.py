"""
historical.py — Historical Data Sources for Offline Training
=============================================================
Fixes (from deep-dive doc):
  § "No historical data source" — manual training used np.random.randn noise.
  § "Manual training button seeds with random noise" — this module provides
    real (CSV) and clearly-labelled synthetic (GBM) alternatives.

Three classes:

  CSVDataLoader        Load real OHLCV from a CSV file.
                       Required columns: date (or timestamp), open, high,
                       low, close, volume.  Rows returned chronologically.

  GBMDataGenerator     ⚠ SYNTHETIC DATA — NOT FOR REAL TRAINING ⚠
                       Geometric Brownian Motion price paths for pipeline
                       smoke-tests only.  Never pass this to a live agent.

  HistoricalDataPipeline
                       Wraps either loader and provides a CHRONOLOGICAL
                       (never shuffled) train/val split.  Exposes .train
                       and .val as lists of quote dicts ready to feed into
                       TradingEnvironment.on_quote().

Stubs for yfinance / Alpha Vantage are included but raise NotImplementedError
so their wiring is visible without accidentally being used in production.
"""
from __future__ import annotations

import csv
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# CSV Loader
# ---------------------------------------------------------------------------

class CSVDataLoader:
    """
    Load OHLCV data from a CSV file.

    Accepted column names (case-insensitive):
      date / timestamp / datetime  → date field
      open, high, low, close       → price fields
      volume                       → volume field

    Returns a list of dicts sorted oldest-first, each with keys:
      symbol, price (=close), open, high, low, close, volume, timestamp
    """

    _DATE_ALIASES = {"date", "timestamp", "datetime", "time"}
    _PRICE_COLS   = {"open", "high", "low", "close"}

    def __init__(self, filepath: str, symbol: str = "UNKNOWN") -> None:
        self.filepath = Path(filepath)
        self.symbol = symbol.upper()
        if not self.filepath.exists():
            raise FileNotFoundError(self.filepath)

    def load(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        with self.filepath.open(newline="") as f:
            reader = csv.DictReader(f)
            headers = {h.lower().strip(): h for h in (reader.fieldnames or [])}
            date_col = next(
                (headers[k] for k in self._DATE_ALIASES if k in headers), None
            )
            for raw in reader:
                row = {k.lower().strip(): v for k, v in raw.items()}
                try:
                    close = float(row["close"])
                    volume = int(float(row.get("volume", 0)))
                    ts = self._parse_date(row.get(date_col.lower() if date_col else "", ""))
                    rows.append({
                        "symbol":    self.symbol,
                        "price":     close,
                        "close":     close,
                        "open":      float(row.get("open", close)),
                        "high":      float(row.get("high", close)),
                        "low":       float(row.get("low", close)),
                        "volume":    volume,
                        "timestamp": ts,
                    })
                except (ValueError, KeyError):
                    continue   # skip malformed rows

        rows.sort(key=lambda r: r["timestamp"])
        return rows

    @staticmethod
    def _parse_date(s: str) -> datetime:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(s.strip(), fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# GBM synthetic generator  ⚠  NOT FOR REAL TRAINING
# ---------------------------------------------------------------------------

class GBMDataGenerator:
    """
    ⚠  SYNTHETIC DATA — NOT FOR REAL TRAINING ⚠
    ============================================
    Generates price paths using Geometric Brownian Motion:
        S(t+1) = S(t) * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
    where Z ~ N(0,1).

    Use ONLY for smoke-testing the data pipeline (verifying that
    HistoricalDataPipeline, FeatureEngine, and TradingEnvironment wire up
    correctly).  Do NOT use to train an agent that will trade real money.
    The model would learn to exploit properties of GBM that do not exist
    in real markets (e.g. the Markov property holds exactly in GBM).
    """

    LABEL = "GBM_SYNTHETIC__NOT_FOR_REAL_TRAINING"

    def __init__(
        self,
        symbol: str = "SYNTHETIC",
        s0: float = 150.0,
        mu: float = 0.0001,    # drift per step
        sigma: float = 0.02,   # volatility per step
        n: int = 2_000,        # number of steps
        dt: float = 1.0,
        seed: int = 42,
    ) -> None:
        self.symbol = symbol.upper()
        self.s0 = s0
        self.mu = mu
        self.sigma = sigma
        self.n = n
        self.dt = dt
        self.seed = seed

    def generate(self) -> list[dict[str, Any]]:
        rng = random.Random(self.seed)
        prices = [self.s0]
        for _ in range(self.n - 1):
            z = self._box_muller(rng)
            drift = (self.mu - 0.5 * self.sigma ** 2) * self.dt
            shock = self.sigma * math.sqrt(self.dt) * z
            prices.append(prices[-1] * math.exp(drift + shock))

        base = datetime(2020, 1, 1, tzinfo=timezone.utc)
        quotes = []
        for i, price in enumerate(prices):
            spread = price * 0.002
            high   = price + abs(self._box_muller(rng)) * spread
            low    = price - abs(self._box_muller(rng)) * spread
            open_  = prices[i - 1] if i > 0 else price
            quotes.append({
                "symbol":    self.symbol,
                "price":     price,
                "close":     price,
                "open":      open_,
                "high":      high,
                "low":       max(low, price * 0.95),
                "volume":    max(1, int(rng.gauss(1_000_000, 200_000))),
                "timestamp": base + timedelta(minutes=i),
                "_synthetic": self.LABEL,
            })
        return quotes

    @staticmethod
    def _box_muller(rng: random.Random) -> float:
        u1 = rng.random() or 1e-10
        u2 = rng.random()
        return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


# ---------------------------------------------------------------------------
# Stubs for real providers (not implemented — intentional)
# ---------------------------------------------------------------------------

def load_from_yfinance(symbol: str, period: str = "2y") -> list[dict]:
    """
    Stub — wire up yfinance here when ready.
    Install: pip install yfinance
    Uncomment and implement before using in production.
    """
    raise NotImplementedError(
        "yfinance provider not yet wired up.  "
        "See README_FIXES.md §High-Impact / Historical Provider."
    )


def load_from_alpha_vantage(symbol: str, api_key: str) -> list[dict]:
    """Stub — Alpha Vantage TIME_SERIES_DAILY_ADJUSTED."""
    raise NotImplementedError(
        "Alpha Vantage provider not yet wired up.  "
        "See README_FIXES.md §High-Impact / Historical Provider."
    )


# ---------------------------------------------------------------------------
# Pipeline with chronological train/val split
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Database Loader — loads real stored prices from QuoteDB / OHLCVDB
# ---------------------------------------------------------------------------

class DatabaseDataLoader:
    """
    Load stock prices from PostgreSQL/SQLite database for RL training.
    Queries stored OHLCV candles or Quote ticks chronologically.
    """

    def __init__(self, quotes: list[dict[str, Any]], symbol: str = "UNKNOWN") -> None:
        self.quotes = quotes
        self.symbol = symbol.upper()

    def load(self) -> list[dict[str, Any]]:
        return self.quotes

    @classmethod
    async def load_from_db(
        cls,
        session: Any,
        symbol: str,
        limit: int = 1000,
        prefer_ohlcv: bool = True,
    ) -> list[dict[str, Any]]:
        from packages.db.repositories import OHLCVRepository, QuoteRepository

        sym = symbol.strip().upper()
        if prefer_ohlcv:
            ohlcv_repo = OHLCVRepository(session)
            candles = await ohlcv_repo.get_history(symbol=sym, limit=limit)
            if candles and len(candles) >= 10:
                return [
                    {
                        "symbol": c.symbol,
                        "price": float(c.close),
                        "close": float(c.close),
                        "open": float(c.open),
                        "high": float(c.high),
                        "low": float(c.low),
                        "volume": int(c.volume),
                        "timestamp": c.timestamp,
                        "_source": "database_ohlcv",
                    }
                    for c in candles
                ]

        quote_repo = QuoteRepository(session)
        quotes = await quote_repo.get_history(symbol=sym, limit=limit)
        if quotes:
            return [
                {
                    "symbol": q.symbol,
                    "price": float(q.price),
                    "close": float(q.price),
                    "open": float(q.price),
                    "high": float(q.price),
                    "low": float(q.price),
                    "volume": int(q.volume),
                    "timestamp": q.timestamp,
                    "_source": "database_quotes",
                }
                for q in quotes
            ]

        return []


class HistoricalDataPipeline:
    """
    Wraps a list of quote dicts (from CSVDataLoader or GBMDataGenerator)
    and splits them chronologically.  NEVER shuffles — shuffling would
    create look-ahead bias and leak future data into training.

    Attributes:
      .train  list[dict]  — older portion (default 80%)
      .val    list[dict]  — newer held-out portion (default 20%)
      .is_synthetic bool  — True if source is GBM, warns loudly
    """

    def __init__(
        self,
        quotes: list[dict],
        val_fraction: float = 0.2,
    ) -> None:
        if not quotes:
            raise ValueError("quotes list is empty")
        if not 0 < val_fraction < 1:
            raise ValueError("val_fraction must be in (0, 1)")

        self.is_synthetic = bool(quotes[0].get("_synthetic"))
        if self.is_synthetic:
            import warnings
            warnings.warn(
                "HistoricalDataPipeline is using SYNTHETIC GBM data. "
                "This is only valid for pipeline smoke-tests.",
                UserWarning,
                stacklevel=2,
            )

        split = int(len(quotes) * (1.0 - val_fraction))
        self.train = quotes[:split]
        self.val   = quotes[split:]

    def __repr__(self) -> str:
        tag = "SYNTHETIC" if self.is_synthetic else ("database" if quotes[0].get("_source", "").startswith("database") else "real")
        return (
            f"HistoricalDataPipeline({tag}, "
            f"train={len(self.train)}, val={len(self.val)})"
        )
