import {
  BarChart3,
  Briefcase,
  Brain,
  List,
  LogOut,
  Settings,
} from "lucide-react";

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  userEmail: string;
  onSignOut: () => void;
}

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3, route: "/dashboard" },
  { key: "portfolio", label: "Portfolio", icon: Briefcase, route: "/portfolio" },
  { key: "trades", label: "Trades", icon: List, route: "/trades" },
  { key: "agent", label: "AI Agent", icon: Brain, route: "/agent" },
  { key: "settings", label: "Settings", icon: Settings, route: "/settings" },
];

export function Sidebar({ activeRoute, onNavigate, userEmail, onSignOut }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-[#0d0d14] border-r border-[#1e1e2e] flex flex-col">
      <div className="px-5 py-5 border-b border-[#1e1e2e]">
        <button
          onClick={() => onNavigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <div className="h-6 w-6 rounded-md bg-[#6366f1]" />
          <span className="text-[#f1f5f9] text-lg font-semibold">AdaptiveTrader</span>
        </button>
      </div>

      <nav className="p-3 flex-1 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeRoute === item.route;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.route)}
              className={[
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-150 relative",
                active
                  ? "text-white bg-[rgba(99,102,241,0.15)]"
                  : "text-[#94a3b8] hover:bg-[rgba(255,255,255,0.04)]",
              ].join(" ")}
            >
              {active && <span className="absolute left-0 top-0 h-full w-[3px] bg-[#6366f1] rounded-r" />}
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1e1e2e] space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-[#6366f1] text-white flex items-center justify-center text-sm font-semibold">
            {(userEmail || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[#94a3b8] text-xs truncate">{userEmail || "user"}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 text-[#475569] hover:text-[#ef4444] transition-all duration-150 text-sm"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
