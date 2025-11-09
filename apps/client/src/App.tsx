import React, { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { WebSocketStatus } from "@/components/websocket-status";
import { TradingModeBadge } from "@/components/trading-mode-badge";
import { useQuoteStreamContext, QuoteStreamProvider } from "@/context/quote-stream-context";
import { apiBaseUrl, useBackendReady } from "@/hooks/use-api";
import Dashboard from "@/pages/dashboard";
import Streams from "@/pages/streams";
import Diagnostics from "@/pages/diagnostics";
import Portfolio from "@/pages/portfolio";
import Backtest from "@/pages/backtest";
import Training from "@/pages/training";
import PaperTrading from "@/pages/paper-trading";
import Settings from "@/pages/settings";
import Logs from "@/pages/logs";
import NotFound from "@/pages/not-found";

function useApiHealth() {
  const base = apiBaseUrl;
  const target = `${base || ""}/health/ready`;
  const [status, setStatus] = useState<"ok" | "fail" | "checking">("checking");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setStatus("fail");
      setError("Timed out while contacting the backend health endpoint.");
    }, 5000);

    fetch(target, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response)))
      .then(() => {
        window.clearTimeout(timeout);
        setStatus("ok");
        setError("");
      })
      .catch(async (reason) => {
        if (controller.signal.aborted) {
          return;
        }
        setStatus("fail");
        if (reason instanceof Response) {
          const message = await reason.text();
          setError(message || `Health endpoint returned status ${reason.status}.`);
        } else {
          setError("Backend API not reachable. Is it running and accessible from this host?");
        }
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [target]);

  return { status, error, target };
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.setState({ hasError: true, error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-100 text-red-800 border-b border-red-200 px-4 py-3 text-sm">
          <span className="font-semibold">App Error:</span> {this.state.error?.message}
        </div>
      );
    }

    return this.props.children;
  }
}

function ApiBanner() {
  const { status, error, target } = useApiHealth();

  if (status === "ok") {
    return null;
  }

  const message =
    status === "checking"
      ? "Checking backend connectivity…"
      : error || "Backend API not reachable. Is it running?";

  return (
    <div className="bg-red-50 text-red-700 border-b border-red-100 px-4 py-3 text-sm text-center">
      <p className="font-semibold">Backend connectivity warning</p>
      <p className="mt-1">{message}</p>
      {status === "fail" && target && (
        <p className="mt-2 text-xs">
          Attempted to reach {" "}
          <a className="underline" href={target} target="_blank" rel="noopener noreferrer">
            {target}
          </a>
          .
        </p>
      )}
      {apiBaseUrl && (
        <p className="mt-2 text-xs">
          Using <code className="font-mono">{apiBaseUrl}</code> as the API base URL.
        </p>
      )}
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/streams" component={Streams} />
      <Route path="/diagnostics" component={Diagnostics} />
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
  const { status, latency, lastMessageAt } = useQuoteStreamContext();
  const {
    data: backendReady,
    isLoading: isBackendLoading,
    isError: isBackendError,
    error: backendError,
  } = useBackendReady();

  const provider = backendReady?.summary?.provider ?? "unknown";
  const environment = backendReady?.summary?.environment ?? "development";

  let backendStatusText = `${provider} • ${environment}`;
  if (isBackendLoading) {
    backendStatusText = "Checking backend…";
  } else if (isBackendError) {
    backendStatusText = backendError instanceof Error ? backendError.message : "Backend offline";
  }

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between border-b px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <div className="flex items-center gap-2">
              <TradingModeBadge mode="paper" />
              <span className="hidden text-sm text-muted-foreground sm:inline">{backendStatusText}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <WebSocketStatus
              status={status}
              latency={latency ?? undefined}
              lastMessage={lastMessageAt ?? undefined}
            />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <AppRouter />
        </main>
      </SidebarInset>
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
              <QuoteStreamProvider>
                <AppContent />
              </QuoteStreamProvider>
              <DisclaimerBanner />
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
