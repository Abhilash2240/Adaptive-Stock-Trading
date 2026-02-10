"""
Twelve Data market-data adapter.

Polls the Twelve Data REST API for real-time price quotes and feeds
them into the internal Quote stream that the WebSocket and agent consume.

Docs: https://twelvedata.com/docs
"""

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Iterable
from datetime import datetime, timezone
from typing import Any

import httpx

from packages.data.provider import BaseAsyncProvider
from packages.shared.schemas import Quote

logger = logging.getLogger(__name__)

_BASE_URL = "https://api.twelvedata.com"


class TwelveDataProvider(BaseAsyncProvider):
    """Streams quotes by polling the Twelve Data /price endpoint."""

    name = "twelvedata"

    def __init__(
        self,
        api_key: str,
        symbols: Iterable[str] | None = None,
        interval: float = 5.0,
    ) -> None:
        super().__init__()
        if not api_key:
            raise ValueError("Twelve Data API key is required")
        self._api_key = api_key
        self._symbols: set[str] = {s.upper() for s in (symbols or ["AAPL"])}
        self._interval = max(interval, 60.0)  # free tier: 8 credits/min, 1 credit per symbol
        self._queue: asyncio.Queue[Quote] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None
        self._client: httpx.AsyncClient | None = None

    # ── lifecycle ──────────────────────────────────────────────

    async def start(self) -> None:
        await super().start()
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0))
        if self._task is None:
            self._task = asyncio.create_task(self._run())
        logger.info("TwelveDataProvider started for %s", self._symbols)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        if self._client is not None:
            await self._client.aclose()
            self._client = None
        await super().stop()

    async def subscribe(self, symbol: str, channel: str) -> None:
        self._symbols.add(symbol.upper())

    def _ensure_client(self) -> httpx.AsyncClient:
        """Lazily create the httpx client if it doesn't exist yet."""
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0))
        return self._client

    def stream_quotes(self) -> AsyncIterator[Quote]:
        async def iterator() -> AsyncIterator[Quote]:
            while True:
                quote = await self._queue.get()
                yield quote

        return iterator()

    # ── internal polling loop ─────────────────────────────────

    async def _run(self) -> None:
        client = self._ensure_client()
        cooldown_until = 0.0
        try:
            while True:
                now = asyncio.get_event_loop().time()
                if now < cooldown_until:
                    await asyncio.sleep(cooldown_until - now)
                    continue

                if not self._symbols:
                    await asyncio.sleep(self._interval)
                    continue

                # Twelve Data allows a comma-separated batch in /price
                batch = ",".join(sorted(self._symbols))
                try:
                    quotes = await self._fetch_prices(batch)
                    for q in quotes:
                        await self._queue.put(q)
                except httpx.HTTPStatusError as exc:
                    status_code = exc.response.status_code
                    logger.warning("Twelve Data HTTP %s", status_code)
                    if status_code == 429:
                        retry_after = exc.response.headers.get("Retry-After")
                        wait = float(retry_after) if retry_after else 60.0
                        cooldown_until = asyncio.get_event_loop().time() + wait
                except httpx.HTTPError as exc:
                    logger.debug("Twelve Data HTTP error: %s", exc)
                except Exception as exc:
                    logger.debug("Twelve Data fetch failed: %s", exc)

                await asyncio.sleep(self._interval)
        except asyncio.CancelledError:
            return

    # ── REST helpers ──────────────────────────────────────────

    async def _fetch_prices(self, symbols_csv: str) -> list[Quote]:
        """
        GET /price?symbol=AAPL,MSFT&apikey=xxx
        Single symbol → {"price":"150.42"}
        Multiple symbols → {"AAPL":{"price":"150.42"}, "MSFT":{"price":"310.11"}}
        """
        client = self._ensure_client()
        url = f"{_BASE_URL}/price"
        resp = await client.get(url, params={"symbol": symbols_csv, "apikey": self._api_key})
        resp.raise_for_status()
        data = resp.json()

        results: list[Quote] = []
        now = datetime.now(timezone.utc)

        if "price" in data:
            # Single symbol response
            symbol = symbols_csv.split(",")[0]
            results.append(
                Quote(
                    symbol=symbol,
                    price=float(data["price"]),
                    volume=0,
                    timestamp=now,
                )
            )
        else:
            # Multi-symbol response
            for sym, payload in data.items():
                if not isinstance(payload, dict) or "price" not in payload:
                    continue
                results.append(
                    Quote(
                        symbol=sym.upper(),
                        price=float(payload["price"]),
                        volume=0,
                        timestamp=now,
                    )
                )

        return results

    async def fetch_quote_detail(self, symbol: str) -> dict[str, Any]:
        """
        GET /quote?symbol=AAPL&apikey=xxx
        Returns richer data: open, high, low, close, volume, change, etc.
        Used by the /api/quote REST endpoint.
        """
        client = self._ensure_client()
        url = f"{_BASE_URL}/quote"
        resp = await client.get(url, params={"symbol": symbol.upper(), "apikey": self._api_key})
        resp.raise_for_status()
        return resp.json()

    async def fetch_stocks_list(
        self,
        symbol: str | None = None,
        exchange: str | None = None,
        country: str | None = None,
        stock_type: str | None = None,
    ) -> dict[str, Any]:
        """
        GET /stocks?apikey=xxx[&symbol=...&exchange=...&country=...&type=...]
        Returns list of all available stock symbols.
        """
        client = self._ensure_client()
        url = f"{_BASE_URL}/stocks"
        params: dict[str, str] = {"apikey": self._api_key}
        if symbol:
            params["symbol"] = symbol.upper()
        if exchange:
            params["exchange"] = exchange
        if country:
            params["country"] = country
        if stock_type:
            params["type"] = stock_type
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()
