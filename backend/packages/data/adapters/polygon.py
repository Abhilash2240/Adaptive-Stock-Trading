import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Iterable
from datetime import datetime, timezone
from typing import Any

import httpx

from packages.data.provider import BaseAsyncProvider
from packages.shared.schemas import Quote, Symbol

logger = logging.getLogger(__name__)


class PolygonProvider(BaseAsyncProvider):
    name = "polygon"

    def __init__(
        self,
        api_key: str,
        symbols: Iterable[str] | None = None,
        interval: float = 1.0,
    ) -> None:
        super().__init__()
        if not api_key:
            raise ValueError("Polygon API key is required")
        self._api_key = api_key
        self._symbols: set[str] = {symbol.upper() for symbol in (symbols or ["AAPL"])}
        self._interval = interval
        self._queue: asyncio.Queue[Quote] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        await super().start()
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=5.0))
        if self._task is None:
            self._task = asyncio.create_task(self._run())

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

    def stream_quotes(self) -> AsyncIterator[Quote]:
        async def iterator() -> AsyncIterator[Quote]:
            while True:
                quote = await self._queue.get()
                yield quote

        return iterator()

    async def _run(self) -> None:
        assert self._client is not None
        try:
            cooldown_until = 0.0
            while True:
                now = asyncio.get_event_loop().time()
                if now < cooldown_until:
                    await asyncio.sleep(cooldown_until - now)
                    continue

                if not self._symbols:
                    await asyncio.sleep(self._interval)
                    continue

                for symbol in list(self._symbols):
                    try:
                        quote = await self._fetch_last_trade(symbol)
                    except httpx.HTTPStatusError as exc:
                        status = exc.response.status_code
                        logger.warning("Polygon HTTP %s for %s", status, symbol)
                        if status == 429:
                            retry_after = exc.response.headers.get("Retry-After")
                            if retry_after is not None:
                                try:
                                    cooldown_until = max(cooldown_until, now + float(retry_after))
                                except ValueError:
                                    cooldown_until = max(cooldown_until, now + 60.0)
                            else:
                                cooldown_until = max(cooldown_until, now + 60.0)
                        continue
                    except httpx.HTTPError as exc:
                        logger.debug("Polygon HTTP error for %s: %s", symbol, exc)
                        continue
                    except Exception as exc:  # pragma: no cover - network error handling
                        logger.debug("Polygon fetch failed for %s: %s", symbol, exc)
                        continue
                    if quote is not None:
                        await self._queue.put(quote)
                await asyncio.sleep(self._interval)
        except asyncio.CancelledError:
            return

    async def _fetch_last_trade(self, symbol: str) -> Quote | None:
        assert self._client is not None
        url = f"https://api.polygon.io/v2/last/trade/{symbol}"
        response = await self._client.get(url, params={"apiKey": self._api_key})
        response.raise_for_status()
        payload = response.json()
        data = self._extract_trade(payload)
        if data is None:
            return None
        try:
            symbol_enum = Symbol(data["symbol"])
        except ValueError:
            return None
        return Quote(
            symbol=symbol_enum,
            price=data["price"],
            volume=data["size"],
            timestamp=data["timestamp"],
        )

    @staticmethod
    def _extract_trade(payload: dict[str, Any]) -> dict[str, Any] | None:
        result = payload.get("results") or payload.get("result") or payload.get("last")
        if not result:
            return None
        price = result.get("p") or result.get("price")
        size = result.get("s") or result.get("size") or 0
        timestamp_value = result.get("t") or result.get("timestamp")
        if price is None or timestamp_value is None:
            return None
        if isinstance(timestamp_value, (int, float)):
            # Polygon timestamps are often in nanoseconds
            timestamp = datetime.fromtimestamp(timestamp_value / 1_000_000_000, tz=timezone.utc)
        else:
            timestamp = datetime.now(timezone.utc)
        symbol = result.get("T") or result.get("symbol")
        if symbol is None:
            return None
        return {
            "symbol": symbol,
            "price": float(price),
            "size": int(size),
            "timestamp": timestamp,
        }
