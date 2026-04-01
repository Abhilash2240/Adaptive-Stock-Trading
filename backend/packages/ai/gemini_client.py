from __future__ import annotations

from typing import Any, Optional

import httpx


class GeminiChatService:
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash") -> None:
        self.api_key = api_key.strip()
        self.model = model

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate_reply(
        self,
        question: str,
        symbol: str | None = None,
        current_price: float | None = None,
    ) -> str:
        """
        Generate a reply using Google Gemini API.
        
        Args:
            question: User's question
            symbol: Optional stock symbol for context
            current_price: Optional current price for context
        
        Returns:
            AI-generated response text
        """
        if not self.is_configured:
            raise ValueError("Gemini API key is missing")

        prompt = self._build_prompt(
            question=question,
            symbol=symbol,
            current_price=current_price,
        )
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

    def _build_prompt(
        self,
        question: str,
        symbol: str | None = None,
        current_price: float | None = None,
    ) -> str:
        """Build the prompt with stock context."""
        context_parts = []
        
        if symbol:
            context_parts.append(f"Stock symbol: {symbol}")
        if current_price is not None:
            context_parts.append(f"Current price: ${current_price:.2f}")
        
        context_str = " | ".join(context_parts) if context_parts else ""
        context_hint = f"[Market Context: {context_str}]\n\n" if context_str else ""
        
        return (
            "You are AdaptiveTrader Assistant, an AI assistant for a retail stock trading dashboard. "
            "Provide clear, actionable insights for traders. "
            "When discussing stocks, include relevant technical factors when appropriate. "
            "Always add a brief risk reminder when financial decisions are involved.\n\n"
            f"{context_hint}"
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
