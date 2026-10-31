"""
metrics.py — Persistent Training Metrics Logger
================================================
Fixes (from deep-dive doc):
  § "No training metrics stored" — loss/epsilon/steps were never logged,
    so there was no way to chart a learning curve across restarts.

Fix:
  SQLite database (no extra infra) keyed by user_id + symbol.
  Appends one row per train_step().  Survives process restarts.
  Used by the pretrain script and can back a future /api/v1/agent/metrics
  endpoint to render a loss curve in the UI.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path


class TrainingMetricsLogger:
    """Lightweight SQLite logger for per-user, per-symbol training metrics."""

    def __init__(self, db_path: str = "models/training_metrics.db") -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    # ------------------------------------------------------------------
    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS training_metrics (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id   TEXT    NOT NULL,
                    symbol    TEXT    NOT NULL,
                    step      INTEGER NOT NULL,
                    loss      REAL,
                    epsilon   REAL    NOT NULL,
                    buffer_sz INTEGER NOT NULL,
                    reward    REAL,
                    ts        TEXT    NOT NULL
                )
            """)
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_us "
                "ON training_metrics(user_id, symbol)"
            )

    # ------------------------------------------------------------------
    def log(
        self,
        *,
        user_id: str,
        symbol: str,
        step: int,
        loss: float | None,
        epsilon: float,
        buffer_size: int,
        reward: float | None = None,
    ) -> None:
        ts = datetime.now(timezone.utc).isoformat()
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO training_metrics "
                "(user_id, symbol, step, loss, epsilon, buffer_sz, reward, ts) "
                "VALUES (?,?,?,?,?,?,?,?)",
                (user_id, symbol, step, loss, epsilon, buffer_size, reward, ts),
            )

    def get_history(
        self,
        user_id: str,
        symbol: str,
        limit: int = 500,
    ) -> list[dict]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT step, loss, epsilon, buffer_sz, reward, ts "
                "FROM training_metrics "
                "WHERE user_id=? AND symbol=? "
                "ORDER BY step ASC LIMIT ?",
                (user_id, symbol, limit),
            ).fetchall()
        keys = ("step", "loss", "epsilon", "buffer_size", "reward", "ts")
        return [dict(zip(keys, r)) for r in rows]

    def latest(self, user_id: str, symbol: str) -> dict | None:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT step, loss, epsilon, buffer_sz, reward, ts "
                "FROM training_metrics "
                "WHERE user_id=? AND symbol=? "
                "ORDER BY step DESC LIMIT 1",
                (user_id, symbol),
            ).fetchone()
        if row is None:
            return None
        keys = ("step", "loss", "epsilon", "buffer_size", "reward", "ts")
        return dict(zip(keys, row))
