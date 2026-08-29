import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { TradeFilters, useTradeHistory } from "@/hooks/use-api";

const PAGE_SIZE = 20;

export default function TradesPage() {
  const [location, setLocation] = useLocation();
  const [page,   setPage]   = useState(1);
  const [symbol, setSymbol] = useState("ALL");
  const [action, setAction] = useState("ALL");

  const filters: TradeFilters = useMemo(
    () => ({
      symbol: symbol === "ALL" ? undefined : symbol,
      action: action === "ALL" ? undefined : (action as "BUY" | "SELL" | "HOLD"),
    }),
    [symbol, action],
  );

  const { data, isLoading } = useTradeHistory(page, filters);
  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient blob */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-[hsl(var(--accent)/0.06)] blur-3xl" />
      </div>

      <Sidebar activeRoute={location} onNavigate={setLocation} />

      <main className="ml-60 p-8 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-sans">
              Execution ledger
            </p>
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Trade <em>History</em>
            </h1>
          </div>
          <span className="text-xs text-muted-foreground font-sans pt-2">
            Page {page}
          </span>
        </div>

        {/* Filters */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-botanical animate-fade-in stagger-1">
          <h2
            className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-widest font-sans"
          >
            Filters
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FilterSelect
              label="Symbol"
              value={symbol}
              onChange={(v) => { setPage(1); setSymbol(v); }}
              options={["ALL", "AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"]}
            />
            <FilterSelect
              label="Action"
              value={action}
              onChange={(v) => { setPage(1); setAction(v); }}
              options={["ALL", "BUY", "SELL", "HOLD"]}
            />
          </div>
        </section>

        {/* Trades Table */}
        <section className="rounded-3xl border border-border bg-card p-6 shadow-botanical animate-fade-in stagger-2">
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-8 w-8 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spinner mb-3" />
              <p className="text-sm text-muted-foreground font-sans">Loading trades…</p>
            </div>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground font-sans">
              No trades match your filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-sans">
                <thead>
                  <tr className="border-b border-border">
                    {["Time", "Symbol", "Action", "Qty", "Price", "Confidence", "Notional"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-2 pr-4 text-[11px] uppercase tracking-widest text-muted-foreground font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-[hsl(var(--accent)/0.04)] transition-colors duration-200"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {new Date(t.executed_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {t.symbol}
                      </td>
                      <td className="py-3 pr-4">
                        <SignalBadge side={t.side} />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{t.quantity}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{money(t.price)}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{Math.round((t.confidence ?? 0) * 100)}%</td>
                      <td className="py-3 pr-4 font-mono text-xs">{money(t.price * t.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:border-[hsl(var(--accent))] hover:text-foreground transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed font-sans"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
              Previous
            </button>
            <span className="text-xs text-muted-foreground font-sans tracking-wide">
              Page {page}
            </span>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm text-muted-foreground hover:border-[hsl(var(--accent))] hover:text-foreground transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed font-sans"
              disabled={rows.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-sans">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-[hsl(var(--accent))] transition-colors duration-300 font-sans appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function SignalBadge({ side }: { side: string }) {
  const Icon = side === "BUY" ? TrendingUp : side === "SELL" ? TrendingDown : Minus;
  const color = side === "BUY"
    ? "var(--signal-buy)"
    : side === "SELL"
      ? "var(--signal-sell)"
      : "var(--signal-hold)";
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white uppercase tracking-wide"
      style={{ background: color }}
    >
      <Icon size={10} strokeWidth={2} />
      {side}
    </span>
  );
}

function money(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
