from __future__ import annotations

import logging
from typing import Any

import httpx

from packages.shared.config import Settings
from packages.shared.schemas import AgentAction

logger = logging.getLogger(__name__)


class RationaleService:
    def __init__(
        self,
        client: httpx.AsyncClient | None = None,
        settings: Settings | None = None,
    ) -> None:
        if settings is None:
            raise ValueError("Settings are required")
        self._settings = settings
        self._client = client

    async def explain(
        self,
        symbol: str,
        action: AgentAction,
        indicators: dict,
    ) -> str | None:
        if not self._settings.openrouter_api_key:
            logger.warning("OpenRouter rationale skipped: API key is not configured")
            return None

        payload = {
            "model": self._settings.openrouter_model,
            "max_tokens": 200,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a trading-desk analyst. Explain an already-made "
                        "algorithmic trading decision in 2-3 plain-English sentences. "
                        "Do not change, recommend, or second-guess the decision."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Symbol: {symbol.upper()}\n"
                        f"Action: {action.side.value}\n"
                        f"Confidence: {action.confidence:.4f}\n"
                        f"Indicators: {indicators}"
                    ),
                },
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._settings.openrouter_api_key}",
            "HTTP-Referer": "https://adaptive-stock-trading.app",
            "X-Title": "Adaptive Stock Trading",
        }

        client = self._client
        owns_client = client is None
        try:
            if client is None:
                client = httpx.AsyncClient(
                    timeout=self._settings.openrouter_timeout_seconds,
                )
            response = await client.post(
                f"{self._settings.openrouter_base_url.rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
                timeout=self._settings.openrouter_timeout_seconds,
            )
            response.raise_for_status()
            data: dict[str, Any] = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content")
            return str(content).strip() if content else None
        except httpx.TimeoutException:
            logger.warning("OpenRouter rationale request timed out")
            return None
        except Exception as exc:
            logger.warning("OpenRouter rationale request failed: %s", exc)
            return None
        finally:
            if owns_client and client is not None:
                await client.aclose()