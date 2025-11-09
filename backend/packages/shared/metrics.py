"""Centralized Prometheus metrics for the backend services."""

from __future__ import annotations

from contextlib import contextmanager
from time import perf_counter
from typing import Generator

from prometheus_client import Counter, Gauge, Histogram

WEBSOCKET_CONNECTIONS = Counter(
    "app_websocket_connections_total",
    "Total WebSocket connections accepted.",
    labelnames=("endpoint",),
)

WEBSOCKET_DISCONNECTS = Counter(
    "app_websocket_disconnects_total",
    "Total WebSocket connections closed or dropped.",
    labelnames=("endpoint", "code"),
)

WEBSOCKET_MESSAGES_OUT = Counter(
    "app_websocket_messages_sent_total",
    "Number of messages sent to WebSocket clients.",
    labelnames=("endpoint",),
)

WEBSOCKET_ACTIVE = Gauge(
    "app_websocket_active_connections",
    "Current active WebSocket connections.",
    labelnames=("endpoint",),
)

AGENT_INFERENCE_LATENCY = Histogram(
    "app_agent_inference_latency_seconds",
    "Latency of agent inference requests.",
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)

AGENT_INFERENCE_ERRORS = Counter(
    "app_agent_inference_errors_total",
    "Count of agent inference errors raised.",
)


def websocket_connected(endpoint: str) -> None:
    """Track a new connection for the provided endpoint."""
    WEBSOCKET_CONNECTIONS.labels(endpoint=endpoint).inc()
    WEBSOCKET_ACTIVE.labels(endpoint=endpoint).inc()


def websocket_closed(endpoint: str, code: str) -> None:
    """Track a closed connection for the provided endpoint."""
    WEBSOCKET_DISCONNECTS.labels(endpoint=endpoint, code=code).inc()
    WEBSOCKET_ACTIVE.labels(endpoint=endpoint).dec()


def websocket_message_sent(endpoint: str) -> None:
    """Track an outbound WebSocket message."""
    WEBSOCKET_MESSAGES_OUT.labels(endpoint=endpoint).inc()


@contextmanager
def track_inference_latency() -> Generator[None, None, None]:
    """Context manager that records inference latency and errors."""
    start = perf_counter()
    try:
        yield
    except Exception:
        AGENT_INFERENCE_ERRORS.inc()
        raise
    else:
        AGENT_INFERENCE_LATENCY.observe(perf_counter() - start)