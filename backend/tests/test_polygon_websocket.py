import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import cast

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from packages.api.app import create_app
from packages.data.adapters.polygon import PolygonProvider
from packages.data.provider import DataProvider, set_data_provider
from packages.shared.config import get_settings
from packages.shared.schemas import Quote, Symbol


class DummyPolygonProvider(PolygonProvider):
    async def _fetch_last_trade(self, symbol: str) -> Quote | None:  # type: ignore[override]
        try:
            symbol_enum = Symbol(symbol.upper())
        except ValueError:
            return None
        return Quote(
            symbol=symbol_enum,
            price=123.45,
            volume=42,
            timestamp=datetime.now(timezone.utc),
        )


def test_polygon_streaming_websocket_roundtrip() -> None:
    original_data_provider = os.environ.get("DATA_PROVIDER")
    original_polygon_key = os.environ.get("POLYGON_API_KEY")

    os.environ["DATA_PROVIDER"] = "polygon"
    os.environ["POLYGON_API_KEY"] = "test-key"
    get_settings.cache_clear()

    provider = DummyPolygonProvider(api_key="test-key", symbols=["AAPL"], interval=0.01)
    set_data_provider(provider)

    try:
        app = create_app()
        with TestClient(app) as client:
            with client.websocket_connect("/ws/quotes") as websocket:
                message = websocket.receive_json()
        assert message["symbol"] == "AAPL"
        assert message["price"] == 123.45
        assert message["volume"] == 42
    finally:
        if original_data_provider is not None:
            os.environ["DATA_PROVIDER"] = original_data_provider
        else:
            os.environ.pop("DATA_PROVIDER", None)

        if original_polygon_key is not None:
            os.environ["POLYGON_API_KEY"] = original_polygon_key
        else:
            os.environ.pop("POLYGON_API_KEY", None)

        get_settings.cache_clear()
        set_data_provider(cast(DataProvider, None))
