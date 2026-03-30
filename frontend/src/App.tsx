import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { AuthPage } from "@/pages/AuthPage";
import Dashboard from "@/pages/dashboard";
import Portfolio from "@/pages/portfolio";
import Trades from "@/pages/trades";
import Agent from "@/pages/agent";
import Settings from "@/pages/settings";

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

/* ─── Route gate ─────────────────────────────────────────────────── */
function AppGate() {
  const { isAuthenticated, isLoading, login, register, error } = useAuth();

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

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? (
          <Redirect to="/dashboard" />
        ) : (
          <AuthPage
            onLogin={(email, password) => {
              void login(email, password);
            }}
            onRegister={(email, password) => {
              void register(email, password);
            }}
            isLoading={isLoading}
            error={error}
          />
        )}
      </Route>

      <Route path="/dashboard">{isAuthenticated ? <Dashboard /> : <Redirect to="/login" />}</Route>
      <Route path="/portfolio">{isAuthenticated ? <Portfolio /> : <Redirect to="/login" />}</Route>
      <Route path="/trades">{isAuthenticated ? <Trades /> : <Redirect to="/login" />}</Route>
      <Route path="/agent">{isAuthenticated ? <Agent /> : <Redirect to="/login" />}</Route>
      <Route path="/settings">{isAuthenticated ? <Settings /> : <Redirect to="/login" />}</Route>

      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      <Route>
        <Redirect to={isAuthenticated ? "/dashboard" : "/login"} />
      </Route>
    </Switch>
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
