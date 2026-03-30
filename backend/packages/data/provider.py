import asyncio
import warnings
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

        provider_name = (settings.data_provider or "mock").strip().lower()
        if provider_name == "mock":
            from .adapters.mock import MockDataProvider

            _provider = MockDataProvider(
                symbols=symbols,
                interval=settings.mock_stream_interval,
            )
        elif provider_name == "twelvedata":
            if not settings.twelvedata_api_key:
                warnings.warn(
                    "TWELVEDATA_API_KEY not set - falling back to mock provider",
                    RuntimeWarning,
                )
                from .adapters.mock import MockDataProvider

                _provider = MockDataProvider(
                    symbols=symbols,
                    interval=settings.mock_stream_interval,
                )
                return cast(DataProvider, _provider)
            from .adapters.twelvedata import TwelveDataProvider

            _provider = TwelveDataProvider(
                api_key=settings.twelvedata_api_key,
                symbols=symbols,
                interval=settings.twelvedata_poll_interval,
            )
        else:
            raise ValueError(f"Unsupported DATA_PROVIDER={provider_name!r}")
    return cast(DataProvider, _provider)
