import { FormEvent, useState } from "react";
import {
  TrendingUp,
  BarChart3,
  Shield,
  Zap,
  Eye,
  EyeOff,
  ArrowRight,
  Activity,
  Bot,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";

/* ------------------------------------------------------------------ */
/*  Animated decorative chart (SVG)                                    */
/* ------------------------------------------------------------------ */
function FloatingChart() {
  return (
    <svg
      viewBox="0 0 400 200"
      className="w-full max-w-md opacity-20"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points="0,180 30,160 60,170 90,120 120,130 150,80 180,90 210,50 240,70 270,30 300,60 330,40 360,20 400,45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        className="animate-pulse"
      />
      <polygon
        points="0,200 0,180 30,160 60,170 90,120 120,130 150,80 180,90 210,50 240,70 270,30 300,60 330,40 360,20 400,45 400,200"
        fill="url(#chartGrad)"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature pill                                                       */
/* ------------------------------------------------------------------ */
function Feature({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main login page                                                    */
/* ------------------------------------------------------------------ */
export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const { login, register } = useAuth();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      setMessage("Please fill in all fields.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ── Left: Branding panel ───────────────────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 p-10 text-white lg:flex">
        {/* background pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        {/* top: logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Adaptive Stock Trading
              </h1>
              <p className="text-xs text-white/70">
                Deep Reinforcement Learning Platform
              </p>
            </div>
          </div>
        </div>

        {/* middle: hero */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
              Trade smarter
              <br />
              with AI-powered
              <br />
              <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">
                decisions.
              </span>
            </h2>
            <p className="max-w-sm text-base leading-relaxed text-white/75">
              Harness the power of Double Deep Q-Networks to analyse markets,
              backtest strategies, and execute trades with confidence.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Feature icon={Bot} text="DDQN Agent" />
            <Feature icon={BarChart3} text="Real-time Analytics" />
            <Feature icon={Shield} text="Paper Trading" />
            <Feature icon={Zap} text="Auto Backtesting" />
          </div>

          <FloatingChart />
        </div>

        {/* bottom: copyright */}
        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} Adaptive Stock Trading · Research &amp;
          Educational Use Only
        </p>
      </div>

      {/* ── Right: Auth form ────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center bg-background px-6 py-12 sm:px-12">
        {/* mobile-only brand strip */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Adaptive Stock Trading
          </span>
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* heading */}
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Enter your credentials to access the trading dashboard"
                : "Set up your account to start trading with AI"}
            </p>
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="e.g. trader_jane"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "register" ? "Min. 8 characters" : "••••••••"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {message && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-sm">
                  {message}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="h-11 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* toggle mode */}
          <div className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&rsquo;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setMessage(null);
                  }}
                  className="font-medium text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMessage(null);
                  }}
                  className="font-medium text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {/* bottom legal */}
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground/60">
            By continuing, you agree that this platform is for{" "}
            <span className="font-medium text-muted-foreground">
              research &amp; educational purposes only
            </span>
            . No real money is used.
          </p>
        </div>
      </div>
    </div>
  );
}
