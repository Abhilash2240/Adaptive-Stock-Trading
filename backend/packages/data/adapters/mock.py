import asyncio
import random
from collections.abc import AsyncIterator, Iterable
from datetime import datetime, timezone

from packages.data.provider import BaseAsyncProvider
from packages.shared.schemas import Quote


class MockDataProvider(BaseAsyncProvider):
    """Simple random-walk quote stream for local development."""

    name = "mock"

    def __init__(self, symbols: Iterable[str] | None = None, interval: float = 1.0) -> None:
        super().__init__()
        self._symbols: list[str] = [s.upper() for s in (symbols or ["AAPL"])]
        self._interval = max(interval, 0.2)
        self._queue: asyncio.Queue[Quote] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None
        self._prices: dict[str, float] = {
            symbol: random.uniform(100.0, 300.0) for symbol in self._symbols
        }

    async def start(self) -> None:
        await super().start()
        if self._task is None:
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        await super().stop()

    async def subscribe(self, symbol: str, channel: str) -> None:
        normalized = symbol.upper()
        if normalized not in self._symbols:
            self._symbols.append(normalized)
            self._prices[normalized] = random.uniform(100.0, 300.0)

    def stream_quotes(self) -> AsyncIterator[Quote]:
        async def iterator() -> AsyncIterator[Quote]:
            while True:
                yield await self._queue.get()

        return iterator()

    async def _run(self) -> None:
        while True:
            now = datetime.now(timezone.utc)
            for symbol in self._symbols:
                last = self._prices.get(symbol, 100.0)
                step = random.uniform(-1.2, 1.2)
                next_price = max(1.0, last + step)
                self._prices[symbol] = next_price
                await self._queue.put(
                    Quote(symbol=symbol, price=round(next_price, 2), volume=random.randint(1000, 50000), timestamp=now)
                )
            await asyncio.sleep(self._interval)
