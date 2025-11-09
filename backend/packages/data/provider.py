import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Protocol, cast

from packages.shared.config import get_settings
from packages.shared.schemas import Quote, Symbol


class DataProvider(Protocol):
    name: str

    async def start(self) -> None: ...

    async def stop(self) -> None: ...

    async def subscribe(self, symbol: str, channel: str) -> None: ...

    def stream_quotes(self) -> AsyncIterator[Quote]: ...


class BaseAsyncProvider(ABC):
    name: str = "base"

    def __init__(self) -> None:
        self._started = asyncio.Event()

    async def start(self) -> None:
        self._started.set()

    async def stop(self) -> None:
        self._started.clear()

    async def subscribe(self, symbol: str, channel: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def stream_quotes(self) -> AsyncIterator[Quote]:
        raise NotImplementedError


_provider: DataProvider | None = None


def set_data_provider(provider: DataProvider) -> None:
    global _provider
    _provider = provider


def get_data_provider() -> DataProvider:
    global _provider
    if _provider is None:
        settings = get_settings()
        provider_name = settings.data_provider.lower()
        symbols = [symbol.strip().upper() for symbol in settings.symbols.split(",") if symbol.strip()]
        valid_symbols = []
        for value in symbols:
            try:
                valid_symbols.append(Symbol(value))
            except ValueError:
                continue
        if not valid_symbols:
            valid_symbols = [Symbol.AAPL]

        if provider_name == "polygon":
            if not settings.polygon_api_key:
                raise ValueError("POLYGON_API_KEY must be set for polygon data provider")
            from .adapters.polygon import PolygonProvider

            _provider = PolygonProvider(
                api_key=settings.polygon_api_key,
                symbols=[symbol.value for symbol in valid_symbols],
                interval=settings.polygon_poll_interval,
            )
        else:
            from .adapters.mock import MockProvider

            _provider = MockProvider(symbols=valid_symbols, interval=settings.mock_stream_interval)
    return cast(DataProvider, _provider)
