import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";

export interface LiveTick {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: string;
  action_signal: "BUY" | "SELL" | "HOLD";
  confidence: number;
  signal_timestamp: string;
  /** Whether this price is a prediction (API rate limited) */
  is_predicted?: boolean;
  /** Confidence score for predicted prices (0-1) */
  data_confidence?: number;
  /** Predicted price value (if available) */
  predicted_price?: number;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface UseTradingWebSocketOptions {
  onTick: (tick: LiveTick) => void;
  enabled?: boolean;
}

interface UseTradingWebSocketReturn {
  connected: boolean;
  status: ConnectionStatus;
  error: string | null;
  reconnect: () => void;
}

// Reconnection configuration
const MAX_QUICK_RECONNECTS = 5;
const BASE_RECONNECT_DELAY = 3_000;
const MAX_RECONNECT_DELAY = 30_000;

export function useTradingWebSocket({
  onTick,
  enabled = true,
}: UseTradingWebSocketOptions): UseTradingWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const enabledRef = useRef(enabled);
  const onTickRef = useRef(onTick);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  
  // Keep refs up to date
  onTickRef.current = onTick;
  enabledRef.current = enabled;

  const getReconnectDelay = useCallback(() => {
    const attempt = reconnectAttemptRef.current;
    if (attempt < MAX_QUICK_RECONNECTS) {
      return BASE_RECONNECT_DELAY;
    }
    // Exponential backoff after initial attempts
    return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt - MAX_QUICK_RECONNECTS), MAX_RECONNECT_DELAY);
  }, []);

  const connect = useCallback(() => {
    if (!enabledRef.current) {
      setStatus("disconnected");
      return;
    }

    // Clear any pending reconnect
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("connecting");
    setError(null);

    // Build WebSocket URL with proper path handling
    const wsBase =
      import.meta.env.VITE_WS_URL ??
      `ws://${window.location.hostname}:8001/ws/quotes`;

    // Ensure endpoint has /ws/quotes path
    const endpoint = wsBase.endsWith("/ws/quotes")
      ? wsBase
      : `${wsBase}/ws/quotes`;

    console.info(`[WS] Connecting to ${endpoint}...`);

    try {
      const ws = new WebSocket(endpoint);

      ws.onopen = () => {
        console.info("[WS] Connected to /ws/quotes");
        setStatus("connected");
        setError(null);
        reconnectAttemptRef.current = 0; // Reset reconnect counter on success
      };

      ws.onmessage = (event) => {
        try {
          const data: LiveTick = JSON.parse(event.data);
          onTickRef.current(data);
        } catch (parseErr) {
          // Skip malformed frames silently
          console.debug("[WS] Skipped malformed message:", event.data);
        }
      };

      ws.onclose = (event) => {
        setStatus("disconnected");
        wsRef.current = null;

        // Don't reconnect if intentionally closed or disabled
        if (!enabledRef.current) {
          console.info("[WS] Connection closed (disabled)");
          return;
        }

        // Check for abnormal closure
        if (event.code !== 1000 && event.code !== 1001) {
          console.warn(`[WS] Abnormal close (code: ${event.code}, reason: ${event.reason || "none"})`);
        }

        reconnectAttemptRef.current += 1;
        const delay = getReconnectDelay();
        console.info(`[WS] Disconnected — reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptRef.current})`);
        
        reconnectRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        setStatus("error");
        setError("WebSocket connection error");
        // onclose will be called after onerror, which handles reconnection
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[WS] Failed to create WebSocket:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to connect");
      
      // Schedule reconnect
      reconnectAttemptRef.current += 1;
      const delay = getReconnectDelay();
      reconnectRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, [getReconnectDelay]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0; // Reset attempts on manual reconnect
    connect();
  }, [connect]);

  // Initial connection and cleanup
  useEffect(() => {
    if (enabled) {
      connect();
    }
    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("disconnected");
    };
  }, [enabled, connect]);

  return { 
    connected: status === "connected",
    status,
    error,
    reconnect,
  };
}
