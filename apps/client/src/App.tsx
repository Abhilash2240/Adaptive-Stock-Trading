import React, { useEffect, useState } from "react";
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

function useApiHealth() {
  const api = import.meta.env.VITE_API_BASE;
  const [status, setStatus] = useState<"ok"|"fail"|"checking">("checking");
  const [error, setError] = useState<string>("");
  useEffect(() => {
    if (!api) {
      setStatus("fail");
      setError("VITE_API_BASE is not set. API calls will not work from GitHub Pages.");
      return;
    }
    let timeout = setTimeout(() => setStatus("fail"), 4500);
    fetch(`${api}/api/quote?symbol=AAPL`) // any /api endpoint works
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(() => {
        clearTimeout(timeout);
        setStatus("ok");
        setError("");
      })
      .catch(async (e) => {
        setStatus("fail");
        try {
          setError((await e.text?.()) || "Backend API not reachable.");
        } catch { setError("Backend API not reachable. Is it deployed?"); }
      });
    return () => timeout && clearTimeout(timeout);
  }, [api]);
  return { status, error };
}

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: Error|null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) { this.setState({ hasError: true, error }); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#fdd', color: '#a00', padding: 16 }}>
          <b>App Error:</b> {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

const BASE = import.meta.env.BASE_URL || "/";

function ApiBanner() {
  const { status, error } = useApiHealth();
  const api = import.meta.env.VITE_API_BASE;
  if (status === "ok") return null;
  return (
    <div style={{ background: "#fee", color: "#900", padding: 12, borderBottom: "1px solid #fcc", textAlign: "center" }}>
      <div><b>Warning.</b> Cannot reach backend API.</div>
      {error && <div style={{ marginTop: 8 }}>{error}</div>}
      {api && (
        <div style={{ marginTop: 8 }}>
          Check backend: <a style={{ color: '#07a' }} href={`${api}/api/quote?symbol=AAPL`} target="_blank" rel="noopener noreferrer">{api}</a>
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: '90%', opacity: 0.8 }}>
        If you’re running on GitHub Pages, set <code>VITE_API_BASE</code> in your repo Actions → Variables to your backend URL (e.g., <code>https://yourapp.onrender.com</code>), and make sure backend is live.
      </div>
    </div>
  );
}

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
          className="flex items-center justify-between h-16 px-4 sm:px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 shadow-sm"
          data-testid="header-main"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="transition-transform hover:scale-110 duration-200" />
            <TradingModeBadge mode={tradingMode as "paper" | "live"} />
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <WebSocketStatus status={status} latency={latency} lastMessage={lastMessage} />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
    <ErrorBoundary>
      <ApiBanner />
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
    </ErrorBoundary>
  );
}
