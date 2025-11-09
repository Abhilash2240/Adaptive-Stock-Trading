import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Activity, BarChart3 } from "lucide-react";

import { useQuoteStreamContext } from "@/context/quote-stream-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { formatRelativeTime, formatPrice } from "@/utils/formatters";

export default function Streams() {
  const { history, symbols } = useQuoteStreamContext();
  const [filter, setFilter] = useState("");

  const filteredSymbols = useMemo(() => {
    const query = filter.trim().toUpperCase();
    if (!query) {
      return symbols;
    }
    return symbols.filter((symbol) => symbol.includes(query));
  }, [filter, symbols]);

  return (
    <div className="space-y-6" data-testid="page-streams">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Market Streams</h1>
        <p className="text-muted-foreground">
          Inspect the latest ticks captured from the backend quote stream for each subscribed symbol.
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 text-sm">
            {filteredSymbols.length} symbols
          </Badge>
          <Badge variant="secondary" className="gap-1 px-3 py-1 text-sm">
            <Activity className="h-3 w-3" />
            Live data
          </Badge>
        </div>
        <div className="w-full md:w-64">
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter symbol"
            className="uppercase"
            data-testid="input-filter-symbols"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSymbols.map((symbol) => {
          const data = history[symbol] ?? [];
          const sample = data.slice(-60);
          const latest = sample.at(-1);
          const high = sample.reduce((acc, item) => Math.max(acc, item.price), Number.NEGATIVE_INFINITY);
          const low = sample.reduce((acc, item) => Math.min(acc, item.price), Number.POSITIVE_INFINITY);
          const average =
            sample.length > 0 ? sample.reduce((sum, item) => sum + item.price, 0) / sample.length : null;

          return (
            <Card key={symbol} className="flex flex-col" data-testid={`card-stream-${symbol}`}>
              <CardHeader className="space-y-0 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <span className="font-mono">{symbol}</span>
                    <Badge variant="outline" className="gap-1 px-2 py-0">
                      <BarChart3 className="h-3 w-3" />
                      {sample.length}
                    </Badge>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(latest?.timestamp)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last</p>
                    <p className="font-mono font-semibold text-lg">{formatPrice(latest?.price)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">High</p>
                    <p className="font-mono font-semibold">{formatPrice(high === Number.NEGATIVE_INFINITY ? null : high)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Low</p>
                    <p className="font-mono font-semibold">{formatPrice(low === Number.POSITIVE_INFINITY ? null : low)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Average</p>
                    <p className="font-mono font-semibold">{formatPrice(average)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Volume</p>
                    <p className="font-mono font-semibold">{latest?.volume?.toLocaleString() ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Samples</p>
                    <p className="font-semibold">{sample.length}</p>
                  </div>
                </div>

                <Separator />

                <div className="h-28">
                  {sample.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={sample}>
                        <defs>
                          <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="timestamp" hide />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                          }}
                          formatter={(value: number) => formatPrice(value)}
                          labelFormatter={(value: string) => new Date(value).toLocaleTimeString()}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke="hsl(var(--primary))"
                          fill={`url(#gradient-${symbol})`}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Not enough ticks to render a sparkline yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredSymbols.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No symbols match that filter yet. Start streaming data from the backend to populate this view.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
