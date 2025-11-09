import asyncio
import contextlib
import math
import random
from collections.abc import AsyncIterator, Sequence
from datetime import datetime, timezone

from packages.data.provider import BaseAsyncProvider
from packages.shared.schemas import Quote, Symbol


class MockProvider(BaseAsyncProvider):
    name = "mock"

    def __init__(self, symbols: Sequence[Symbol] | None = None, interval: float = 1.0) -> None:
        super().__init__()
        self._queue: asyncio.Queue[Quote] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None
        self._interval = interval
        initial = list(symbols or [Symbol.AAPL])
        self._symbols: set[Symbol] = set(initial)
        self._angles: dict[Symbol, float] = {symbol: random.uniform(0, 2 * math.pi) for symbol in initial}

    async def start(self) -> None:
        await super().start()
        if self._task is None:
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        await super().stop()

    async def subscribe(self, symbol: str, channel: str) -> None:
        try:
            symbol_enum = Symbol(symbol.upper())
        except ValueError:
            return None
        if symbol_enum not in self._symbols:
            self._symbols.add(symbol_enum)
            self._angles[symbol_enum] = random.uniform(0, 2 * math.pi)
        return None

    def stream_quotes(self) -> AsyncIterator[Quote]:
        async def iterator() -> AsyncIterator[Quote]:
            while True:
                quote = await self._queue.get()
                yield quote

        return iterator()

    async def _run(self) -> None:
        try:
            while True:
                await asyncio.sleep(self._interval)
                for symbol in list(self._symbols):
                    self._angles[symbol] = self._angles.get(symbol, 0.0) + random.uniform(0.05, 0.15)
                    base_price = 150 + 10 * math.sin(self._angles[symbol])
                    price = round(base_price + random.uniform(-1, 1), 2)
                    quote = Quote(
                        symbol=symbol,
                        price=price,
                        volume=random.randint(1_000, 5_000),
                        timestamp=datetime.now(timezone.utc),
                    )
                    await self._queue.put(quote)
        except asyncio.CancelledError:
            return
