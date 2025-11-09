import { useMemo } from "react";
import { AlertTriangle, Clock, RefreshCw, WifiOff } from "lucide-react";

import { useQuoteStreamContext } from "@/context/quote-stream-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPrice, formatRelativeTime } from "@/utils/formatters";

export default function Diagnostics() {
  const { history, status, latency, lastMessageAt, reconnect, isConnected, quotes } = useQuoteStreamContext();

  const events = useMemo(() => {
    const flattened = Object.values(history).flat();
    return flattened
      .map((event) => ({
        ...event,
        timestampValue: new Date(event.timestamp).getTime(),
      }))
      .filter((event) => !Number.isNaN(event.timestampValue))
      .sort((a, b) => b.timestampValue - a.timestampValue)
      .slice(0, 120);
  }, [history]);

  const lastEvent = events[0];

  return (
    <div className="space-y-6" data-testid="page-diagnostics">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Diagnostics</h1>
        <p className="text-muted-foreground">
          Inspect the quote stream timeline and connection health to the FastAPI backend.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Socket Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span>{status.toUpperCase()}</span>
              {!isConnected && <WifiOff className="h-4 w-4 text-destructive" />}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Symbols</span>
              <span>{quotes.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Latency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-4 w-4" />
              <span>{latency !== null ? `${Math.max(0, Math.round(latency))} ms` : "—"}</span>
            </div>
            <div className="text-xs text-muted-foreground">Time between backend publish and receipt.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Last Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-semibold">{lastEvent ? lastEvent.symbol : "—"}</div>
            <div className="text-xs text-muted-foreground">{formatRelativeTime(lastEvent?.timestamp)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => reconnect()} data-testid="button-reconnect">
              <RefreshCw className="h-4 w-4 mr-2" />
              Restart Connection
            </Button>
            <div className="text-xs text-muted-foreground">
              Last message {formatRelativeTime(lastMessageAt)}.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Quote Timeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Showing {events.length} most recent ticks published by the backend.
            </p>
          </div>
          <Badge variant="outline" className="gap-1 px-3 py-1 text-sm">
            <AlertTriangle className="h-3 w-3" />
            Monitor rate limits
          </Badge>
        </CardHeader>
        <CardContent className="space-y-0">
          {events.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Waiting for the first event… start the backend publisher to populate diagnostics.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              {events.map((event, index) => {
                const priceText = formatPrice(event.price);

                return (
                  <div
                    key={`${event.symbol}-${event.timestamp}-${index}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40"
                    data-testid={`diagnostic-event-${index}`}
                  >
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold font-mono">{event.symbol}</span>
                        <span className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="font-mono text-sm">{priceText}</span>
                        <Separator orientation="vertical" className="h-3" />
                        <span>Volume {event.volume.toLocaleString()}</span>
                        <Separator orientation="vertical" className="h-3" />
                        <span>{formatRelativeTime(event.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
