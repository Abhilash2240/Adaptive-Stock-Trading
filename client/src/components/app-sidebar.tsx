import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  LineChart, 
  Cpu, 
  TrendingUp, 
  Settings, 
  FileText,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Portfolio",
    url: "/portfolio",
    icon: Briefcase,
  },
  {
    title: "Backtest & Experiments",
    url: "/backtest",
    icon: LineChart,
  },
  {
    title: "Training Control",
    url: "/training",
    icon: Cpu,
  },
  {
    title: "Paper Trading",
    url: "/paper-trading",
    icon: TrendingUp,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Logs & Diagnostics",
    url: "/logs",
    icon: FileText,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" data-testid="logo-icon" />
          <div>
            <h2 className="text-lg font-bold tracking-tight" data-testid="text-app-name">
              RL Trader
            </h2>
            <p className="text-xs text-muted-foreground" data-testid="text-app-subtitle">
              Deep Reinforcement Learning
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wide" data-testid="text-navigation-label">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      data-active={isActive}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      className={isActive ? 'bg-sidebar-accent border-l-4 border-l-primary' : ''}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Badge variant="secondary" className="justify-center" data-testid="badge-version">
          v1.0.0-MVP
        </Badge>
      </SidebarFooter>
    </Sidebar>
  );
}
