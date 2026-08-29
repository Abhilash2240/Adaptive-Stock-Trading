import {
  BarChart3,
  Briefcase,
  Brain,
  List,
  Settings,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface SidebarProps {
  activeRoute: string;
  onNavigate: (route: string) => void;
  userEmail?: string;
  onSignOut?: () => void;
}

const navItems = [
  { key: "dashboard", label: "Dashboard",  icon: BarChart3, route: "/dashboard" },
  { key: "portfolio", label: "Portfolio",   icon: Briefcase, route: "/portfolio" },
  { key: "trades",    label: "Trades",      icon: List,      route: "/trades"    },
  { key: "agent",     label: "AI Agent",    icon: Brain,     route: "/agent"     },
  { key: "settings",  label: "Settings",    icon: Settings,  route: "/settings"  },
];

export function Sidebar({ activeRoute, onNavigate }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logotype */}
      <div className="border-b border-sidebar-border px-5 py-6">
        <button
          onClick={() => onNavigate("/dashboard")}
          className="flex items-center gap-3 group"
        >
          {/* Organic leaf mark */}
          <div className="relative h-7 w-7 flex-shrink-0">
            <div className="absolute inset-0 rounded-full bg-sidebar-primary opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
            <div
              className="absolute inset-0.5 rounded-full"
              style={{ background: "hsl(var(--sidebar-primary))", boxShadow: "0 0 18px hsl(var(--sidebar-primary) / 0.5)" }}
            />
          </div>
          <div className="leading-none">
            <span
              className="block text-base font-semibold tracking-tight text-sidebar-foreground"
              style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
            >
              Adaptive
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50 font-sans">
              Trader
            </span>
          </div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const active = activeRoute === item.route || activeRoute.startsWith(item.route + "/");
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.route)}
              className={[
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-all duration-300 relative overflow-hidden",
                `animate-fade-in stagger-${Math.min(i + 1, 5)}`,
                active
                  ? "bg-sidebar-primary/20 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              ].join(" ")}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-sidebar-primary" />
              )}
              <Icon size={16} strokeWidth={1.5} className="flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 flex items-center justify-between">
        <p className="text-[11px] tracking-wide uppercase text-sidebar-foreground/40" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
          Live Trading
        </p>
        <ThemeToggle />
      </div>
    </aside>
  );
}
