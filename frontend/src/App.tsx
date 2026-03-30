import React, { type ReactNode, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useAuth0 } from "@auth0/auth0-react";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
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

/* ─── Route gate ─────────────────────────────────────────────────── */
function LoginRedirect() {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Redirecting to login...</p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

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
    return null;
  }

  return <>{children}</>;
}

function TokenWirer() {
  const { getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    setTokenGetter(() =>
      getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        },
      }),
    );

    return () => {
      setTokenGetter(null);
    };
  }, [getAccessTokenSilently]);

  return null;
}

function AppGate() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        <LoginRedirect />
      </Route>

      <Route path="/dashboard"><ProtectedRoute><Dashboard /></ProtectedRoute></Route>
      <Route path="/portfolio"><ProtectedRoute><Portfolio /></ProtectedRoute></Route>
      <Route path="/trades"><ProtectedRoute><Trades /></ProtectedRoute></Route>
      <Route path="/agent"><ProtectedRoute><Agent /></ProtectedRoute></Route>
      <Route path="/settings"><ProtectedRoute><Settings /></ProtectedRoute></Route>

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
          <TokenWirer />
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
