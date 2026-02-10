import { useEffect, useRef, useState } from "react";
import {
  Stethoscope,
  Bot,
  Server,
  Wifi,
  WifiOff,
  Clock,
  Database,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

import { useQuoteStreamContext } from "@/context/quote-stream-context";
import {
  useAgentStatus,
  useBackendLive,
  useBackendReady,
} from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/formatters";

// ---------------------------------------------------------------------------
// StatusDot -- small colored indicator dot
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: "ok" | "error" | "unknown" }) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full shrink-0",
        status === "ok" && "bg-accent",
        status === "error" && "bg-destructive",
        status === "unknown" && "bg-muted-foreground",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// HealthRow -- reusable row inside the system health card
// ---------------------------------------------------------------------------

interface HealthRowProps {
  label: string;
  value: React.ReactNode;
  status: "ok" | "error" | "unknown";
  detail?: string;
}

function HealthRow({ label, value, status, detail }: HealthRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        <StatusDot status={status} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-right">
        <span className="text-sm font-mono font-medium text-foreground">
          {value}
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnostics -- main page export
// ---------------------------------------------------------------------------

export default function Diagnostics() {
  // -- Data sources --
  const {
    status: wsStatus,
    isConnected,
    latency,
    lastMessageAt,
    symbols,
    reconnectAttempt,
    reconnect,
  } = useQuoteStreamContext();

  const {
    data: agentData,
    isLoading: agentLoading,
    isError: agentError,
  } = useAgentStatus();

  const {
    data: liveData,
    isLoading: liveLoading,
    isError: liveError,
  } = useBackendLive();

  const {
    data: readyData,
    isLoading: readyLoading,
    isError: readyError,
  } = useBackendReady();

  // -- Agent state-change pulse animation --
  const prevAgentStateRef = useRef<string | undefined>(undefined);
  const [agentPulsing, setAgentPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!agentData?.state) return;
    if (
      prevAgentStateRef.current !== undefined &&
      prevAgentStateRef.current !== agentData.state
    ) {
      setAgentPulsing(true);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => setAgentPulsing(false), 2_500);
    }
    prevAgentStateRef.current = agentData.state;
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [agentData?.state]);

  // -- Derived values --
  const agentState = agentData?.state ?? "unknown";
  const agentModelVersion = agentData?.model_version ?? "--";
  const agentUpdatedAt = agentData?.updated_at ?? null;

  const agentStateBadgeVariant =
    agentState === "running"
      ? "default"
      : agentState === "error"
        ? "destructive"
        : "secondary";

  const agentStateIcon =
    agentState === "running"
      ? CheckCircle2
      : agentState === "error"
        ? XCircle
        : AlertCircle;
  const AgentStateIcon = agentStateIcon;

  const backendLiveStatus: "ok" | "error" | "unknown" = liveLoading
    ? "unknown"
    : liveError
      ? "error"
      : liveData?.status === "ok"
        ? "ok"
        : "error";

  const backendReadyStatus: "ok" | "error" | "unknown" = readyLoading
    ? "unknown"
    : readyError
      ? "error"
      : readyData?.status === "ok"
        ? "ok"
        : "error";

  const wsStatusForDot: "ok" | "error" | "unknown" =
    wsStatus === "connected"
      ? "ok"
      : wsStatus === "reconnecting"
        ? "unknown"
        : "error";

  const environment = readyData?.summary?.environment ?? "--";
  const provider = readyData?.summary?.provider ?? "--";

  const latencyLabel =
    latency !== null
      ? latency <= 100
        ? "Excellent"
        : latency <= 300
          ? "Normal"
          : "High"
      : "No data";

  return (
    <div className="space-y-8" data-testid="page-diagnostics">
      {/* -- Page Header -- */}
      <div className="flex items-center gap-3">
        <Stethoscope className="h-7 w-7 text-foreground" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Diagnostics
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ================================================================ */}
        {/* Section 1: Agent Status                                          */}
        {/* ================================================================ */}
        <Card
          className={cn(
            "bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-1",
            agentPulsing && "animate-pulse-glow",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Bot className="h-5 w-5 text-muted-foreground" />
              Agent Status
            </CardTitle>
            {!agentLoading && (
              <Badge
                variant={agentStateBadgeVariant as any}
                className="gap-1 px-2.5 py-0.5 capitalize"
              >
                <AgentStateIcon className="h-3 w-3" />
                {agentState}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {agentLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-40" />
              </div>
            ) : agentError ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                Unable to reach agent status endpoint.
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">State</span>
                    <span
                      className={cn(
                        "text-sm font-mono font-semibold capitalize",
                        agentState === "running" && "text-accent",
                        agentState === "error" && "text-destructive",
                        agentState === "idle" && "text-muted-foreground",
                      )}
                    >
                      {agentState}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">
                      Model Version
                    </span>
                    <span className="text-sm font-mono font-medium text-foreground">
                      {agentModelVersion}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">
                      Last Updated
                    </span>
                    <span className="text-sm font-mono text-foreground">
                      {agentUpdatedAt
                        ? formatRelativeTime(agentUpdatedAt)
                        : "--"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* Section 2: System Health                                         */}
        {/* ================================================================ */}
        <Card className="bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Server className="h-5 w-5 text-muted-foreground" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {liveLoading && readyLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ) : (
              <>
                {/* Backend liveness */}
                <HealthRow
                  label="Backend Liveness"
                  value={
                    liveLoading
                      ? "Checking..."
                      : liveError
                        ? "Unreachable"
                        : liveData?.status === "ok"
                          ? "Healthy"
                          : "Unhealthy"
                  }
                  status={backendLiveStatus}
                />
                <Separator />

                {/* Backend readiness */}
                <HealthRow
                  label="Backend Readiness"
                  value={
                    readyLoading
                      ? "Checking..."
                      : readyError
                        ? "Unreachable"
                        : readyData?.status === "ok"
                          ? "Ready"
                          : "Not Ready"
                  }
                  status={backendReadyStatus}
                />
                <Separator />

                {/* Environment */}
                <HealthRow
                  label="Environment"
                  value={
                    <Badge variant="outline" className="text-xs font-mono">
                      {environment}
                    </Badge>
                  }
                  status={readyLoading ? "unknown" : "ok"}
                />
                <Separator />

                {/* Data provider */}
                <HealthRow
                  label="Data Provider"
                  value={
                    <Badge variant="outline" className="text-xs font-mono">
                      {provider}
                    </Badge>
                  }
                  status={readyLoading ? "unknown" : "ok"}
                />
                <Separator />

                {/* WebSocket status */}
                <HealthRow
                  label="WebSocket"
                  value={
                    wsStatus === "connected"
                      ? "Connected"
                      : wsStatus === "reconnecting"
                        ? "Reconnecting"
                        : "Disconnected"
                  }
                  status={wsStatusForDot}
                />
                <Separator />

                {/* Latency */}
                <HealthRow
                  label="WS Latency"
                  value={
                    latency !== null ? `${Math.round(latency)} ms` : "--"
                  }
                  status={
                    latency === null
                      ? "unknown"
                      : latency <= 300
                        ? "ok"
                        : "error"
                  }
                  detail={latencyLabel}
                />
                <Separator />

                {/* Active symbols */}
                <HealthRow
                  label="Active WS Symbols"
                  value={String(symbols.length)}
                  status={symbols.length > 0 ? "ok" : "unknown"}
                />
                <Separator />

                {/* Last message */}
                <HealthRow
                  label="Last WS Message"
                  value={
                    lastMessageAt
                      ? formatRelativeTime(lastMessageAt)
                      : "--"
                  }
                  status={lastMessageAt ? "ok" : "unknown"}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* Section 3: Connection Log                                        */}
        {/* ================================================================ */}
        <Card className="bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-3 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-muted-foreground" />
              Connection Details
            </CardTitle>
            {wsStatus === "disconnected" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reconnect}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reconnect
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attempt to reconnect WebSocket</TooltipContent>
              </Tooltip>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* WS Status */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  WebSocket Status
                </span>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-accent" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      isConnected
                        ? "text-accent"
                        : wsStatus === "reconnecting"
                          ? "text-muted-foreground"
                          : "text-destructive",
                    )}
                  >
                    {wsStatus === "connected"
                      ? "Connected"
                      : wsStatus === "reconnecting"
                        ? "Reconnecting"
                        : "Disconnected"}
                  </span>
                </div>
              </div>

              {/* Reconnect attempts */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Reconnect Attempts
                </span>
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold text-foreground">
                    {reconnectAttempt}
                  </span>
                </div>
              </div>

              {/* Latency */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Round-Trip Latency
                </span>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold text-foreground">
                    {latency !== null ? `${Math.round(latency)} ms` : "--"}
                  </span>
                  {latency !== null && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        latency <= 100
                          ? "text-accent border-accent/30"
                          : latency <= 300
                            ? "text-muted-foreground"
                            : "text-destructive border-destructive/30",
                      )}
                    >
                      {latencyLabel}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Last message */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">
                  Last Message Received
                </span>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold text-foreground">
                    {lastMessageAt
                      ? formatRelativeTime(lastMessageAt)
                      : "No messages yet"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
