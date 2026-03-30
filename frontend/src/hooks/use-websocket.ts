import { useEffect, useState, useCallback, useRef } from "react";
import { captureMonitoringException } from "@/lib/monitoring";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

interface UseWebSocketOptions<TMessage> {
  url?: string;
  onMessage?: (message: TMessage) => void;
  /** Maximum reconnect attempts before giving up (0 = unlimited). Default 20 */
  maxRetries?: number;
}

interface UseWebSocketResult<TMessage> {
  status: ConnectionStatus;
  isConnected: boolean;
  latency: number | null;
  lastMessageAt: Date | null;
  lastData: TMessage | null;
  reconnectAttempt: number;
  sendMessage: (message: unknown) => void;
  reconnect: () => void;
  close: () => void;
}

// ── Backoff helpers ──────────────────────────────────────────────
const INITIAL_BACKOFF_MS = 500;   // first retry after 500ms
const MAX_BACKOFF_MS = 30_000;    // cap at 30s
const BACKOFF_FACTOR = 1.5;
const JITTER_FACTOR = 0.3;        // ±30 % random jitter

function getBackoff(attempt: number): number {
  const base = Math.min(INITIAL_BACKOFF_MS * BACKOFF_FACTOR ** attempt, MAX_BACKOFF_MS);
  const jitter = base * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.max(100, Math.round(base + jitter));
}

/**
 * Lightweight health pre-check – hit the backend health endpoint before
 * opening a new WebSocket so we don't waste time on a connection that will
 * immediately fail.
 */
async function isBackendReachable(): Promise<boolean> {
  const base = ((import.meta.env as any).VITE_API_BASE ?? "").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/status`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useWebSocket<TMessage = unknown>(
  options: UseWebSocketOptions<TMessage> = {},
): UseWebSocketResult<TMessage> {
  const { url: explicitUrl, maxRetries = 20 } = options;
  const onMessageRef = useRef(options.onMessage);

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [latency, setLatency] = useState<number | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<Date | null>(null);
  const [lastData, setLastData] = useState<TMessage | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const attemptRef = useRef(0);  // mutable counter to avoid stale closures
  const mountedRef = useRef(true);

  useEffect(() => {
    onMessageRef.current = options.onMessage;
  }, [options.onMessage]);

  const resolveUrl = useCallback((): string => {
    let base: string;
    if (explicitUrl) {
      base = explicitUrl;
    } else {
      const envUrl = (import.meta.env as any).VITE_WS_URL as string | undefined;
      if (envUrl) {
        base = envUrl;
      } else {
        const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = typeof window !== "undefined" ? window.location.host : "localhost";
        base = `${protocol}//${host}/ws/quotes`;
      }
    }

    // Attach JWT token so backend authenticates the WebSocket
    const token = localStorage.getItem("auth_token");
    if (token) {
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}token=${encodeURIComponent(token)}`;
    }
    return base;
  }, [explicitUrl]);

  const cleanupReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    cleanupReconnect();
    const attempt = attemptRef.current;

    if (maxRetries > 0 && attempt >= maxRetries) {
      console.warn(`[WS] Max reconnect attempts (${maxRetries}) reached. Giving up.`);
      setStatus("disconnected");
      return;
    }

    const delay = getBackoff(attempt);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${attempt + 1})…`);
    setStatus("reconnecting");
    setReconnectAttempt(attempt + 1);

    reconnectTimeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      // Quick health pre-check: if the backend isn't reachable skip this
      // attempt so we don't open a socket that will instantly die.
      const reachable = await isBackendReachable();
      if (!reachable) {
        console.log("[WS] Backend not reachable yet, delaying…");
        attemptRef.current += 1;
        scheduleReconnect();
        return;
      }

      connectWs();
    }, delay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupReconnect, maxRetries]);

  const connectWs = useCallback(() => {
    cleanupReconnect();
    const targetUrl = resolveUrl();

    try {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }

      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;
      setStatus("reconnecting");

      ws.onopen = () => {
        // Reset attempt counter on success
        attemptRef.current = 0;
        setReconnectAttempt(0);
        setStatus("connected");
        console.log("[WS] Connected.");
      };

      ws.onmessage = (event) => {
        setLastMessageAt(new Date());

        let parsed: TMessage | null = null;
        try {
          parsed = JSON.parse(event.data);
        } catch (error) {
          console.error("Failed to parse WebSocket message", error);
          captureMonitoringException(error, { stage: "parse", endpoint: targetUrl });
          return;
        }

        setLastData(parsed);

        const payload = parsed as unknown as { timestamp?: string | number } | null;
        if (payload && payload.timestamp) {
          const timestampValue = new Date(payload.timestamp);
          if (!Number.isNaN(timestampValue.getTime())) {
            setLatency(Date.now() - timestampValue.getTime());
          }
        }

        if (onMessageRef.current && parsed !== null) {
          onMessageRef.current(parsed);
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Error", error);
        captureMonitoringException(error, { stage: "error", endpoint: targetUrl });
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        attemptRef.current += 1;
        scheduleReconnect();
      };
    } catch (error) {
      console.error("[WS] Failed to create connection", error);
      captureMonitoringException(error, { stage: "create", endpoint: resolveUrl() });
      attemptRef.current += 1;
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupReconnect, resolveUrl, scheduleReconnect]);

  // Mount / unmount
  useEffect(() => {
    mountedRef.current = true;
    connectWs();

    return () => {
      mountedRef.current = false;
      cleanupReconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-connect when tab becomes visible again (e.g. user switched back)
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && status !== "connected") {
        console.log("[WS] Tab visible again – reconnecting.");
        attemptRef.current = 0;
        connectWs();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [connectWs, status]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const close = useCallback(() => {
    cleanupReconnect();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, [cleanupReconnect]);

  const reconnect = useCallback(() => {
    close();
    attemptRef.current = 0;
    setReconnectAttempt(0);
    connectWs();
  }, [close, connectWs]);

  return {
    status,
    isConnected: status === "connected",
    latency,
    lastMessageAt,
    lastData,
    reconnectAttempt,
    sendMessage,
    reconnect,
    close,
  };
}
