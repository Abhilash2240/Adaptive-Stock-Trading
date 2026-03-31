import { useLocation } from "wouter";

import { Sidebar } from "@/components/Sidebar";
import { usePortfolioState } from "@/hooks/use-api";

export default function PortfolioPage() {
  const [location, setLocation] = useLocation();
  const { data, isLoading } = usePortfolioState(true);

  const totalValue = data?.total_value ?? 0;
  const cash = data?.cash ?? 0;
  const unrealized = data?.unrealized_pnl ?? 0;
  const positions = data?.positions ?? [];
  const cashPct = totalValue > 0 ? (cash / totalValue) * 100 : 0;
  const investedPct = Math.max(0, 100 - cashPct);
  const pnlPct = totalValue > 0 ? (unrealized / totalValue) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#081221] text-[#f1f6ff]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-72 space-y-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#7f98bb]">Portfolio Command Center</p>
            <h1 className="text-3xl font-semibold">Portfolio</h1>
          </div>
          <p className="text-sm text-[#94a3b8]">Updated: {data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : "-"}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card label="Total Value" value={money(totalValue)} />
          <Card label="Cash" value={money(cash)} sub={`${cashPct.toFixed(1)}% allocation`} />
          <Card
            label="Unrealized P&L"
            value={`${unrealized >= 0 ? "+" : "-"}${money(Math.abs(unrealized))}`}
            sub={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`}
            positive={unrealized >= 0}
          />
        </div>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
            <p className="text-sm font-semibold text-[#dae8ff]">Performance Trend</p>
            <div className="mt-3 h-52 rounded-lg border border-[#29466f] bg-[linear-gradient(180deg,#102546_0%,#0b1730_100%)] p-3">
              <div className="flex h-full items-end gap-2">
                {[24, 36, 41, 38, 47, 54, 49, 58, 63, 60, 68, 72].map((v, i) => (
                  <div key={i} className="flex-1 rounded-t bg-[#2d8bff]/80" style={{ height: `${v}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
            <p className="text-sm font-semibold text-[#dae8ff]">Allocation</p>
            <div className="mt-3 space-y-4">
              <AllocationBar label="Invested" value={investedPct} color="bg-[#2d8bff]" />
              <AllocationBar label="Cash" value={cashPct} color="bg-emerald-400" />
              <AllocationBar label="Risk Buffer" value={Math.max(4, Math.min(16, 100 - investedPct))} color="bg-amber-400" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
          <h2 className="font-semibold text-[#e7f1ff]">Open Positions</h2>
          {isLoading ? (
            <p className="text-sm text-[#94a3b8] mt-4">Loading portfolio...</p>
          ) : positions.length === 0 ? (
            <p className="text-sm text-[#94a3b8] mt-4">No open positions. The agent has not entered the market yet.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-[#94a3b8] text-xs">
                <tr className="border-b border-[#28466f]">
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Qty</th>
                  <th className="text-left py-2">Avg Price</th>
                  <th className="text-left py-2">Current</th>
                  <th className="text-left py-2">Market Value</th>
                  <th className="text-left py-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const marketValue = p.current_price * p.quantity;
                  const posPositive = p.unrealized_pnl >= 0;
                  return (
                    <tr key={p.symbol} className="border-b border-[#1f3556] hover:bg-[#142744]">
                      <td className="py-2 font-semibold text-[#edf4ff]">{p.symbol}</td>
                      <td className="py-2 font-mono">{p.quantity}</td>
                      <td className="py-2 font-mono">{money(p.avg_price)}</td>
                      <td className="py-2 font-mono">{money(p.current_price)}</td>
                      <td className="py-2 font-mono">{money(marketValue)}</td>
                      <td className={posPositive ? "py-2 text-[#22c55e]" : "py-2 text-[#ef4444]"}>
                        {`${posPositive ? "+" : "-"}${money(Math.abs(p.unrealized_pnl))}`} ({signedPct(p.unrealized_pnl_pct)})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

function Card({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div
      className={[
        "rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5",
        positive == null ? "" : positive ? "shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
      ].join(" ")}
    >
      <p className="text-[11px] uppercase tracking-wide text-[#89a4c6]">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {sub && <p className="mt-1 text-sm text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

function AllocationBar({ label, value, color }: { label: string; value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-[#9fb5d4]">
        <span>{label}</span>
        <span>{clamped.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded bg-[#223a5e]">
        <div className={["h-2 rounded", color].join(" ")} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function money(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
