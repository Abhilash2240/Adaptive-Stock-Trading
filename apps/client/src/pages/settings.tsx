import { useState } from "react";
import { Settings, User, Palette, Database, LogOut, Sun, Moon, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/components/theme-provider";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WATCHED_SYMBOLS = ["AAPL", "MSFT", "TSLA", "GOOGL", "AMZN"] as const;
const POLL_INTERVAL_SECONDS = 60;
const DATA_PROVIDER = "Twelve Data";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const handleLogout = () => {
    if (!confirmingLogout) {
      setConfirmingLogout(true);
      return;
    }
    logout();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" data-testid="page-settings">
      {/* Page header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight flex items-center gap-2"
          data-testid="text-page-title"
        >
          <Settings className="h-7 w-7" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Account, appearance, and system configuration
        </p>
      </div>

      {/* ── 1. Account ──────────────────────────────────────────── */}
      <Card
        className="bg-card border rounded-xl shadow-sm animate-fade-in stagger-1"
        data-testid="card-account"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Your profile and account status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Username</span>
            <span className="font-medium">{user?.username ?? "---"}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {user?.is_active ? (
              <Badge className="bg-accent text-accent-foreground">Active</Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Member since</span>
            <span className="font-medium">
              {user?.created_at ? formatDate(user.created_at) : "---"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── 2. Appearance ───────────────────────────────────────── */}
      <Card
        className="bg-card border rounded-xl shadow-sm animate-fade-in stagger-2"
        data-testid="card-appearance"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className={
                theme === "light"
                  ? "ring-2 ring-accent flex-1"
                  : "flex-1"
              }
              onClick={() => setTheme("light")}
              data-testid="button-theme-light"
            >
              <Sun className="h-4 w-4 mr-2" />
              Light
            </Button>
            <Button
              variant="outline"
              className={
                theme === "dark"
                  ? "ring-2 ring-accent flex-1"
                  : "flex-1"
              }
              onClick={() => setTheme("dark")}
              data-testid="button-theme-dark"
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </Button>
            <Button
              variant="outline"
              className={
                theme === "system"
                  ? "ring-2 ring-accent flex-1"
                  : "flex-1"
              }
              onClick={() => setTheme("system")}
              data-testid="button-theme-system"
            >
              <Monitor className="h-4 w-4 mr-2" />
              System
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Market Data ──────────────────────────────────────── */}
      <Card
        className="bg-card border rounded-xl shadow-sm animate-fade-in stagger-3"
        data-testid="card-market-data"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Market Data
          </CardTitle>
          <CardDescription>
            Current data feed configuration (read-only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Provider</span>
            <span className="font-medium">{DATA_PROVIDER}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Poll interval</span>
            <span className="font-medium">{POLL_INTERVAL_SECONDS}s</span>
          </div>
          <Separator />
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Watched symbols</span>
            <div className="flex flex-wrap gap-2">
              {WATCHED_SYMBOLS.map((symbol) => (
                <Badge key={symbol} variant="secondary">
                  {symbol}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 4. Session ──────────────────────────────────────────── */}
      <Card
        className="bg-card border rounded-xl shadow-sm animate-fade-in stagger-4"
        data-testid="card-session"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Session
          </CardTitle>
          <CardDescription>
            Sign out of your current session
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmingLogout ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to sign out?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  data-testid="button-confirm-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Confirm Sign Out
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmingLogout(false)}
                  data-testid="button-cancel-logout"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="destructive"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
