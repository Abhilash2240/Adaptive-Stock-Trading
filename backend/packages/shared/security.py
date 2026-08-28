from __future__ import annotations

from typing import Any
import logging

from fastapi import HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from packages.db.engine import get_session_ctx
from packages.db.repositories import AuditLogRepository

logger = logging.getLogger(__name__)


class AuditLogger:
    async def log_user_action(self, user_id: str, action: str, details: dict[str, Any]) -> None:
        logger.info("audit action=%s user=%s details=%s", action, user_id, details)
        try:
            async with get_session_ctx() as session:
                await AuditLogRepository(session).log(
                    "API_ACCESS",
                    user_id=user_id,
                    action=action,
                    details=details,
                )
        except Exception as exc:
            logger.warning("audit database write failed: %s", exc)

    async def log_auth_attempt(self, username: str, success: bool, ip_address: str) -> None:
        logger.info("auth username=%s success=%s ip=%s", username, success, ip_address)
        try:
            async with get_session_ctx() as session:
                await AuditLogRepository(session).log(
                    "AUTH",
                    username=username,
                    success=success,
                    ip_address=ip_address,
                    action="auth_attempt",
                )
        except Exception as exc:
            logger.warning("audit database write failed: %s", exc)


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
