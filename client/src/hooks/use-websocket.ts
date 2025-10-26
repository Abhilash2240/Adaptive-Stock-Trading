import { useEffect, useState, useCallback, useRef } from "react";

type WebSocketMessage = {
  type: string;
  data?: any;
  message?: string;
  timestamp?: string;
};

type WebSocketHookReturn = {
  isConnected: boolean;
  lastMessage: Date | undefined;
  latency: number;
  sendMessage: (message: any) => void;
  status: "connected" | "disconnected" | "reconnecting";
};

export function useWebSocket(): WebSocketHookReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<Date | undefined>(undefined);
  const [latency, setLatency] = useState(0);
  const [status, setStatus] = useState<"connected" | "disconnected" | "reconnecting">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        setStatus("connected");
        setLastMessage(new Date());
        
        // Start ping interval to measure latency
        pingIntervalRef.current = setInterval(() => {
          const pingStart = Date.now();
          ws.send(JSON.stringify({ type: "ping", timestamp: pingStart }));
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(new Date());
          
          // Calculate latency from ping responses
          if (message.type === "pong" && message.timestamp) {
            const pingTime = Date.now() - parseInt(message.timestamp);
            setLatency(pingTime);
          }
          
          // Handle other message types
          console.log("WebSocket message:", message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setStatus("disconnected");
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        setStatus("reconnecting");
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect...");
          connect();
        }, 3000);
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    latency,
    sendMessage,
    status,
  };
}
