import asyncio
import json
from datetime import datetime, timezone

import httpx

from packages.agent.rationale import RationaleService
from packages.shared.config import Settings
from packages.shared.schemas import AgentAction, OrderSide


def action() -> AgentAction:
    return AgentAction(
        symbol="AAPL",
        side=OrderSide.BUY,
        confidence=0.82,
        generated_at=datetime.now(timezone.utc),
    )


def test_explain_posts_openrouter_request():
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Momentum supports the signal."}}]},
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    settings = Settings(openrouter_api_key="test-key")
    try:
        result = asyncio.run(
            RationaleService(client, settings).explain(
                "AAPL", action(), {"rsi": 0.6, "macd_histogram": 0.02}
            )
        )
    finally:
        asyncio.run(client.aclose())

    assert result == "Momentum supports the signal."
    assert requests[0].headers["Authorization"] == "Bearer test-key"
    assert requests[0].headers["HTTP-Referer"] == "https://adaptive-stock-trading.app"
    assert requests[0].url.path == "/api/v1/chat/completions"
    assert json.loads(requests[0].content)["model"] == "nvidia/nemotron-3-ultra-550b-a55b"


def test_explain_returns_none_without_api_key():
    result = asyncio.run(
        RationaleService(settings=Settings()).explain("AAPL", action(), {})
    )

    assert result is None


def test_explain_returns_none_on_http_error():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "server failure"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    try:
        result = asyncio.run(
            RationaleService(client, Settings(openrouter_api_key="test-key")).explain(
                "AAPL", action(), {}
            )
        )
    finally:
        asyncio.run(client.aclose())

    assert result is None