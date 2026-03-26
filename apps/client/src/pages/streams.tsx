import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  Activity,
  Wifi,
  WifiOff,
  Pause,
  Play,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

import { useQuoteStreamContext } from "@/context/quote-stream-context";
import { useStockQuote } from "@/hooks/use-stock-quote";
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRACKED_SYMBOLS = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"] as const;
const POLL_MS = 60_000;
const FLASH_DURATION_MS = 2_000;
const MAX_SPARKLINE_POINTS = 60;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatVolume(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

function formatChange(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// SymbolCard -- self-contained card with useStockQuote + sparkline + flash
// ---------------------------------------------------------------------------

interface SymbolCardProps {
  symbol: string;
  sparklineData: Array<{ price: number }>;
  paused: boolean;
  staggerIndex: number;
}

function SymbolCard({ symbol, sparklineData, paused, staggerIndex }: SymbolCardProps) {
  const {
    price,
    name,
    open,
    high,
    low,
    volume,
    change,
    percentChange,
    provider,
    loading,
    error,
  } = useStockQuote(symbol, POLL_MS);

  // -- Snapshot refs for pause mode --
  const snapshotRef = useRef<{
    price: number | null;
    name?: string;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    change?: number;
    percentChange?: number;
    provider?: string;
  }>({ price: null });

  useEffect(() => {
    if (!paused) {
      snapshotRef.current = {
        price,
        name,
        open,
        high,
        low,
        volume,
        change,
        percentChange,
        provider,
      };
    }
  }, [paused, price, name, open, high, low, volume, change, percentChange, provider]);

  const display = paused ? snapshotRef.current : {
    price,
    name,
    open,
    high,
    low,
    volume,
    change,
    percentChange,
    provider,
  };

  // -- Price-change flash animation --
  const prevPriceRef = useRef<number | null>(null);
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (price === null || paused) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== price) {
      setFlashing(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    }
    prevPriceRef.current = price;
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [price, paused]);

  // -- Derived color / icon --
  const changeColor =
    display.change != null
      ? display.change > 0
        ? "text-accent"
        : display.change < 0
          ? "text-destructive"
          : "text-muted-foreground"
      : "text-muted-foreground";

  const TrendIcon =
    display.change != null
      ? display.change > 0
        ? TrendingUp
        : display.change < 0
          ? TrendingDown
          : Minus
      : Minus;

  // -- Sparkline points --
  const chartPoints = useMemo(() => {
    if (sparklineData.length > 1) return sparklineData.slice(-MAX_SPARKLINE_POINTS);
    if (display.price !== null) return [{ price: display.price }, { price: display.price }];
    return [{ price: 0 }, { price: 0 }];
  }, [sparklineData, display.price]);

  const sparkColor =
    display.change != null && display.change >= 0
      ? "hsl(var(--accent))"
      : "hsl(var(--destructive))";

  // -- Loading skeleton --
  if (loading && price === null) {
    return (
      <Card
        className={cn(
          "bg-card border rounded-xl shadow-sm animate-fade-in",
          `stagger-${staggerIndex}`,
        )}
      >
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-20" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-28" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // -- Error state --
  if (error && price === null) {
    return (
      <Card
        className={cn(
          "bg-card border rounded-xl shadow-sm animate-fade-in",
          `stagger-${staggerIndex}`,
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="font-mono font-semibold text-lg">{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Error loading quote. Will retry in {POLL_MS / 1000}s.
          </p>
        </CardContent>
      </Card>
    );
  }

  // -- Normal card --
  return (
    <Card
      className={cn(
        "bg-card border rounded-xl shadow-sm hover-lift animate-fade-in",
        `stagger-${staggerIndex}`,
        flashing && "animate-tick-flash",
      )}
      data-testid={`card-stream-${symbol}`}
    >
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <span className="font-mono">{symbol}</span>
            {display.name && (
              <span className="text-sm font-normal text-muted-foreground truncate max-w-[120px]">
                {display.name}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {display.provider && (
              <Badge variant="outline" className="text-xs">
                {display.provider}
              </Badge>
            )}
            <TrendIcon className={cn("h-4 w-4", changeColor)} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price + Change */}
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-mono font-bold tracking-tight text-foreground">
            {formatUsd(display.price)}
          </span>
          <div className={cn("flex items-center gap-1.5 text-sm font-mono", changeColor)}>
            <span>{formatChange(display.change)}</span>
            <span className="text-xs">({formatPercent(display.percentChange)})</span>
          </div>
        </div>

        <Separator />

        {/* OHLV Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Open</p>
            <p className="font-mono font-medium">{formatUsd(display.open)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">High</p>
            <p className="font-mono font-medium">{formatUsd(display.high)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Low</p>
            <p className="font-mono font-medium">{formatUsd(display.low)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Volume</p>
            <p className="font-mono font-medium">{formatVolume(display.volume)}</p>
          </div>
        </div>

        <Separator />

        {/* Sparkline */}
        <div className="h-20">
          {chartPoints.length > 1 ? (
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
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Waiting for data...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Streams -- main page export
// ---------------------------------------------------------------------------

export default function Streams() {
  const {
    status: connectionStatus,
    isConnected,
    latency,
    history,
    symbols: activeSymbols,
    reconnectAttempt,
    reconnect,
  } = useQuoteStreamContext();

  const [paused, setPaused] = useState(false);

  const togglePause = useCallback(() => setPaused((prev) => !prev), []);

  // -- Connection label --
  const connectionLabel =
    connectionStatus === "connected"
      ? "Connected"
      : connectionStatus === "reconnecting"
        ? "Reconnecting"
        : "Disconnected";

  const ConnectionIcon = isConnected ? Wifi : WifiOff;

  // -- Build sparkline map from WS history --
  const sparklineMap = useMemo(() => {
    const map: Record<string, Array<{ price: number }>> = {};
    for (const sym of TRACKED_SYMBOLS) {
      const symHistory = history[sym] ?? [];
      map[sym] = symHistory.map((h) => ({ price: h.price }));
    }
    return map;
  }, [history]);

  return (
    <div className="space-y-8" data-testid="page-streams">
      {/* -- Page Header -- */}
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-foreground" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Live Streams
        </h1>
      </div>

      {/* -- Connection Status Bar -- */}
      <Card
        className={cn(
          "bg-card border rounded-xl shadow-sm animate-fade-in stagger-1",
          isConnected && "ring-1 ring-accent/40",
        )}
      >
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: status + latency */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ConnectionIcon
                  className={cn(
                    "h-4 w-4",
                    isConnected ? "text-accent" : "text-destructive",
                  )}
                />
                <span className="font-mono font-semibold text-foreground">
                  {connectionLabel}
                </span>
              </div>

              <Separator orientation="vertical" className="h-5 hidden sm:block" />

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>Latency:</span>
                <span className="font-mono font-medium text-foreground">
                  {latency !== null ? `${Math.round(latency)} ms` : "--"}
                </span>
              </div>

              {connectionStatus === "reconnecting" && reconnectAttempt > 0 && (
                <>
                  <Separator orientation="vertical" className="h-5 hidden sm:block" />
                  <span className="text-sm text-muted-foreground">
                    Attempt {reconnectAttempt}
                  </span>
                </>
              )}

              <Separator orientation="vertical" className="h-5 hidden sm:block" />

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>WS Symbols:</span>
                <Badge variant="outline" className="font-mono text-xs">
                  {activeSymbols.length}
                </Badge>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePause}
                    className={cn(
                      "gap-1.5",
                      paused && "ring-1 ring-destructive/40",
                    )}
                  >
                    {paused ? (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {paused
                    ? "Resume live updates on all cards"
                    : "Freeze displayed values (WebSocket stays connected)"}
                </TooltipContent>
              </Tooltip>

              {connectionStatus === "disconnected" && (
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -- Paused Banner -- */}
      {paused && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive flex items-center gap-2">
          <Pause className="h-4 w-4" />
          Live updates paused. Displayed values are frozen. WebSocket remains connected in the background.
        </div>
      )}

      {/* -- Symbol Cards Grid -- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TRACKED_SYMBOLS.map((sym, idx) => (
          <SymbolCard
            key={sym}
            symbol={sym}
            sparklineData={sparklineMap[sym] ?? []}
            paused={paused}
            staggerIndex={idx + 1}
          />
        ))}
      </div>
    </div>
  );
}
