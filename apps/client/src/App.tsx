import React, { useEffect, useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import { WebSocketStatus } from "@/components/websocket-status";
import { useQuoteStreamContext, QuoteStreamProvider } from "@/context/quote-stream-context";
import { useBackendReady } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { LogOut } from "lucide-react";
import Dashboard from "@/pages/dashboard";
import Streams from "@/pages/streams";
import Diagnostics from "@/pages/diagnostics";
import Settings from "@/pages/settings";
import Login from "@/pages/login";

/* ─── Error Boundary ────────────────────────────────────────────── */
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
        <div className="bg-destructive/10 text-destructive border-b border-destructive/20 px-4 py-3 text-sm">
          <span className="font-semibold">App Error:</span> {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Router ────────────────────────────────────────────────────── */
function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/streams" component={Streams} />
      <Route path="/diagnostics" component={Diagnostics} />
      <Route path="/settings" component={Settings} />
      <Route>
        <Redirect to="/dashboard" />
      </Route>
    </Switch>
  );
}

/* ─── Authenticated Shell ───────────────────────────────────────── */
function AuthenticatedShell() {
  const { status, latency, lastMessageAt, reconnectAttempt } = useQuoteStreamContext();
  const { logout, user } = useAuth();
  const { data: backendReady, isLoading: isBackendLoading } = useBackendReady();

  const provider = backendReady?.summary?.provider ?? "...";
  const environment = backendReady?.summary?.environment ?? "";

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <SidebarInset className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <span className="hidden text-sm font-medium text-primary sm:inline">
              Adaptive Stock Trading
            </span>
            {!isBackendLoading && (
              <span className="hidden text-xs text-muted-foreground lg:inline">
                {provider}{environment ? ` \u00B7 ${environment}` : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <WebSocketStatus
              status={status}
              latency={latency ?? undefined}
              lastMessage={lastMessageAt ?? undefined}
              reconnectAttempt={reconnectAttempt}
            />
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user?.username}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={logout}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <AppRouter />
        </main>
      </SidebarInset>
    </div>
  );
}

/* ─── Gate: login or app ────────────────────────────────────────── */
function AppGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spinner" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <QuoteStreamProvider>
        <AuthenticatedShell />
      </QuoteStreamProvider>
    </SidebarProvider>
  );
}

/* ─── Root ──────────────────────────────────────────────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider defaultTheme="dark" storageKey="rl-trader-theme">
            <TooltipProvider>
              <AppGate />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
