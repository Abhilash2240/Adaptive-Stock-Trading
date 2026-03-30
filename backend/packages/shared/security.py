from __future__ import annotations

from typing import Any
import logging

from fastapi import HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)


class AuditLogger:
    async def log_user_action(self, user_id: str, action: str, details: dict[str, Any]) -> None:
        logger.info("audit action=%s user=%s details=%s", action, user_id, details)

    async def log_auth_attempt(self, username: str, success: bool, ip_address: str) -> None:
        logger.info("auth username=%s success=%s ip=%s", username, success, ip_address)


class InputValidator:
    def validate_stream_request(self, payload: dict[str, Any]) -> dict[str, str]:
        symbol = str(payload.get("symbol", "")).strip().upper()
        channel = str(payload.get("channel", "quotes")).strip().lower()
        if not symbol:
            raise HTTPException(status_code=400, detail="Symbol is required")
        if channel not in {"quotes", "trades", "ohlcv"}:
            raise HTTPException(status_code=400, detail="Invalid channel")
        return {"symbol": symbol, "channel": channel}


# Keep permissive defaults in development to avoid blocking local work.
audit_logger = AuditLogger()
limiter = Limiter(key_func=get_remote_address)
