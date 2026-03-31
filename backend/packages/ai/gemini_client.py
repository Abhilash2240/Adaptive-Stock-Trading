from __future__ import annotations

from typing import Any

import httpx


class GeminiChatService:
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash") -> None:
        self.api_key = api_key.strip()
        self.model = model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_reply(self, question: str, symbol: str | None = None) -> str:
        if not self.is_configured:
            raise ValueError("Gemini API key is missing")

        prompt = self._build_prompt(question=question, symbol=symbol)
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        payload: dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 600,
            },
        }

        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        answer = self._extract_text(data)
        if not answer:
            raise RuntimeError("Gemini did not return a usable response")
        return answer

    def _build_prompt(self, question: str, symbol: str | None = None) -> str:
        symbol_hint = f"Current symbol context: {symbol}." if symbol else ""
        return (
            "You are AdaptiveTrader Assistant. "
            "Answer clearly and directly for a retail trading dashboard user. "
            "If financial risk is involved, add a short risk reminder. "
            f"{symbol_hint}\n\n"
            f"User question: {question}"
        )

    def _extract_text(self, data: dict[str, Any]) -> str:
        candidates = data.get("candidates", [])
        if not candidates:
            return ""
        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        texts = [str(part.get("text", "")) for part in parts if part.get("text")]
        return "\n".join(texts).strip()
