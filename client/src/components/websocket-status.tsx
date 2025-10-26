import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

interface WebSocketStatusProps {
  status?: ConnectionStatus;
  latency?: number;
  lastMessage?: Date;
}

export function WebSocketStatus({ 
  status = "disconnected", 
  latency = 0,
  lastMessage 
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
          variant: "default" as const,
          label: "Connected",
          className: "animate-pulse",
        };
      case "reconnecting":
        return {
          icon: RefreshCw,
          variant: "secondary" as const,
          label: "Reconnecting",
          className: "animate-spin",
        };
      default:
        return {
          icon: WifiOff,
          variant: "destructive" as const,
          label: "Disconnected",
          className: "",
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  const getTimeSinceLastMessage = () => {
    if (!lastMessage) return "Never";
    const seconds = Math.floor((currentTime.getTime() - lastMessage.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={config.variant} 
          className="gap-1 cursor-pointer"
          data-testid={`badge-websocket-${status}`}
        >
          <StatusIcon className={`h-3 w-3 ${config.className}`} />
          <span className="hidden sm:inline">{config.label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent data-testid="tooltip-websocket-status">
        <div className="text-xs space-y-1">
          <p className="font-semibold">WebSocket Status: {config.label}</p>
          {status === "connected" && (
            <>
              <p>Latency: {latency}ms</p>
              <p>Last message: {getTimeSinceLastMessage()}</p>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
