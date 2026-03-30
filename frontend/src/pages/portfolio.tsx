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

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f5f9]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-60 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-[#94a3b8]">Updated: {data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : "-"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card label="Total Value" value={money(totalValue)} />
          <Card label="Cash" value={money(cash)} sub={`${cashPct.toFixed(1)}% allocation`} />
          <Card
            label="Unrealized P&L"
            value={`${unrealized >= 0 ? "+" : "-"}${money(Math.abs(unrealized))}`}
            sub={unrealized >= 0 ? "In profit" : "In drawdown"}
            positive={unrealized >= 0}
          />
        </div>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4">
          <h2 className="font-semibold">Open Positions</h2>
          {isLoading ? (
            <p className="text-sm text-[#94a3b8] mt-4">Loading portfolio...</p>
          ) : positions.length === 0 ? (
            <p className="text-sm text-[#94a3b8] mt-4">No open positions. The agent has not entered the market yet.</p>
          ) : (
            <table className="w-full mt-3 text-sm">
              <thead className="text-[#94a3b8] text-xs">
                <tr className="border-b border-[#1e1e2e]">
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
                    <tr key={p.symbol} className="border-b border-[#1e1e2e] hover:bg-[rgba(255,255,255,0.02)]">
                      <td className="py-2 font-semibold">{p.symbol}</td>
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
        "bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5",
        positive == null ? "" : positive ? "shadow-[0_0_12px_rgba(34,197,94,0.15)]" : "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
      ].join(" ")}
    >
      <p className="text-[#94a3b8] text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-sm mt-1 text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

function money(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
