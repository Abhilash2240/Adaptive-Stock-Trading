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
}

interface UseTradingWebSocketOptions {
  token: string | null;
  onTick: (tick: LiveTick) => void;
  enabled?: boolean;
}

export function useTradingWebSocket({
  token,
  onTick,
  enabled = true,
}: UseTradingWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTickRef = useRef(onTick);
  const [connected, setConnected] = useState(false);
  onTickRef.current = onTick;

  const connect = useCallback(() => {
    if (!token || !enabled) return;

    const wsBase =
      import.meta.env.VITE_WS_URL ??
      `ws://${window.location.hostname}:8001`;

    const endpoint = wsBase.endsWith("/ws/quotes")
      ? wsBase
      : `${wsBase}/ws/quotes`;

    const ws = new WebSocket(
      `${endpoint}?token=${encodeURIComponent(token)}`
    );

    ws.onopen = () => {
      console.info("[WS] connected to /ws/quotes");
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: LiveTick = JSON.parse(event.data);
        onTickRef.current(data);
      } catch {
        // skip malformed frames
      }
    };

    ws.onclose = () => {
      console.warn("[WS] disconnected — reconnecting in 3s");
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3_000);
    };

    ws.onerror = (err) => {
      console.error("[WS] error", err);
      ws.close();
    };

    wsRef.current = ws;
  }, [token, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      wsRef.current?.close();
      setConnected(false);
    };
  }, [connect]);

  return { connected };
}
