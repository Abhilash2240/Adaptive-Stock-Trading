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
  const buyCount = rows.filter((t) => t.side === "BUY").length;
  const sellCount = rows.filter((t) => t.side === "SELL").length;
  const avgNotional = rows.length ? rows.reduce((sum, t) => sum + t.price * t.quantity, 0) / rows.length : 0;

  return (
    <div className="min-h-screen bg-[#081221] text-[#f1f6ff]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-0 space-y-5 p-4 md:ml-72 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#7f98bb]">Execution Ledger</p>
            <h1 className="text-3xl font-semibold">Trade History</h1>
          </div>
          <div className="text-sm text-[#94a3b8]">Page {page}</div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Metric title="Trades on Page" value={String(rows.length)} />
          <Metric title="BUY / SELL" value={`${buyCount} / ${sellCount}`} />
          <Metric title="Avg Notional" value={money(avgNotional)} />
        </section>

        <section className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FilterSelect label="Symbol" value={symbol} onChange={(v) => { setPage(1); setSymbol(v); }} options={["ALL", "AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"]} />
            <FilterSelect label="Action" value={action} onChange={(v) => { setPage(1); setAction(v); }} options={["ALL", "BUY", "SELL", "HOLD"]} />
          </div>
        </section>

        <section className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
          {isLoading ? (
            <p className="text-sm text-[#94a3b8]">Loading trades...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No trades match your filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[#94a3b8] text-xs">
                <tr className="border-b border-[#28466f]">
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
                  <tr key={t.id} className="border-b border-[#1f3556] hover:bg-[#142744]">
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
              className="rounded-md border border-[#2d4e7a] bg-[#152848] px-3 py-1.5 text-sm text-[#dcebff] disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              className="rounded-md border border-[#2d4e7a] bg-[#152848] px-3 py-1.5 text-sm text-[#dcebff] disabled:opacity-40"
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
        className="w-full rounded-md border border-[#2d4e7a] bg-[#0d1c33] px-3 py-2"
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

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[#8aa4c7]">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-[#edf4ff]">{value}</p>
    </div>
  );
}
