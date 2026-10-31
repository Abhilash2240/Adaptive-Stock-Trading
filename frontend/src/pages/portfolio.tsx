import { useState } from "react";
import { useLocation } from "wouter";
import { Briefcase, TrendingUp, TrendingDown, DollarSign, ArrowUpRight } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import {
  usePortfolioState,
  useStockQuote,
  useCreateTrade,
} from "@/hooks/use-api";
import type { Position } from "@/hooks/use-api";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function money(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function signedPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

// ─── Sell button with live-price fetch ───────────────────────────────────────
function SellButton({ position }: { position: Position }) {
  const { data: quote, isLoading: quoteLoading } = useStockQuote(position.symbol);
  const createTrade = useCreateTrade();
  const [result, setResult] = useState<null | { profit: number; sellPrice: number }>(null);
  const [error, setError]   = useState<string | null>(null);

  const sellPrice = quote?.price ?? position.current_price;
  const profit    = (sellPrice - position.avg_price) * position.quantity;

  const handleSell = async () => {
    setError(null);
    setResult(null);
    try {
      await createTrade.mutateAsync({
        symbol:     position.symbol,
        side:       "SELL",
        quantity:   position.quantity,
        price:      sellPrice,
        confidence: 0.9,
      });
      setResult({ profit, sellPrice });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sell failed");
    }
  };

  if (result) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span
          className="text-xs font-semibold font-mono"
          style={{ color: result.profit >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}
        >
          {result.profit >= 0 ? "+" : "−"}{money(Math.abs(result.profit))} realized
        </span>
        <span className="text-[10px] text-muted-foreground">Sold @ {money(result.sellPrice)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="text-right">
        <span className="text-[10px] text-muted-foreground">
          {quoteLoading ? "fetching price…" : `Live: ${money(sellPrice)}`}
        </span>
        <span
          className="ml-2 text-[10px] font-mono font-semibold"
          style={{ color: profit >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}
        >
          {profit >= 0 ? "+" : "−"}{money(Math.abs(profit))} est. profit
        </span>
      </div>
      <button
        onClick={() => void handleSell()}
        disabled={createTrade.isPending || quoteLoading}
        className="rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-white transition-all duration-300 hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
        style={{ background: "var(--signal-sell)" }}
      >
        {createTrade.isPending ? "Selling…" : `Sell ${position.quantity} shares`}
      </button>
      {error && <p className="text-[10px] text-[var(--signal-sell)]">{error}</p>}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  icon, label, value, sub, positive, delay = 1,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  delay?: number;
}) {
  const iconColor = positive == null
    ? "hsl(var(--accent)/0.15)"
    : positive
      ? "rgba(74, 140, 92, 0.12)"
      : "rgba(194, 123, 102, 0.12)";
  const textColor = positive == null
    ? "hsl(var(--accent))"
    : positive
      ? "var(--signal-buy)"
      : "var(--signal-sell)";

  return (
    <div
      className={[
        "rounded-3xl border border-border bg-card p-6 shadow-botanical card-hover animate-fade-in",
        `stagger-${delay}`,
      ].join(" ")}
    >
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center mb-4"
        style={{ background: iconColor }}
      >
        <span style={{ color: textColor }}>{icon}</span>
      </div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-sans mb-1">{label}</p>
      <p
        className="text-2xl font-semibold"
        style={{ fontFamily: "'Playfair Display', serif", color: positive != null ? textColor : undefined }}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground font-sans">{sub}</p>}
    </div>
  );
}

// ─── Import React ─────────────────────────────────────────────────────────────
import React from "react";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [location, setLocation] = useLocation();
  const { data, isLoading } = usePortfolioState(true);

  const totalValue    = data?.total_value ?? 0;
  const cash          = data?.cash ?? 0;
  const unrealized    = data?.unrealized_pnl ?? 0;
  const positions     = data?.positions ?? [];
  const cashPct       = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const investedValue = positions.reduce((sum, p) => sum + p.quantity * p.avg_price, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-20 right-0 h-80 w-80 rounded-full bg-[hsl(var(--accent)/0.07)] blur-3xl" />
        <div className="absolute bottom-0 left-24 h-64 w-64 rounded-full bg-[hsl(var(--destructive)/0.05)] blur-3xl" />
      </div>

      <Sidebar activeRoute={location} onNavigate={setLocation} />

      <main className="ml-60 p-8 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-sans">
              Your holdings
            </p>
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              <em>Portfolio</em>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-sans pt-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
            Updated: {data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : "—"}
          </div>
        </div>

        {/* Summary Cards — 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <SummaryCard
            icon={<Briefcase size={16} strokeWidth={1.5} />}
            label="Total Value"
            value={money(totalValue)}
            delay={1}
          />
          <SummaryCard
            icon={<DollarSign size={16} strokeWidth={1.5} />}
            label="Cash Balance"
            value={money(cash)}
            sub={`${cashPct.toFixed(1)}% of portfolio`}
            delay={2}
          />
          <SummaryCard
            icon={<ArrowUpRight size={16} strokeWidth={1.5} />}
            label="Invested"
            value={money(investedValue)}
            sub={`${positions.length} open position${positions.length !== 1 ? "s" : ""}`}
            delay={3}
          />
          <SummaryCard
            icon={unrealized >= 0
              ? <TrendingUp size={16} strokeWidth={1.5} />
              : <TrendingDown size={16} strokeWidth={1.5} />
            }
            label="Unrealised P&L"
            value={`${unrealized >= 0 ? "+" : "−"}${money(Math.abs(unrealized))}`}
            sub={unrealized >= 0 ? "In profit" : "In drawdown"}
            positive={unrealized >= 0}
            delay={4}
          />
        </div>

        {/* Positions Table */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-botanical animate-fade-in stagger-4">
          <h2
            className="font-semibold text-base mb-5"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Open Positions
          </h2>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-8 w-8 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spinner mb-3" />
              <p className="text-sm text-muted-foreground font-sans">Loading portfolio…</p>
            </div>
          ) : positions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div
                className="mx-auto h-12 w-12 rounded-full flex items-center justify-center"
                style={{ background: "hsl(var(--accent)/0.10)" }}
              >
                <Briefcase size={20} strokeWidth={1.5} className="text-[hsl(var(--accent))]" />
              </div>
              <p className="text-sm text-muted-foreground font-sans">
                No open positions yet. Execute a trade from the dashboard.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b border-border">
                    {["Symbol", "Qty", "Avg Buy", "Current", "Market Value", "Unrealised P&L", "Action"].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const marketValue = p.current_price * p.quantity;
                    const isPositive  = p.unrealized_pnl >= 0;
                    return (
                      <tr
                        key={p.symbol}
                        className="border-b border-border/50 hover:bg-[hsl(var(--accent)/0.04)] transition-colors duration-200"
                      >
                        <td className="py-4 pr-4">
                          <span
                            className="font-semibold text-foreground"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                          >
                            {p.symbol}
                          </span>
                        </td>
                        <td className="py-4 pr-4 font-mono text-xs text-muted-foreground">{p.quantity}</td>
                        <td className="py-4 pr-4 font-mono text-xs">{money(p.avg_price)}</td>
                        <td className="py-4 pr-4 font-mono text-xs">{money(p.current_price)}</td>
                        <td className="py-4 pr-4 font-mono text-xs">{money(marketValue)}</td>
                        <td className="py-4 pr-4">
                          <span
                            className="inline-flex items-center gap-1 font-mono text-xs font-medium"
                            style={{ color: isPositive ? "var(--signal-buy)" : "var(--signal-sell)" }}
                          >
                            {isPositive
                              ? <TrendingUp size={12} strokeWidth={2} />
                              : <TrendingDown size={12} strokeWidth={2} />
                            }
                            {`${isPositive ? "+" : "−"}${money(Math.abs(p.unrealized_pnl))}`}
                            <span className="text-muted-foreground">
                              ({signedPct(p.unrealized_pnl_pct * 100)})
                            </span>
                          </span>
                        </td>
                        <td className="py-4">
                          <SellButton position={p} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* How it works callout */}
        <div className="rounded-2xl border border-border/60 bg-card/50 p-5 flex gap-4 items-start animate-fade-in stagger-5">
          <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--accent)/0.12)" }}>
            <DollarSign size={15} className="text-[hsl(var(--accent))]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground mb-1">How paper trading works</p>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              When you <strong>BUY</strong>, the cost (qty × price) is deducted from your cash balance immediately.
              When you <strong>SELL</strong>, the live market price is fetched in real time and the full proceeds
              (qty × current price) are added back to your cash.{" "}
              <strong>Profit</strong> = (sell price − avg buy price) × qty.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
