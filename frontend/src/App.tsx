import React, { useEffect, type ReactNode } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { setTokenGetter } from "@/hooks/use-api";
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

function AppGate() {
  return (
    <Switch>
      <Route path="/dashboard"><Dashboard /></Route>
      <Route path="/portfolio"><Portfolio /></Route>
      <Route path="/trades"><Trades /></Route>
      <Route path="/agent"><Agent /></Route>
      <Route path="/settings"><Settings /></Route>

      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route>
        <Redirect to="/dashboard" />
      </Route>
    </Switch>
  );
}

/* ─── Root ──────────────────────────────────────────────────────── */
export default function App() {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    setTokenGetter(() =>
      getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      }),
    );
    return () => setTokenGetter(null);
  }, [getAccessTokenSilently]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="rl-trader-theme">
          <TooltipProvider>
            <AppGate />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
