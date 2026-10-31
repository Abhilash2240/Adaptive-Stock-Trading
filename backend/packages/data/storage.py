"""
storage.py — Market Data Persistence Service
============================================
Handles high-throughput, non-blocking storage of real-time stock quotes (QuoteDB)
and historical daily candles (OHLCVDB) into PostgreSQL/SQLite.

Provides:
  - Batching and background flush loop to prevent DB bottlenecks on fast quote ticks.
  - Direct single-quote and OHLCV recording for REST endpoints.
  - Automated syncing of daily historical stock prices from Twelve Data (or realistic mock).
  - Query helpers to feed stored stock prices into agent training pipelines.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Sequence

from packages.data.provider import DataProvider, get_data_provider
from packages.db.engine import get_session_ctx
from packages.db.models import QuoteDB, OHLCVDB
from packages.db.repositories import QuoteRepository, OHLCVRepository
from packages.shared.config import get_settings
from packages.shared.schemas import Quote

logger = logging.getLogger(__name__)


class QuoteStorageService:
    """
    Asynchronous stock price persistence service.
    Buffers incoming quotes in memory and writes them in batches to the database.
    """

    def __init__(
        self,
        batch_size: int = 25,
        flush_interval_seconds: float = 2.0,
        provider: DataProvider | None = None,
    ) -> None:
        self.batch_size = max(1, batch_size)
        self.flush_interval_seconds = max(0.5, flush_interval_seconds)
        self._provider = provider
        self._buffer: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()
        self._flush_event = asyncio.Event()
        self._worker_task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        """Start the background persistence worker loop."""
        if self._running:
            return
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info(
            "QuoteStorageService started (batch_size=%d, interval=%.1fs)",
            self.batch_size,
            self.flush_interval_seconds,
        )

    async def stop(self) -> None:
        """Flush any remaining items and stop the worker task."""
        self._running = False
        self._flush_event.set()
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
        # Final flush
        await self.flush()
        logger.info("QuoteStorageService stopped")

    async def record_quote(self, quote: dict[str, Any] | Quote) -> None:
        """
        Add a quote tick to the queue for batched database persistence.
        Never blocks the streaming loop.
        """
        if isinstance(quote, Quote):
            payload = {
                "symbol": quote.symbol.upper(),
                "price": float(quote.price),
                "volume": int(quote.volume),
                "timestamp": quote.timestamp or datetime.now(timezone.utc),
            }
        else:
            ts = quote.get("timestamp")
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except ValueError:
                    ts = datetime.now(timezone.utc)
            elif not isinstance(ts, datetime):
                ts = datetime.now(timezone.utc)

            symbol = str(quote.get("symbol") or "").strip().upper()
            if not symbol:
                return

            payload = {
                "symbol": symbol,
                "price": float(quote.get("price") or quote.get("close") or 0.0),
                "volume": int(float(quote.get("volume") or 0)),
                "timestamp": ts,
            }

        async with self._lock:
            self._buffer.append(payload)
            if len(self._buffer) >= self.batch_size:
                self._flush_event.set()

    async def flush(self) -> int:
        """
        Drain the in-memory buffer and insert rows into the quotes table.
        Returns the number of rows written.
        """
        async with self._lock:
            if not self._buffer:
                return 0
            items_to_write = list(self._buffer)
            self._buffer.clear()
            self._flush_event.clear()

        try:
            async with get_session_ctx() as session:
                repo = QuoteRepository(session)
                await repo.insert_batch(items_to_write)
            logger.debug("Persisted %d stock quotes to database", len(items_to_write))
            return len(items_to_write)
        except Exception as exc:
            logger.warning("Failed to flush %d quotes to database: %s", len(items_to_write), exc)
            # Re-queue items up to a safe limit to avoid data loss on temporary DB hitch
            async with self._lock:
                if len(self._buffer) < 1000:
                    self._buffer = items_to_write + self._buffer
            return 0

    async def _worker_loop(self) -> None:
        """Background worker that flushes on timer or batch fill."""
        while self._running:
            try:
                try:
                    await asyncio.wait_for(
                        self._flush_event.wait(),
                        timeout=self.flush_interval_seconds,
                    )
                except asyncio.TimeoutError:
                    pass

                self._flush_event.clear()
                if self._buffer:
                    await self.flush()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in QuoteStorageService worker loop: %s", exc)
                await asyncio.sleep(1.0)

    async def store_quote_direct(
        self,
        symbol: str,
        price: float,
        volume: int = 0,
        open_price: float | None = None,
        high: float | None = None,
        low: float | None = None,
        timestamp: datetime | None = None,
    ) -> None:
        """
        Store a quote directly to the database without waiting for batching.
        Also persists to OHLCV if candle fields are supplied.
        """
        ts = timestamp or datetime.now(timezone.utc)
        sym = symbol.strip().upper()
        try:
            async with get_session_ctx() as session:
                quote_repo = QuoteRepository(session)
                await quote_repo.insert(
                    symbol=sym,
                    price=float(price),
                    volume=int(volume),
                    timestamp=ts,
                )

                if open_price is not None and high is not None and low is not None:
                    ohlcv_repo = OHLCVRepository(session)
                    await ohlcv_repo.insert(
                        symbol=sym,
                        open=float(open_price),
                        high=float(high),
                        low=float(low),
                        close=float(price),
                        volume=int(volume),
                        timestamp=ts,
                    )
        except Exception as exc:
            logger.warning("Failed to directly store quote for %s: %s", sym, exc)

    async def sync_daily_prices(self, symbol: str, days: int = 30) -> int:
        """
        Fetch daily historical OHLCV stock prices and store them in the database.
        Uses TwelveData if available, falls back to realistic mock generator.
        """
        sym = symbol.strip().upper()
        provider = self._provider or get_data_provider()
        candles: list[dict[str, Any]] = []

        # 1. Try TwelveData if provider supports time series
        if hasattr(provider, "fetch_time_series"):
            try:
                candles = await provider.fetch_time_series(symbol=sym, interval="1day", outputsize=days)
            except Exception as exc:
                logger.warning("TwelveData time series fetch failed for %s (%s) — falling back", sym, exc)

        # 2. Try Mock Provider
        if not candles and hasattr(provider, "generate_daily_series"):
            candles = provider.generate_daily_series(symbol=sym, days=days)

        # 3. Fallback generator if neither worked
        if not candles:
            from datetime import timedelta
            import random
            now = datetime.now(timezone.utc)
            base_price = 150.0 + (hash(sym) % 100)
            candles = []
            cur = base_price
            for i in range(days):
                d = now - timedelta(days=days - 1 - i)
                cur = max(10.0, cur + random.uniform(-2.5, 2.5))
                h = round(cur + random.uniform(0.5, 3.0), 2)
                l = round(cur - random.uniform(0.5, 3.0), 2)
                o = round(cur + random.uniform(-1.0, 1.0), 2)
                c = round(cur, 2)
                candles.append({
                    "symbol": sym,
                    "open": o,
                    "high": max(h, o, c),
                    "low": min(l, o, c),
                    "close": c,
                    "volume": random.randint(1_000_000, 10_000_000),
                    "timestamp": d,
                })

        if not candles:
            return 0

        # Persist to both OHLCVDB and QuoteDB tables
        async with get_session_ctx() as session:
            ohlcv_repo = OHLCVRepository(session)
            quote_repo = QuoteRepository(session)

            await ohlcv_repo.insert_batch(candles)

            # Also create corresponding quote ticks for each candle close
            quote_rows = [
                {
                    "symbol": sym,
                    "price": float(c["close"]),
                    "volume": int(c.get("volume", 0)),
                    "timestamp": c["timestamp"],
                }
                for c in candles
            ]
            await quote_repo.insert_batch(quote_rows)

        logger.info("Successfully synced and stored %d daily stock prices for %s in DB", len(candles), sym)
        return len(candles)

    async def get_stored_prices(
        self,
        symbol: str,
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        """Fetch chronologically ascending stock prices from database for a symbol."""
        sym = symbol.strip().upper()
        async with get_session_ctx() as session:
            # Check OHLCV first
            ohlcv_repo = OHLCVRepository(session)
            candles = await ohlcv_repo.get_history(symbol=sym, limit=limit)
            if candles and len(candles) >= 5:
                return [
                    {
                        "symbol": c.symbol,
                        "open": c.open,
                        "high": c.high,
                        "low": c.low,
                        "close": c.close,
                        "price": c.close,
                        "volume": c.volume,
                        "timestamp": c.timestamp,
                    }
                    for c in candles
                ]

            # Otherwise return QuoteDB records
            quote_repo = QuoteRepository(session)
            quotes = await quote_repo.get_history(symbol=sym, limit=limit)
            return [
                {
                    "symbol": q.symbol,
                    "open": q.price,
                    "high": q.price,
                    "low": q.price,
                    "close": q.price,
                    "price": q.price,
                    "volume": q.volume,
                    "timestamp": q.timestamp,
                }
                for q in quotes
            ]

    async def get_stored_stats(self) -> dict[str, Any]:
        """Return counts of quotes and OHLCV rows stored in the database."""
        async with get_session_ctx() as session:
            q_repo = QuoteRepository(session)
            o_repo = OHLCVRepository(session)
            q_count = await q_repo.count()
            o_count = await o_repo.count()
            return {
                "quotes_count": q_count,
                "ohlcv_count": o_count,
                "buffered_in_memory": len(self._buffer),
            }


_storage_service: QuoteStorageService | None = None


def get_storage_service() -> QuoteStorageService:
    """Return the global QuoteStorageService instance."""
    global _storage_service
    if _storage_service is None:
        settings = get_settings()
        _storage_service = QuoteStorageService(
            batch_size=settings.quote_batch_size,
            flush_interval_seconds=settings.quote_flush_interval_seconds,
            provider=get_data_provider(),
        )
    return _storage_service


def reset_storage_service() -> None:
    """Reset the global QuoteStorageService instance."""
    global _storage_service
    _storage_service = None

