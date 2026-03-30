import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

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
  onTick: (tick: LiveTick) => void;
  enabled?: boolean;
}

export function useTradingWebSocket({
  onTick,
  enabled = true,
}: UseTradingWebSocketOptions) {
  const { getAccessTokenSilently } = useAuth0();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTickRef = useRef(onTick);
  const [connected, setConnected] = useState(false);
  onTickRef.current = onTick;

  const connect = useCallback(async () => {
    if (!enabled) return;

    let token = "";
    try {
      token = await getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      });
      if (!token) {
        console.error("[WS] token fetch returned empty token");
        return;
      }
    } catch (error) {
      console.error("[WS] failed to get token", error);
      return;
    }

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
      reconnectRef.current = setTimeout(() => {
        void connect();
      }, 3_000);
    };

    ws.onerror = (err) => {
      console.error("[WS] error", err);
      ws.close();
    };

    wsRef.current = ws;
  }, [enabled, getAccessTokenSilently]);

  useEffect(() => {
    void connect();
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
