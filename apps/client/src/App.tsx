import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { WebSocketStatus } from "@/components/websocket-status";
import { TradingModeBadge } from "@/components/trading-mode-badge";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSettings } from "@/hooks/use-api";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Portfolio from "@/pages/portfolio";
import Backtest from "@/pages/backtest";
import Training from "@/pages/training";
import PaperTrading from "@/pages/paper-trading";
import Settings from "@/pages/settings";
import Logs from "@/pages/logs";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/backtest" component={Backtest} />
      <Route path="/training" component={Training} />
      <Route path="/paper-trading" component={PaperTrading} />
      <Route path="/settings" component={Settings} />
      <Route path="/logs" component={Logs} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { status, lastMessage, latency } = useWebSocket();
  
  // For MVP, use a demo user ID (in production, this would come from auth)
  const demoUserId = "demo-user-1";
  const { data: userSettings } = useSettings(demoUserId);
  
  const tradingMode = userSettings?.tradingMode || "paper";

  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex flex-col flex-1">
        <header 
          className="flex items-center justify-between h-16 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40"
          data-testid="header-main"
        >
          <div className="flex items-center gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <TradingModeBadge mode={tradingMode as "paper" | "live"} />
          </div>
          <div className="flex items-center gap-4">
            <WebSocketStatus status={status} latency={latency} lastMessage={lastMessage} />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <Router />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="rl-trader-theme">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <AppContent />
            <DisclaimerBanner />
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
