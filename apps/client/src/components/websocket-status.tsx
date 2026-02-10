import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

interface WebSocketStatusProps {
  status?: ConnectionStatus;
  latency?: number;
  lastMessage?: Date;
  reconnectAttempt?: number;
}

export function WebSocketStatus({
  status = "disconnected",
  latency = 0,
  lastMessage,
  reconnectAttempt = 0,
}: WebSocketStatusProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: Wifi,
          label: "Connected",
          badgeClass:
            "bg-accent/15 text-accent border-accent/30 hover:bg-accent/20",
          iconClass: "animate-pulse-glow",
        };
      case "reconnecting":
        return {
          icon: RefreshCw,
          label: "Reconnecting",
          badgeClass:
            "bg-muted text-muted-foreground border-border hover:bg-muted/80",
          iconClass: "animate-spin",
        };
      default:
        return {
          icon: WifiOff,
          label: "Disconnected",
          badgeClass:
            "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/20",
          iconClass: "",
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  const getTimeSinceLastMessage = () => {
    if (!lastMessage) return "Never";
    const seconds = Math.floor(
      (currentTime.getTime() - lastMessage.getTime()) / 1000,
    );
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`gap-1.5 cursor-pointer ${config.badgeClass}`}
          data-testid={`badge-websocket-${status}`}
        >
          <StatusIcon className={`h-3 w-3 ${config.iconClass}`} />
          <span className="hidden sm:inline">{config.label}</span>
          {status === "connected" && latency > 0 && (
            <span className="text-[10px] opacity-70">{latency}ms</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent data-testid="tooltip-websocket-status">
        <div className="text-xs space-y-1">
          <p className="font-semibold">WebSocket: {config.label}</p>
          {status === "connected" && (
            <>
              <p>Latency: {latency}ms</p>
              <p>Last message: {getTimeSinceLastMessage()}</p>
            </>
          )}
          {status === "reconnecting" && reconnectAttempt > 0 && (
            <p>Reconnect attempt: {reconnectAttempt}</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
