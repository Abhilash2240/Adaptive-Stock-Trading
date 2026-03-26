import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Wifi,
  WifiOff,
  Clock,
  Bot,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

import { useQuoteStreamContext } from "@/context/quote-stream-context";
import { useAgentStatus, useBackendReady } from "@/hooks/use-api";
import { useStockQuote } from "@/hooks/use-stock-quote";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"] as const;
const POLL_MS = 60_000; // 60s REST poll — respects Twelve Data rate limits
const FLASH_DURATION_MS = 2_000;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVolume(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US");
}

function formatChange(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// StockRow — self-contained row with its own useStockQuote + tick flash
// ---------------------------------------------------------------------------

interface StockRowProps {
  symbol: string;
  sparklineData: Array<{ price: number }>;
}

function StockRow({ symbol, sparklineData }: StockRowProps) {
  const { price, name, change, percentChange, volume, loading, error } =
    useStockQuote(symbol, POLL_MS);

  // ---- Price-change flash animation ----
  const prevPriceRef = useRef<number | null>(null);
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (price === null) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== price) {
      setFlashing(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(
        () => setFlashing(false),
        FLASH_DURATION_MS,
      );
    }
    prevPriceRef.current = price;
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [price]);

  // ---- Derived color / icon ----
  const changeColor =
    change != null
      ? change > 0
        ? "text-accent"
        : change < 0
          ? "text-destructive"
          : "text-muted-foreground"
      : "text-muted-foreground";

  const TrendIcon =
    change != null
      ? change > 0
        ? TrendingUp
        : change < 0
          ? TrendingDown
          : Minus
      : Minus;

  // ---- Sparkline points ----
  const chartPoints = useMemo(() => {
    if (sparklineData.length > 1) return sparklineData;
    if (price !== null) return [{ price }, { price }];
    return [{ price: 0 }, { price: 0 }];
  }, [sparklineData, price]);

  const sparkColor =
    change != null && change >= 0
      ? "hsl(var(--accent))"
      : "hsl(var(--destructive))";

  // ---- Loading skeleton ----
  if (loading && price === null) {
    return (
      <tr className="border-b border-border">
        <td className="px-4 py-3">
          <Skeleton className="h-5 w-16" />
        </td>
        <td className="px-4 py-3">
          <Skeleton className="h-5 w-28" />
        </td>
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-5 w-20 ml-auto" />
        </td>
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-5 w-16 ml-auto" />
        </td>
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-5 w-16 ml-auto" />
        </td>
        <td className="px-4 py-3 text-right">
          <Skeleton className="h-5 w-20 ml-auto" />
        </td>
        <td className="px-4 py-3">
          <Skeleton className="h-8 w-24" />
        </td>
      </tr>
    );
  }

  // ---- Error state ----
  if (error && price === null) {
    return (
      <tr className="border-b border-border">
        <td className="px-4 py-3 font-mono font-semibold text-foreground">
          {symbol}
        </td>
        <td colSpan={6} className="px-4 py-3 text-sm text-destructive">
          Error loading quote. Will retry in {POLL_MS / 1000}s.
        </td>
      </tr>
    );
  }

  // ---- Normal row ----
  return (
    <tr
      className={cn(
        "border-b border-border transition-colors",
        flashing && "animate-tick-flash",
      )}
    >
      <td className="px-4 py-3">
        <span className="font-mono font-semibold text-foreground">
          {symbol}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {name ?? "--"}
      </td>
      <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
        {formatUsd(price)}
      </td>
      <td className={cn("px-4 py-3 text-right font-mono text-sm", changeColor)}>
        <span className="inline-flex items-center gap-1">
          <TrendIcon className="h-3.5 w-3.5" />
          {formatChange(change)}
        </span>
      </td>
      <td className={cn("px-4 py-3 text-right font-mono text-sm", changeColor)}>
        {formatPercent(percentChange)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
        {formatVolume(volume)}
      </td>
      <td className="px-4 py-3">
        <div className="h-8 w-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartPoints}>
              <Line
                type="monotone"
                dataKey="price"
                stroke={sparkColor}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Dashboard — main page export
// ---------------------------------------------------------------------------

export default function Dashboard() {
  // ---- Data sources ----
  const {
    status: connectionStatus,
    isConnected,
    latency,
    history,
    reconnectAttempt,
    reconnect,
  } = useQuoteStreamContext();

  const {
    data: backendData,
    isLoading: backendLoading,
    isError: backendError,
  } = useBackendReady();

  const { data: agentData, isLoading: agentLoading } = useAgentStatus();

  // ---- Agent pulse on state change ----
  const prevAgentStateRef = useRef<string | undefined>(undefined);
  const [agentPulsing, setAgentPulsing] = useState(false);
  const agentPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!agentData?.state) return;
    if (
      prevAgentStateRef.current !== undefined &&
      prevAgentStateRef.current !== agentData.state
    ) {
      setAgentPulsing(true);
      if (agentPulseTimerRef.current)
        clearTimeout(agentPulseTimerRef.current);
      agentPulseTimerRef.current = setTimeout(
        () => setAgentPulsing(false),
        2_500,
      );
    }
    prevAgentStateRef.current = agentData.state;
    return () => {
      if (agentPulseTimerRef.current)
        clearTimeout(agentPulseTimerRef.current);
    };
  }, [agentData?.state]);

  // ---- Derived values ----
  const environment = backendData?.summary?.environment ?? "development";
  const agentState = agentData?.state ?? "idle";
  const agentModelVersion = agentData?.model_version ?? "--";

  const connectionLabel =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "reconnecting"
        ? "Reconnecting"
        : "Disconnected";

  const ConnectionIcon = isConnected ? Wifi : WifiOff;

  // ---- Sparkline history map ----
  const sparklineMap = useMemo(() => {
    const map: Record<string, Array<{ price: number }>> = {};
    for (const sym of DEFAULT_SYMBOLS) {
      const symHistory = history[sym] ?? [];
      map[sym] = symHistory.map((h) => ({ price: h.price }));
    }
    return map;
  }, [history]);

  // ---- Render ----
  return (
    <div className="space-y-8" data-testid="page-dashboard">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-7 w-7 text-foreground" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
      </div>

      {/* ── Status Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connection */}
        <Card
          className={cn(
            "bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-1",
            isConnected && "ring-1 ring-accent/40 animate-pulse-glow",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Connection
            </CardTitle>
            <ConnectionIcon
              className={cn(
                "h-4 w-4",
                isConnected ? "text-accent" : "text-destructive",
              )}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold tracking-tight text-foreground">
              {connectionLabel}
            </div>
            {connectionStatus === "reconnecting" && reconnectAttempt > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Attempt {reconnectAttempt}
              </p>
            )}
            {connectionStatus === "disconnected" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground focus:ring-accent"
                    onClick={reconnect}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reconnect
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attempt to reconnect WebSocket</TooltipContent>
              </Tooltip>
            )}
          </CardContent>
        </Card>

        {/* Latency */}
        <Card className="bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold tracking-tight text-foreground">
              {latency !== null ? `${Math.round(latency)} ms` : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {latency !== null
                ? latency <= 100
                  ? "Excellent"
                  : latency <= 300
                    ? "Normal"
                    : "High"
                : "No data"}
            </p>
          </CardContent>
        </Card>

        {/* Agent */}
        <Card
          className={cn(
            "bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-3",
            agentPulsing && "animate-pulse-glow",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Agent
            </CardTitle>
            <Bot
              className={cn(
                "h-4 w-4",
                agentState === "running"
                  ? "text-accent"
                  : agentState === "error"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            />
          </CardHeader>
          <CardContent>
            {agentLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground capitalize">
                {agentState}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Model: {agentModelVersion}
            </p>
          </CardContent>
        </Card>

        {/* Provider */}
        <Card className="bg-card border rounded-xl shadow-sm hover-lift animate-fade-in stagger-4">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Provider
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {backendLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : backendError ? (
              <div className="text-2xl font-mono font-bold tracking-tight text-destructive">
                Offline
              </div>
            ) : (
              <div className="text-2xl font-mono font-bold tracking-tight text-foreground">
                Twelve Data
              </div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {environment}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Live Price Table ──────────────────────────────────────── */}
      <Card className="bg-card border rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">
              Live Prices
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              REST-polled quotes for tracked symbols. Updates every 60 seconds.
            </p>
          </div>
          <Badge variant="outline" className="font-mono px-3 py-1 text-sm">
            {DEFAULT_SYMBOLS.length} symbols
          </Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Symbol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Change
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Change %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Volume
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Sparkline
                </th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_SYMBOLS.map((sym) => (
                <StockRow
                  key={sym}
                  symbol={sym}
                  sparklineData={sparklineMap[sym] ?? []}
                />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
