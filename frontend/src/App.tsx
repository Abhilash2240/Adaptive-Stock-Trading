import React, { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { SignInButton, useAuth, useUser } from "@clerk/react";

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

/* ─── Paper Grain Texture Overlay ────────────────────────────────── */
function PaperGrain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.018]"
      aria-hidden="true"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}

/* ─── Error Boundary ─────────────────────────────────────────────── */
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
        <div className="bg-destructive/10 text-destructive border-b border-destructive/20 px-4 py-3 text-sm font-sans">
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

/* ─── Root ───────────────────────────────────────────────────────── */
export default function App() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded } = useUser();

  useEffect(() => {
    setTokenGetter(async () => {
      const token = await getToken({ template: "backend" });
      if (!token) throw new Error("Missing Clerk backend token");
      return token;
    });
    return () => setTokenGetter(null);
  }, [getToken]);

  if (!isLoaded || !isUserLoaded) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center">
        <div className="text-center space-y-3 animate-fade-in">
          {/* Botanical loading mark */}
          <div className="mx-auto h-10 w-10 rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent animate-spinner" />
          <p
            className="text-sm text-muted-foreground"
            style={{ fontFamily: "'Source Sans 3', sans-serif" }}
          >
            Preparing your garden…
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center px-6">
        {/* Paper grain on sign-in screen too */}
        <PaperGrain />
        {/* Decorative blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-[hsl(var(--accent)/0.10)] blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[hsl(var(--destructive)/0.07)] blur-3xl" />
        </div>

        <div className="relative rounded-3xl border border-border bg-card p-10 text-center space-y-5 max-w-sm w-full shadow-botanical-lg animate-fade-in">
          {/* Logotype */}
          <div className="space-y-1">
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
            >
              Adaptive<em className="not-italic font-normal"> Trader</em>
            </h1>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans">
              Intelligent markets
            </p>
          </div>

          <div className="h-px bg-border" />

          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            Sign in to access real-time trading data and your AI agent portfolio.
          </p>

          <SignInButton mode="modal">
            <button className="w-full inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium tracking-wide uppercase text-primary-foreground transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
              style={{ background: "var(--botanical-forest)", letterSpacing: "0.08em" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="rl-trader-theme">
          <TooltipProvider>
            {/* Mandatory paper grain overlay */}
            <PaperGrain />
            <AppGate />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
