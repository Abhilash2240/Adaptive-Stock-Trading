import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bot, Cpu } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/auth-context";
import {
  AgentStatusResponse,
  TradeRecord,
  useAgentStatus,
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
  userEmail: string;
  onSignOut: () => void;
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
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f5f9]">
      <Sidebar
        activeRoute={path}
        onNavigate={props.onNavigate}
        userEmail={props.userEmail}
        onSignOut={props.onSignOut}
      />

      <main className="ml-60 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={["h-2.5 w-2.5 rounded-full", props.wsConnected ? "bg-[#22c55e] animate-pulse" : "bg-[#475569]"].join(" ")} />
              <span className="text-[#94a3b8]">{props.wsConnected ? "Live" : "Offline"}</span>
            </div>
            <span className="text-[#475569]">|</span>
            <span className="font-mono">{now.toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Portfolio Value" value={fmt(props.portfolioValue)} delta={`${signed(props.portfolioDelta)} (${signedPct(props.portfolioDeltaPct)})`} positive={props.portfolioDelta >= 0} />
          <StatCard label="Cash Available" value={fmt(props.cash)} sub={`${props.cashPct.toFixed(1)}% of portfolio`} />
          <StatCard label="Open Positions" value={String(props.openPositionsCount)} sub={`across ${props.openPositionsCount} symbols`} />
          <StatCard label="Today's P&L" value={signedMoney(props.todayPnl)} delta={signedPct(props.todayPnlPct)} positive={props.todayPnl >= 0} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <section className="xl:col-span-2 bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <h2 className="font-semibold text-lg">{props.currentSymbol}</h2>
                <p className="text-sm text-[#94a3b8]">{fmt(props.currentPrice)}</p>
              </div>
              <p className={props.priceChange >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}>{signed(props.priceChange)} ({signedPct(props.priceChangePct)})</p>
            </div>

            <div className="mt-3 bg-[#0d0d14] rounded-lg h-72 border border-[#1e1e2e] p-3">
              <Sparkline values={props.priceHistory} />
            </div>

            <div className="mt-3 flex gap-2">
              {props.symbols.map((s) => (
                <button
                  key={s}
                  onClick={() => props.onSymbolChange(s)}
                  className={[
                    "px-3 py-1.5 rounded-md text-sm transition-all duration-150",
                    props.currentSymbol === s ? "bg-[#6366f1] text-white" : "text-[#94a3b8] hover:bg-[#1e1e2e]",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
            <h3 className="font-semibold flex items-center gap-2"><Cpu size={16} className="text-[#6366f1]" />AI Signal</h3>
            <div className="mt-4 text-center">
              <span className={badgeClass(props.latestTick?.action_signal)}>{props.latestTick?.action_signal ?? "HOLD"}</span>
            </div>
            <div className="mt-4 text-sm text-[#94a3b8] flex justify-between">
              <span>Confidence</span>
              <span>{Math.round((props.latestTick?.confidence ?? 0) * 100)}%</span>
            </div>
            <div className="h-2 bg-[#1e1e2e] rounded overflow-hidden mt-2">
              <div className="h-full transition-all duration-300" style={{ width: `${Math.round((props.latestTick?.confidence ?? 0) * 100)}%`, backgroundColor: signalColor(props.latestTick?.action_signal) }} />
            </div>

            <div className="mt-5 space-y-2 text-xs">
              {(["HOLD", "BUY", "SELL"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[40px,1fr,50px] items-center gap-2">
                  <span className={props.latestTick?.action_signal === k ? "text-white" : "text-[#94a3b8]"}>{k}</span>
                  <div className="h-1.5 bg-[#1e1e2e] rounded overflow-hidden">
                    <div className="h-full" style={{ width: `${Math.round((qValues[k] / maxQ) * 100)}%`, background: props.latestTick?.action_signal === k ? signalColor(k) : "#6366f1" }} />
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
          </section>
        </div>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent Trades</h3>
            <button onClick={() => setLocation("/trades")} className="text-[#6366f1] text-sm">View All →</button>
          </div>

          {props.recentTrades.length === 0 ? (
            <div className="py-10 text-center text-[#94a3b8]">
              <Bot className="mx-auto mb-2 text-[#6366f1]" />
              No trades yet — the AI agent is collecting market data
            </div>
          ) : (
            <table className="w-full mt-3 text-sm">
              <thead className="text-[#94a3b8] text-xs">
                <tr className="border-b border-[#1e1e2e]">
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
                  <tr key={t.id} className="border-b border-[#1e1e2e] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="py-2 font-mono">{new Date(t.executed_at).toLocaleTimeString()}</td>
                    <td className="py-2">{t.symbol}</td>
                    <td className="py-2"><span className={badgeClass(t.side)}>{t.side}</span></td>
                    <td className="py-2 font-mono">{t.quantity}</td>
                    <td className="py-2 font-mono">{fmt(t.price)}</td>
                    <td className="py-2 text-[#94a3b8]">{Math.round((t.confidence ?? 0) * 100)}%</td>
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
  return "#f59e0b";
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
      "bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5",
      positive == null ? "" : positive ? "shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
    ].join(" ")}>
      <p className="text-[#94a3b8] text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {delta && <p className={positive === false ? "text-[#ef4444] text-sm mt-1" : "text-[#22c55e] text-sm mt-1"}>{delta}</p>}
      {sub && <p className="text-[#94a3b8] text-sm mt-1">{sub}</p>}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="h-full grid place-items-center text-[#475569] text-sm">Waiting for ticks...</div>;
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
      <polyline fill="rgba(99,102,241,0.08)" stroke="none" points={`0,100 ${points.join(" ")} 100,100`} />
      <polyline fill="none" stroke="#6366f1" strokeWidth="1.5" points={points.join(" ")} />
    </svg>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-2">
      <p className="text-[#94a3b8] text-[11px]">{label}</p>
      <p className="text-[#6366f1] font-mono text-xs truncate">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user, token, logout } = useAuth();
  const [currentSymbol, setCurrentSymbol] = useState("AAPL");
  const [latestTick, setLatestTick] = useState<LiveTick | null>(null);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  const { data: portfolio } = usePortfolioState(Boolean(token));
  const { data: trades = [] } = useTradeHistory(1, {});
  const { data: agentStatus } = useAgentStatus(Boolean(token));

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
    token,
    onTick,
    enabled: Boolean(token),
  });

  const currentPosition = portfolio?.positions.find((p) => p.symbol === currentSymbol);
  const currentPrice = latestTick?.close ?? currentPosition?.current_price ?? 0;
  const priceChange = latestTick ? latestTick.close - latestTick.open : 0;
  const priceChangePct = latestTick && latestTick.open !== 0 ? (priceChange / latestTick.open) * 100 : 0;

  const totalValue = portfolio?.total_value ?? 0;
  const cash = portfolio?.cash ?? 0;
  const unrealized = portfolio?.unrealized_pnl ?? 0;
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const deltaPct = totalValue > 0 ? (unrealized / totalValue) * 100 : 0;

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
      userEmail={user?.username ?? ""}
      onSignOut={logout}
    />
  );
}
