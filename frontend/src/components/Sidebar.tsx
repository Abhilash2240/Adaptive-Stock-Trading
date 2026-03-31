import {
  BarChart3,
  Briefcase,
  Brain,
  ChevronDown,
  List,
  Settings,
} from "lucide-react";

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  userEmail?: string;
  onSignOut?: () => void;
}

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3, route: "/dashboard" },
  { key: "portfolio", label: "Portfolio", icon: Briefcase, route: "/portfolio" },
  { key: "trades", label: "Trades", icon: List, route: "/trades" },
  { key: "agent", label: "AI Agent", icon: Brain, route: "/agent" },
  { key: "settings", label: "Settings", icon: Settings, route: "/settings" },
];

const marketList = [
  { symbol: "SENSEX", name: "BSE", value: "71,947.55", change: -2.22 },
  { symbol: "NIFTY", name: "NSE", value: "22,331.40", change: -2.14 },
  { symbol: "DOW", name: "DJI", value: "45,216.14", change: 0.11 },
  { symbol: "FTSE 100", name: "UKX", value: "10,127.96", change: 1.61 },
  { symbol: "NIKKEI", name: "N225", value: "51,492.92", change: -0.76 },
  { symbol: "NASDAQ", name: "COMP", value: "20,794.64", change: -0.73 },
];

export function Sidebar({ activeRoute, onNavigate, userEmail: _userEmail, onSignOut: _onSignOut }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-72 flex-col border-r border-[#1d2c44] bg-gradient-to-b from-[#0e1b31] to-[#0a1323] text-[#e2ecff]">
      <div className="border-b border-[#1d2c44] px-5 py-4">
        <button onClick={() => onNavigate("/dashboard")} className="flex w-full items-center justify-between rounded-lg bg-[#132747] px-3 py-2 text-left">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#8ea6c8]">Global Market</p>
            <p className="text-base font-semibold">AdaptiveTrader</p>
          </div>
          <ChevronDown size={16} className="text-[#7f98bb]" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <section className="space-y-1">
          {marketList.map((market) => {
            const positive = market.change >= 0;
            return (
              <div
                key={market.symbol}
                className="rounded-lg border border-[#1f3352] bg-[#10203a] px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-[#d8e6ff]">{market.symbol}</p>
                    <p className="text-[11px] text-[#8ea6c8]">{market.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#e8f1ff]">{market.value}</p>
                    <p className={positive ? "text-xs text-emerald-400" : "text-xs text-rose-400"}>
                      {positive ? "+" : ""}
                      {market.change.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-[2px] rounded bg-[#1d3352]">
                  <div
                    className={positive ? "h-[2px] rounded bg-emerald-400" : "h-[2px] rounded bg-rose-400"}
                    style={{ width: `${Math.min(100, Math.max(12, Math.abs(market.change) * 28))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        <nav className="space-y-1 border-t border-[#1d2c44] pt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.route;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.route)}
              className={[
                "relative flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-150",
                active
                  ? "bg-[#1a3d6c] text-[#f1f6ff]"
                  : "text-[#a8bddb] hover:bg-[#173257]",
              ].join(" ")}
            >
              {active && <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-[#2d8bff]" />}
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
        </nav>
      </div>

      <div className="border-t border-[#1d2c44] p-4">
        <p className="text-center text-xs text-[#7f98bb]">Live market terminal</p>
      </div>
    </aside>
  );
}
