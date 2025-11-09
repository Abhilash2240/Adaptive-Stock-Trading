import { useEffect, useState, useCallback, useRef } from "react";
import { captureMonitoringException } from "@/lib/monitoring";

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

interface UseWebSocketOptions<TMessage> {
  url?: string;
  onMessage?: (message: TMessage) => void;
}

interface UseWebSocketResult<TMessage> {
  status: ConnectionStatus;
  isConnected: boolean;
  latency: number | null;
  lastMessageAt: Date | null;
  lastData: TMessage | null;
  sendMessage: (message: unknown) => void;
  reconnect: () => void;
  close: () => void;
}

export function useWebSocket<TMessage = unknown>(
  options: UseWebSocketOptions<TMessage> = {},
): UseWebSocketResult<TMessage> {
  const { url: explicitUrl } = options;
  const onMessageRef = useRef(options.onMessage);

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [latency, setLatency] = useState<number | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<Date | null>(null);
  const [lastData, setLastData] = useState<TMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    onMessageRef.current = options.onMessage;
  }, [options.onMessage]);

  const resolveUrl = useCallback((): string => {
    if (explicitUrl) {
      return explicitUrl;
    }

    const envUrl = (import.meta.env as any).VITE_WS_URL as string | undefined;
    if (envUrl) {
      return envUrl;
    }

    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost";
    return `${protocol}//${host}/ws/quotes`;
  }, [explicitUrl]);

  const cleanupReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  const connect = useCallback(() => {
    cleanupReconnect();

    const targetUrl = resolveUrl();

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      const ws = new WebSocket(targetUrl);
      wsRef.current = ws;
      setStatus("reconnecting");

      ws.onopen = () => {
        setStatus("connected");
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
        console.error("WebSocket error", error);
        captureMonitoringException(error, { stage: "error", endpoint: targetUrl });
        setStatus("disconnected");
      };

      ws.onclose = () => {
        setStatus("reconnecting");
        cleanupReconnect();
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection", error);
      captureMonitoringException(error, { stage: "create", endpoint: resolveUrl() });
      setStatus("disconnected");
    }
  }, [cleanupReconnect, resolveUrl]);

  useEffect(() => {
    connect();

    return () => {
      cleanupReconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cleanupReconnect, connect]);

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
    connect();
  }, [close, connect]);

  return {
    status,
    isConnected: status === "connected",
    latency,
    lastMessageAt,
    lastData,
    sendMessage,
    reconnect,
    close,
  };
}
