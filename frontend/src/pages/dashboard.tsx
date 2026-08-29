import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bot, Cpu, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import {
  AgentStatusResponse,
  TradeRecord,
  useAgentStatus,
  useCreateTrade,
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
      BUY:  props.latestTick?.action_signal === "BUY"  ? c : c * 0.5,
      SELL: props.latestTick?.action_signal === "SELL" ? c : c * 0.45,
    };
  }, [props.latestTick]);

  const maxQ = Math.max(qValues.BUY, qValues.SELL, qValues.HOLD, 0.01);
  const signal = props.latestTick?.action_signal ?? "HOLD";

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient botanical blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-[hsl(var(--accent)/0.08)] blur-3xl" />
        <div className="absolute top-1/2 -right-20 h-96 w-96 rounded-full bg-[hsl(var(--destructive)/0.06)] blur-3xl" />
      </div>

      <Sidebar activeRoute={path} onNavigate={props.onNavigate} />

      <main className="relative ml-60 p-8 space-y-7">
        {/* Page Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-sans">
              Welcome back
            </p>
            <h1
              className="text-3xl font-semibold text-foreground leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Trading <em>Dashboard</em>
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm pt-1">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "h-2 w-2 rounded-full transition-all duration-700",
                  props.wsConnected
                    ? "bg-[hsl(var(--accent))] animate-pulse"
                    : "bg-muted-foreground/40",
                ].join(" ")}
              />
              <span className="text-muted-foreground font-sans text-xs tracking-wide uppercase">
                {props.wsConnected ? "Live" : "Offline"}
              </span>
            </div>
            <span className="text-border">|</span>
            <span className="font-mono text-xs text-muted-foreground">{now.toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Portfolio Value"
            value={fmt(props.portfolioValue)}
            delta={`${signed(props.portfolioDelta)} (${signedPct(props.portfolioDeltaPct)})`}
            positive={props.portfolioDelta >= 0}
            delay={1}
          />
          <StatCard
            label="Cash Available"
            value={fmt(props.cash)}
            sub={`${props.cashPct.toFixed(1)}% of portfolio`}
            delay={2}
          />
          <StatCard
            label="Open Positions"
            value={String(props.openPositionsCount)}
            sub={`across ${props.openPositionsCount} symbol${props.openPositionsCount !== 1 ? "s" : ""}`}
            delay={3}
          />
          <StatCard
            label="Unrealised P&L"
            value={signedMoney(props.todayPnl)}
            delta={signedPct(props.todayPnlPct)}
            positive={props.todayPnl >= 0}
            delay={4}
          />
        </div>

        {/* Chart + Signal */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Price Chart */}
          <section className="xl:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-botanical card-hover animate-fade-in stagger-2">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans">Current Price</p>
                <h2
                  className="text-2xl font-semibold mt-0.5"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {props.currentSymbol}
                </h2>
                <p className="text-lg font-mono mt-0.5 text-foreground">{fmt(props.currentPrice)}</p>
              </div>
              <p
                className={[
                  "text-sm font-medium px-3 py-1.5 rounded-full font-mono",
                  props.priceChange >= 0
                    ? "bg-[hsl(var(--accent)/0.12)] text-[hsl(var(--accent))]"
                    : "bg-[hsl(var(--destructive)/0.10)] text-[hsl(var(--destructive))]",
                ].join(" ")}
              >
                {signed(props.priceChange)} ({signedPct(props.priceChangePct)})
              </p>
            </div>

            {/* Chart Area */}
            <div className="h-56 rounded-2xl border border-border/50 bg-background/60 p-3 overflow-hidden">
              <Sparkline values={props.priceHistory} />
            </div>

            {/* Symbol Tabs */}
            <div className="mt-4 flex gap-2 flex-wrap">
              {props.symbols.map((s) => (
                <button
                  key={s}
                  onClick={() => props.onSymbolChange(s)}
                  className={[
                    "px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wide transition-all duration-300",
                    props.currentSymbol === s
                      ? "text-primary-foreground shadow-botanical"
                      : "border border-border text-muted-foreground hover:border-[hsl(var(--accent))] hover:text-foreground",
                  ].join(" ")}
                  style={props.currentSymbol === s ? { background: "var(--botanical-forest)" } : {}}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* AI Signal Panel */}
          <section className="rounded-3xl border border-border bg-card p-6 shadow-botanical card-hover animate-fade-in stagger-3 flex flex-col">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-7 w-7 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--accent)/0.15)" }}>
                <Cpu size={14} strokeWidth={1.5} className="text-[hsl(var(--accent))]" />
              </div>
              <h3 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground font-sans">
                AI Signal
              </h3>
            </div>

            {/* Signal Badge */}
            <div className="flex flex-col items-center gap-2 py-4">
              <SignalBadge signal={signal} large />
              <p className="text-xs text-muted-foreground font-sans">
                {Math.round((props.latestTick?.confidence ?? 0) * 100)}% confidence
              </p>
            </div>

            {/* Confidence Bar */}
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.round((props.latestTick?.confidence ?? 0) * 100)}%`,
                    background: signalBgColor(signal),
                  }}
                />
              </div>
            </div>

            {/* Q-Values */}
            <div className="mt-5 space-y-2.5">
              {(["HOLD", "BUY", "SELL"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[44px,1fr,44px] items-center gap-2">
                  <span className={[
                    "text-xs font-medium",
                    signal === k ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}>
                    {k}
                  </span>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.round((qValues[k] / maxQ) * 100)}%`,
                        background: signal === k ? signalBgColor(k) : "hsl(var(--accent)/0.4)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-right text-muted-foreground">
                    {qValues[k].toFixed(3)}
                  </span>
                </div>
              ))}
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <MiniStat label="ε‑decay"  value={String(props.agentStatus?.epsilon ?? "—")} />
              <MiniStat label="steps"    value={String(props.agentStatus?.step_count ?? "—")} />
              <MiniStat label="buffer"   value={String(props.agentStatus?.buffer_size ?? "—")} />
              <MiniStat label="model"    value={props.agentStatus?.model_version ?? "—"} />
            </div>

            {/* Trade Composer */}
            <div className="mt-5 flex-1 flex flex-col justify-end">
              <TradeComposer
                symbol={props.currentSymbol}
                price={props.currentPrice}
                onSubmit={props.onPlaceTrade}
                loading={props.placingTrade}
                error={props.tradeError}
              />
            </div>
          </section>
        </div>

        {/* Recent Trades */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-botanical animate-fade-in stagger-4">
          <div className="flex items-center justify-between mb-5">
            <h3
              className="font-semibold text-base"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Recent Trades
            </h3>
            <button
              onClick={() => setLocation("/trades")}
              className="text-xs uppercase tracking-widest text-[hsl(var(--accent))] hover:text-foreground transition-colors duration-300 font-sans"
            >
              View All →
            </button>
          </div>

          {props.recentTrades.length === 0 ? (
            <div className="py-12 text-center space-y-3 text-muted-foreground">
              <div className="mx-auto h-10 w-10 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--accent)/0.10)" }}>
                <Bot size={18} strokeWidth={1.5} className="text-[hsl(var(--accent))]" />
              </div>
              <p className="text-sm font-sans">
                No trades yet — the agent is observing the market
              </p>
            </div>
          ) : (
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Time</th>
                  <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Symbol</th>
                  <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Action</th>
                  <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Qty</th>
                  <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Price</th>
                  <th className="text-left py-2 text-xs uppercase tracking-wide text-muted-foreground font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {props.recentTrades.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-[hsl(var(--accent)/0.04)] transition-colors duration-200">
                    <td className="py-3 font-mono text-xs text-muted-foreground">{new Date(t.executed_at).toLocaleTimeString()}</td>
                    <td className="py-3 font-medium">{t.symbol}</td>
                    <td className="py-3"><SignalBadge signal={t.side} /></td>
                    <td className="py-3 font-mono text-xs">{t.quantity}</td>
                    <td className="py-3 font-mono text-xs">{fmt(t.price)}</td>
                    <td className="py-3 text-muted-foreground text-xs">{Math.round((t.confidence ?? 0) * 100)}%</td>
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

/* ─── Helpers ────────────────────────────────────────────────────── */
function fmt(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
function signed(n: number)     { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`; }
function signedPct(n: number)  { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }
function signedMoney(n: number){ return `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`; }

function signalBgColor(side?: string) {
  if (side === "BUY")  return "var(--signal-buy)";
  if (side === "SELL") return "var(--signal-sell)";
  return "var(--signal-hold)";
}

function SignalBadge({ signal, large }: { signal?: string; large?: boolean }) {
  const base = large
    ? "inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold text-white uppercase tracking-wide"
    : "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white uppercase tracking-wide";
  const Icon = signal === "BUY" ? TrendingUp : signal === "SELL" ? TrendingDown : Minus;
  return (
    <span className={base} style={{ background: signalBgColor(signal) }}>
      <Icon size={large ? 15 : 12} strokeWidth={2} />
      {signal ?? "HOLD"}
    </span>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────────── */
function StatCard({
  label, value, delta, sub, positive, delay = 1,
}: {
  label: string; value: string; delta?: string; sub?: string; positive?: boolean; delay?: number;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-border bg-card p-5 shadow-botanical card-hover animate-fade-in",
        `stagger-${delay}`,
      ].join(" ")}
    >
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-sans mb-2">{label}</p>
      <p
        className="text-2xl font-semibold tabular-nums"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {value}
      </p>
      {delta && (
        <p className={[
          "mt-1.5 text-xs font-medium font-mono",
          positive === false ? "text-[var(--signal-sell)]" : "text-[var(--signal-buy)]",
        ].join(" ")}>
          {delta}
        </p>
      )}
      {sub && <p className="mt-1 text-xs text-muted-foreground font-sans">{sub}</p>}
    </div>
  );
}

/* ─── Sparkline ──────────────────────────────────────────────────── */
function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground font-sans">
        Awaiting market data…
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
  const W = 100; const H = 100;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * W;
    const y = H - norm(v) * H;
    return `${x},${y}`;
  });

  const lastY = norm(values[values.length - 1]) * H;
  const isUp = values[values.length - 1] >= values[0];
  const strokeColor = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
  const fillColor   = isUp ? "rgba(74, 140, 92, 0.08)" : "rgba(194, 123, 102, 0.08)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="url(#sparkFill)"
        stroke="none"
        points={`0,${H} ${pts.join(" ")} ${W},${H}`}
      />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
      {/* Last price dot */}
      <circle
        cx={W}
        cy={H - lastY}
        r="2.5"
        fill={strokeColor}
      />
    </svg>
  );
}

/* ─── Mini Stat ──────────────────────────────────────────────────── */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-2.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">{label}</p>
      <p className="truncate font-mono text-xs text-[hsl(var(--accent))] mt-0.5">{value}</p>
    </div>
  );
}

/* ─── Trade Composer ─────────────────────────────────────────────── */
function TradeComposer({
  symbol, price, onSubmit, loading, error,
}: {
  symbol: string;
  price: number;
  onSubmit: (payload: { side: "BUY" | "SELL"; quantity: number; confidence: number }) => Promise<void>;
  loading: boolean;
  error: string | null;
}) {
  const [side, setSide]         = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState(1);
  const [confidence, setConfidence] = useState(0.8);

  return (
    <div className="rounded-2xl border border-border/70 bg-background/50 p-4 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">Quick Paper Trade</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{symbol} @ {fmt(price || 0)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setSide("BUY")}
          className={[
            "rounded-full py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-300",
            side === "BUY"
              ? "text-white"
              : "border border-border text-muted-foreground hover:border-[var(--signal-buy)] hover:text-[var(--signal-buy)]",
          ].join(" ")}
          style={side === "BUY" ? { background: "var(--signal-buy)" } : {}}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={[
            "rounded-full py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-300",
            side === "SELL"
              ? "text-white"
              : "border border-border text-muted-foreground hover:border-[var(--signal-sell)] hover:text-[var(--signal-sell)]",
          ].join(" ")}
          style={side === "SELL" ? { background: "var(--signal-sell)" } : {}}
        >
          Sell
        </button>
        <input
          value={quantity}
          min={1}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          type="number"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-right text-xs font-mono text-foreground focus:outline-none focus:border-[hsl(var(--accent))] transition-colors"
        />
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5 font-sans">
          <span>Confidence</span>
          <span className="font-mono">{Math.round(confidence * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.5} max={1} step={0.01}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="w-full h-1.5 cursor-pointer"
        />
      </div>

      <button
        onClick={() => void onSubmit({ side, quantity, confidence })}
        disabled={loading || price <= 0}
        className="w-full rounded-full py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: "var(--botanical-forest)" }}
      >
        {loading ? "Placing…" : `Place ${side} Order`}
      </button>

      {error && <p className="text-[11px] text-[var(--signal-sell)] font-sans">{error}</p>}
    </div>
  );
}

/* ─── Page Container ─────────────────────────────────────────────── */
export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const [currentSymbol, setCurrentSymbol] = useState("AAPL");
  const [latestTick, setLatestTick]       = useState<LiveTick | null>(null);
  const [priceHistory, setPriceHistory]   = useState<number[]>([]);

  const { data: portfolio }                = usePortfolioState(true);
  const { data: trades = [] }              = useTradeHistory(1, {});
  const { data: agentStatus }              = useAgentStatus(true);
  const createTrade                        = useCreateTrade();

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

  const { connected } = useTradingWebSocket({ onTick, enabled: true });

  const currentPosition = portfolio?.positions.find((p) => p.symbol === currentSymbol);
  const currentPrice    = latestTick?.close ?? currentPosition?.current_price ?? 0;
  const priceChange     = latestTick ? latestTick.close - latestTick.open : 0;
  const priceChangePct  = latestTick && latestTick.open !== 0 ? (priceChange / latestTick.open) * 100 : 0;

  const totalValue  = portfolio?.total_value ?? 0;
  const cash        = portfolio?.cash ?? 0;
  const unrealized  = portfolio?.unrealized_pnl ?? 0;
  const cashPct     = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const deltaPct    = totalValue > 0 ? (unrealized / totalValue) * 100 : 0;

  const onPlaceTrade = async (payload: { side: "BUY" | "SELL"; quantity: number; confidence: number }) => {
    const orderPrice = currentPrice > 0 ? currentPrice : latestTick?.close ?? 0;
    await createTrade.mutateAsync({
      symbol:     currentSymbol,
      side:       payload.side,
      quantity:   payload.quantity,
      confidence: payload.confidence,
      price:      orderPrice,
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
