import {
  BarChart3,
  Briefcase,
  Brain,
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

export function Sidebar({ activeRoute, onNavigate, userEmail, onSignOut }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <button
          onClick={() => onNavigate("/dashboard")}
          className="flex items-center gap-2"
        >
          <div className="h-6 w-6 rounded-md bg-sidebar-primary shadow-[0_0_20px_hsl(var(--sidebar-primary)/0.45)]" />
          <span className="text-lg font-semibold tracking-tight">AdaptiveTrader</span>
        </button>
      </div>

      <nav className="flex-1 space-y-2 p-3">
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
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70",
              ].join(" ")}
            >
              {active && <span className="absolute left-0 top-0 h-full w-[3px] rounded-r bg-sidebar-primary" />}
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-center text-xs text-sidebar-foreground/70">Ready to trade</p>
      </div>
    </aside>
  );
}
