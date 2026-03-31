import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bot, Cpu } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import {
  AgentStatusResponse,
  LiveQuoteResponse,
  TradeRecord,
  useAgentStatus,
  useCreateTrade,
  useLiveQuote,
  usePortfolioState,
  useTradeHistory,
} from "@/hooks/use-api";
import { LiveTick, useTradingWebSocket } from "@/hooks/use-trading-websocket";

interface DashboardProps {
  portfolioValue: number;
  portfolioDelta: number;
  portfolioDeltaPct: number;
  cash: number;
  cashPct: number;
  openPositionsCount: number;
  todayPnl: number;
  todayPnlPct: number;
  currentSymbol: string;
  symbols: string[];
  onSymbolChange: (s: string) => void;
  priceHistory: number[];
  currentPrice: number;
  priceChange: number;
  priceChangePct: number;
  latestTick: LiveTick | null;
  liveQuote: LiveQuoteResponse | null;
  agentStatus: AgentStatusResponse | null;
  recentTrades: TradeRecord[];
  wsConnected: boolean;
  onNavigate: (route: string) => void;
  onPlaceTrade: (payload: { side: "BUY" | "SELL"; quantity: number; confidence: number }) => Promise<void>;
  placingTrade: boolean;
  tradeError: string | null;
}

export function Dashboard(props: DashboardProps) {
  const [, setLocation] = useLocation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const path = typeof window !== "undefined" ? window.location.pathname : "/dashboard";

  const qValues = useMemo(() => {
    const c = props.latestTick?.confidence ?? 0;
    return {
      HOLD: (1 - c) * 0.4,
      BUY: props.latestTick?.action_signal === "BUY" ? c : c * 0.5,
      SELL: props.latestTick?.action_signal === "SELL" ? c : c * 0.45,
    };
  }, [props.latestTick]);

  const maxQ = Math.max(qValues.BUY, qValues.SELL, qValues.HOLD, 0.01);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute -top-40 -left-16 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.35),transparent_65%)]" />
        <div className="absolute top-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,hsl(var(--accent)/0.22),transparent_65%)]" />
      </div>
      <Sidebar
        activeRoute={path}
        onNavigate={props.onNavigate}
      />

      <main className="relative ml-72 space-y-5 p-5">
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-[#1f3352] bg-[#101e36] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7f98bb]">Popular</span>
          {[
            { s: "NIFTY", c: -2.14 },
            { s: "BTC", c: 0.46 },
            { s: "INRUSD", c: 0.16 },
            { s: "ETH", c: 1.16 },
            { s: "BNB", c: -0.5 },
            { s: "HDFC", c: -4.1 },
          ].map((item) => (
            <div key={item.s} className="rounded-full border border-[#2a4468] bg-[#132849] px-3 py-1 text-xs">
              <span className="font-semibold text-[#d5e5ff]">{item.s}</span>
              <span className={item.c >= 0 ? "ml-2 text-emerald-400" : "ml-2 text-rose-400"}>
                {item.c >= 0 ? "+" : ""}
                {item.c.toFixed(2)}%
              </span>
            </div>
          ))}
          <input
            type="search"
            placeholder="Search stocks, ETFs, and more"
            className="ml-auto min-w-[250px] flex-1 rounded-full border border-[#2a4468] bg-[#0f1f39] px-4 py-2 text-sm text-[#dcebff] outline-none placeholder:text-[#6f87a8]"
          />
        </section>

        <section className="rounded-xl border border-[#1d4f87] bg-[#0f67ba] px-4 py-2 text-sm text-[#eaf3ff]">
          Price {props.priceChange >= 0 ? "up" : "down"}: {signedPct(props.priceChangePct)} from the previous close as of {now.toLocaleTimeString()}
        </section>

        <section className="rounded-2xl border border-[#243a5d] bg-[#121f38] p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#7f98bb]">{props.currentSymbol} • delayed by 15 minutes</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#f2f6ff]">{props.currentSymbol} ({props.currentSymbol})</h1>
              <p className="mt-1 text-5xl font-bold leading-none text-[#f7faff]">{fmt(props.currentPrice).replace("$", "")}</p>
              <p className={props.priceChange >= 0 ? "mt-1 text-sm text-emerald-400" : "mt-1 text-sm text-rose-400"}>
                {signed(props.priceChange)} ({signedPct(props.priceChangePct)})
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Watchlist",
                "Compare",
                "Join the discussion",
              ].map((action) => (
                <button key={action} className="rounded-full border border-[#35527d] bg-[#162a49] px-4 py-2 text-sm text-[#dce9ff]">
                  {action}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Summary",
              "Sentiment",
              "Related",
            ].map((tab, idx) => (
              <button
                key={tab}
                className={idx === 0 ? "rounded-full bg-[#0f67ba] px-4 py-1.5 text-sm font-medium text-[#eff6ff]" : "rounded-full border border-[#35527d] px-4 py-1.5 text-sm text-[#c6d8f6]"}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.8fr_0.95fr]">
            <div className="rounded-xl border border-[#2a4468] bg-[#0f1d34] p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                {[
                  "1D",
                  "5D",
                  "1M",
                  "3M",
                  "YTD",
                  "1Y",
                  "3Y",
                  "5Y",
                  "Max",
                ].map((range, index) => (
                  <button key={range} className={index === 0 ? "rounded-full bg-[#0f67ba] px-3 py-1 text-xs font-semibold text-white" : "rounded-full border border-[#35527d] px-3 py-1 text-xs text-[#a7bfde]"}>
                    {range}
                  </button>
                ))}
              </div>

              <div className="h-72 rounded-lg border border-[#2a4468] bg-[#0b182d] p-3">
                <Sparkline values={props.priceHistory} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                {props.symbols.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => props.onSymbolChange(s)}
                    className={[
                      "rounded-lg border px-3 py-2 text-left text-sm",
                      props.currentSymbol === s
                        ? "border-[#0f67ba] bg-[#0f67ba]/20 text-[#d9ebff]"
                        : "border-[#2a4468] bg-[#11213d] text-[#a7bfde] hover:bg-[#182d4f]",
                    ].join(" ")}
                  >
                    <p className="font-semibold">{s}</p>
                    <p className="text-xs text-[#85a1c3]">Quick compare</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#2a4468] bg-[#0f1d34] p-4">
              <p className="text-sm font-semibold text-[#e1eeff]">Market Stats</p>
              <div className="mt-3 space-y-3 text-sm">
                <MetricRow label="Day Range" value={`${fmt(props.liveQuote?.low ?? 0)} - ${fmt(props.liveQuote?.high ?? 0)}`} />
                <MetricRow label="Open / Close" value={`${fmt(props.liveQuote?.open ?? 0)} / ${fmt(props.currentPrice)}`} />
                <MetricRow label="Volume" value={(props.liveQuote?.volume ?? 0).toLocaleString()} />
                <MetricRow label="1 Month Return" value={signedPct(props.priceChangePct * 4.5)} positive={props.priceChangePct >= 0} />
                <MetricRow label="3 Months Return" value={signedPct(props.priceChangePct * 8.2)} positive={props.priceChangePct >= 0} />
                <MetricRow label="1 Year Return" value={signedPct(props.priceChangePct * 18.4)} positive={props.priceChangePct >= 0} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Portfolio Value" value={fmt(props.portfolioValue)} delta={`${signed(props.portfolioDelta)} (${signedPct(props.portfolioDeltaPct)})`} positive={props.portfolioDelta >= 0} />
          <StatCard label="Cash Available" value={fmt(props.cash)} sub={`${props.cashPct.toFixed(1)}% of portfolio`} />
          <StatCard label="Open Positions" value={String(props.openPositionsCount)} sub={`across ${props.openPositionsCount} symbols`} />
          <StatCard label="Today's P&L" value={signedMoney(props.todayPnl)} delta={signedPct(props.todayPnlPct)} positive={props.todayPnl >= 0} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section className="rounded-xl border border-[#243a5d] bg-[#121f38] p-4 shadow-lg">
            <h3 className="mb-3 text-lg font-semibold text-[#f2f6ff]">Quick Compare</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {props.symbols.slice(0, 6).map((s, index) => (
                <button
                  key={s}
                  onClick={() => props.onSymbolChange(s)}
                  className="rounded-lg border border-[#2a4468] bg-[#0f1d34] px-3 py-2 text-left"
                >
                  <p className="text-sm font-semibold text-[#dcebff]">{s}</p>
                  <p className={index % 2 === 0 ? "text-xs text-rose-400" : "text-xs text-emerald-400"}>{index % 2 === 0 ? "-2.14%" : "+1.28%"}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#243a5d] bg-[#121f38] p-4 shadow-lg">
            <h3 className="flex items-center gap-2 font-semibold"><Cpu size={16} className="text-primary" />AI Signal</h3>
            <div className="mt-4 text-center">
              <span className={badgeClass(props.latestTick?.action_signal)}>{props.latestTick?.action_signal ?? "HOLD"}</span>
            </div>
            <div className="mt-4 flex justify-between text-sm text-muted-foreground">
              <span>Confidence</span>
              <span>{Math.round((props.latestTick?.confidence ?? 0) * 100)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-secondary">
              <div className="h-full transition-all duration-300" style={{ width: `${Math.round((props.latestTick?.confidence ?? 0) * 100)}%`, backgroundColor: signalColor(props.latestTick?.action_signal) }} />
            </div>

            <div className="mt-5 space-y-2 text-xs">
              {(["HOLD", "BUY", "SELL"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[40px,1fr,50px] items-center gap-2">
                  <span className={props.latestTick?.action_signal === k ? "text-foreground" : "text-muted-foreground"}>{k}</span>
                  <div className="h-1.5 overflow-hidden rounded bg-secondary">
                    <div className="h-full" style={{ width: `${Math.round((qValues[k] / maxQ) * 100)}%`, background: props.latestTick?.action_signal === k ? signalColor(k) : "hsl(var(--primary))" }} />
                  </div>
                  <span className="font-mono text-right">{qValues[k].toFixed(3)}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-5 text-xs">
              <MiniStat label="epsilon" value={String(props.agentStatus?.epsilon ?? "-")} />
              <MiniStat label="steps" value={String(props.agentStatus?.step_count ?? "-")} />
              <MiniStat label="buffer" value={String(props.agentStatus?.buffer_size ?? "-")} />
              <MiniStat label="model" value={props.agentStatus?.model_version ?? "-"} />
            </div>

            <TradeComposer
              symbol={props.currentSymbol}
              price={props.currentPrice}
              onSubmit={props.onPlaceTrade}
              loading={props.placingTrade}
              error={props.tradeError}
            />
          </section>

          <section className="rounded-xl border border-[#243a5d] bg-[#121f38] p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-[#f2f6ff]">Session</h3>
            <div className="mt-3 space-y-3 text-sm text-[#b2c7e6]">
              <MetricRow label="Connection" value={props.wsConnected ? "Live" : "Offline"} positive={props.wsConnected} />
              <MetricRow label="Market Status" value={props.liveQuote?.market_status ?? "unknown"} positive={props.liveQuote?.market_status === "open"} />
              <MetricRow label="Timestamp" value={now.toLocaleTimeString()} />
              <MetricRow label="Model" value={props.agentStatus?.model_version ?? "-"} />
              <MetricRow label="Epsilon" value={String(props.agentStatus?.epsilon ?? "-")} />
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent Trades</h3>
            <button onClick={() => setLocation("/trades")} className="text-sm text-primary">View All →</button>
          </div>

          {props.recentTrades.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bot className="mx-auto mb-2 text-primary" />
              No trades yet — the AI agent is collecting market data
            </div>
          ) : (
            <table className="w-full mt-3 text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/80">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Action</th>
                  <th className="text-left py-2">Qty</th>
                  <th className="text-left py-2">Price</th>
                  <th className="text-left py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {props.recentTrades.map((t) => (
                  <tr key={t.id} className="border-b border-border/70 hover:bg-secondary/40">
                    <td className="py-2 font-mono">{new Date(t.executed_at).toLocaleTimeString()}</td>
                    <td className="py-2">{t.symbol}</td>
                    <td className="py-2"><span className={badgeClass(t.side)}>{t.side}</span></td>
                    <td className="py-2 font-mono">{t.quantity}</td>
                    <td className="py-2 font-mono">{fmt(t.price)}</td>
                    <td className="py-2 text-muted-foreground">{Math.round((t.confidence ?? 0) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}
function signedPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function signedMoney(n: number) {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n).toFixed(2)}`;
}

function signalColor(side?: string) {
  if (side === "BUY") return "#22c55e";
  if (side === "SELL") return "#ef4444";
  return "#eab308";
}

function badgeClass(side?: string) {
  const base = "inline-flex px-4 py-1 rounded-full text-sm font-semibold transition-all duration-150";
  if (side === "BUY") return `${base} bg-[#22c55e] text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]`;
  if (side === "SELL") return `${base} bg-[#ef4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]`;
  return `${base} bg-[#f59e0b] text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]`;
}

function StatCard({ label, value, delta, sub, positive }: { label: string; value: string; delta?: string; sub?: string; positive?: boolean }) {
  return (
    <div className={[
      "rounded-xl border border-border/80 bg-card/80 p-5 shadow-md backdrop-blur-sm",
      positive == null ? "" : positive ? "shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
    ].join(" ")}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {delta && <p className={positive === false ? "mt-1 text-sm text-rose-500" : "mt-1 text-sm text-emerald-500"}>{delta}</p>}
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Waiting for ticks...</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - norm(v) * 100;
    return `${x},${y}`;
  });

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
      <polyline fill="hsl(var(--primary)/0.09)" stroke="none" points={`0,100 ${points.join(" ")} 100,100`} />
      <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" points={points.join(" ")} />
    </svg>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/60 p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate font-mono text-xs text-primary">{value}</p>
    </div>
  );
}

function MetricRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#263f64] pb-2">
      <span className="text-[#8ca6c8]">{label}</span>
      <span className={positive == null ? "font-medium text-[#e7f0ff]" : positive ? "font-medium text-emerald-400" : "font-medium text-rose-400"}>
        {value}
      </span>
    </div>
  );
}

function TradeComposer({
  symbol,
  price,
  onSubmit,
  loading,
  error,
}: {
  symbol: string;
  price: number;
  onSubmit: (payload: { side: "BUY" | "SELL"; quantity: number; confidence: number }) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState(1);
  const [confidence, setConfidence] = useState(0.8);

  return (
    <div className="mt-5 rounded-lg border border-border/70 bg-background/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick Paper Trade</p>
      <p className="mt-1 text-sm text-muted-foreground">{symbol} at {fmt(price || 0)}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <button
          onClick={() => setSide("BUY")}
          className={[
            "rounded-md border px-2 py-1.5 transition",
            side === "BUY" ? "border-emerald-500 bg-emerald-500/20 text-emerald-500" : "border-border text-muted-foreground",
          ].join(" ")}
        >
          BUY
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={[
            "rounded-md border px-2 py-1.5 transition",
            side === "SELL" ? "border-rose-500 bg-rose-500/20 text-rose-500" : "border-border text-muted-foreground",
          ].join(" ")}
        >
          SELL
        </button>
        <input
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          type="number"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-right text-foreground"
        />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Confidence</span>
          <span>{Math.round(confidence * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={1}
          step={0.01}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <button
        onClick={() => void onSubmit({ side, quantity, confidence })}
        disabled={loading || price <= 0}
        className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Placing..." : `Place ${side} Order`}
      </button>

      {error ? <p className="mt-2 text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const [currentSymbol, setCurrentSymbol] = useState("AAPL");
  const [latestTick, setLatestTick] = useState<LiveTick | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  const { data: portfolio } = usePortfolioState(true);
  const { data: trades = [] } = useTradeHistory(1, {});
  const { data: agentStatus } = useAgentStatus(true);
  const { data: liveQuote } = useLiveQuote(currentSymbol, true);
  const createTrade = useCreateTrade();

  const symbols = useMemo(() => {
    const source = portfolio?.positions?.map((p) => p.symbol) ?? [];
    return Array.from(new Set(["AAPL", "MSFT", "TSLA", ...source]));
  }, [portfolio?.positions]);

  useEffect(() => {
    setPriceHistory([]);
    setLatestTick(null);
  }, [currentSymbol]);

  const onTick = (tick: LiveTick) => {
    if (tick.symbol !== currentSymbol) return;
    setLatestTick(tick);
    setPriceHistory((prev) => [...prev, tick.close].slice(-120));
  };

  const { connected } = useTradingWebSocket({
    onTick,
    enabled: true,
  });

  const currentPosition = portfolio?.positions.find((p) => p.symbol === currentSymbol);
  const currentPrice = latestTick?.close ?? liveQuote?.price ?? currentPosition?.current_price ?? 0;
  const openingPrice = latestTick?.open ?? liveQuote?.open ?? 0;
  const priceChange = currentPrice - openingPrice;
  const priceChangePct = openingPrice !== 0 ? (priceChange / openingPrice) * 100 : 0;

  const totalValue = portfolio?.total_value ?? 0;
  const cash = portfolio?.cash ?? 0;
  const unrealized = portfolio?.unrealized_pnl ?? 0;
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const deltaPct = totalValue > 0 ? (unrealized / totalValue) * 100 : 0;

  const onPlaceTrade = async (payload: { side: "BUY" | "SELL"; quantity: number; confidence: number }) => {
    const orderPrice = currentPrice > 0 ? currentPrice : latestTick?.close ?? 0;
    await createTrade.mutateAsync({
      symbol: currentSymbol,
      side: payload.side,
      quantity: payload.quantity,
      confidence: payload.confidence,
      price: orderPrice,
    });
  };

  return (
    <Dashboard
      portfolioValue={totalValue}
      portfolioDelta={unrealized}
      portfolioDeltaPct={deltaPct}
      cash={cash}
      cashPct={cashPct}
      openPositionsCount={portfolio?.positions.length ?? 0}
      todayPnl={unrealized}
      todayPnlPct={deltaPct}
      currentSymbol={currentSymbol}
      symbols={symbols}
      onSymbolChange={setCurrentSymbol}
      priceHistory={priceHistory}
      currentPrice={currentPrice}
      priceChange={priceChange}
      priceChangePct={priceChangePct}
      latestTick={latestTick}
      liveQuote={liveQuote ?? null}
      agentStatus={agentStatus ?? null}
      recentTrades={trades.slice(0, 5)}
      wsConnected={connected}
      onNavigate={setLocation}
      onPlaceTrade={onPlaceTrade}
      placingTrade={createTrade.isPending}
      tradeError={createTrade.error ? (createTrade.error as Error).message : null}
    />
  );
}
