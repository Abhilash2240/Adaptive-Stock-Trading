import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from typing import Protocol, cast

from packages.shared.config import get_settings
from packages.shared.schemas import Quote


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
        symbols = [s.strip().upper() for s in settings.symbols.split(",") if s.strip()]
        if not symbols:
            symbols = ["AAPL"]

        if not settings.twelvedata_api_key:
            raise ValueError("TWELVEDATA_API_KEY must be set in .env")
        from .adapters.twelvedata import TwelveDataProvider

        _provider = TwelveDataProvider(
            api_key=settings.twelvedata_api_key,
            symbols=symbols,
            interval=settings.twelvedata_poll_interval,
        )
    return cast(DataProvider, _provider)
