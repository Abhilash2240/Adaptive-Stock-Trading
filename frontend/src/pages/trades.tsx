import { useMemo, useState } from "react";
import { useLocation } from "wouter";

import { Sidebar } from "@/components/Sidebar";
import { TradeFilters, useTradeHistory } from "@/hooks/use-api";

const PAGE_SIZE = 20;

export default function TradesPage() {
  const [location, setLocation] = useLocation();

  const [page, setPage] = useState(1);
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
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f5f9]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-60 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Trades</h1>
          <div className="text-sm text-[#94a3b8]">Page {page}</div>
        </div>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FilterSelect label="Symbol" value={symbol} onChange={(v) => { setPage(1); setSymbol(v); }} options={["ALL", "AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"]} />
            <FilterSelect label="Action" value={action} onChange={(v) => { setPage(1); setAction(v); }} options={["ALL", "BUY", "SELL", "HOLD"]} />
          </div>
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
          {isLoading ? (
            <p className="text-sm text-[#94a3b8]">Loading trades...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No trades match your filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[#94a3b8] text-xs">
                <tr className="border-b border-[#1e1e2e]">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Action</th>
                  <th className="text-left py-2">Qty</th>
                  <th className="text-left py-2">Price</th>
                  <th className="text-left py-2">Confidence</th>
                  <th className="text-left py-2">Notional</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-[#1e1e2e] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="py-2 font-mono">{new Date(t.executed_at).toLocaleString()}</td>
                    <td className="py-2">{t.symbol}</td>
                    <td className="py-2"><span className={badgeClass(t.side)}>{t.side}</span></td>
                    <td className="py-2 font-mono">{t.quantity}</td>
                    <td className="py-2 font-mono">{money(t.price)}</td>
                    <td className="py-2">{Math.round((t.confidence ?? 0) * 100)}%</td>
                    <td className="py-2 font-mono">{money(t.price * t.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-4 flex items-center justify-between">
            <button
              className="px-3 py-1.5 rounded-md bg-[#1e1e2e] text-sm disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-[#1e1e2e] text-sm disabled:opacity-40"
              disabled={rows.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-[#94a3b8]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d0d14] border border-[#1e1e2e] rounded-md px-3 py-2"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function money(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function badgeClass(side: string) {
  if (side === "BUY") return "inline-flex rounded-full px-2.5 py-1 text-xs bg-[#22c55e] text-white";
  if (side === "SELL") return "inline-flex rounded-full px-2.5 py-1 text-xs bg-[#ef4444] text-white";
  return "inline-flex rounded-full px-2.5 py-1 text-xs bg-[#f59e0b] text-white";
}
