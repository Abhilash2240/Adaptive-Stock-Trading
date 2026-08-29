import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bell, Database, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";

import { Sidebar } from "@/components/Sidebar";
import { useTheme } from "@/components/theme-provider";
import { SaveSettingsPayload, useBackendReady, useSaveSettings, useSettings } from "@/hooks/use-api";

export default function SettingsPage() {
  const [location, setLocation]   = useLocation();
  const { user }                  = useUser();
  const { signOut }               = useClerk();
  const { theme, setTheme }       = useTheme();
  const { data: backendReady }    = useBackendReady();
  const providerName              = backendReady?.summary?.provider ?? "—";
  const userId                    = user?.id ?? "";
  const { data: userSettings }    = useSettings(userId);
  const saveSettings              = useSaveSettings();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    userSettings?.notificationsEnabled ?? true,
  );
  const [llmRationaleEnabled, setLlmRationaleEnabled] = useState<boolean>(
    userSettings?.llmRationaleEnabled ?? true,
  );

  useEffect(() => {
    if (!userSettings) return;
    setNotificationsEnabled(userSettings.notificationsEnabled);
    setLlmRationaleEnabled(userSettings.llmRationaleEnabled);
  }, [userSettings]);

  const handleLogout = () => {
    void signOut({ redirectUrl: window.location.origin });
  };

  const persist = async (partial: Partial<SaveSettingsPayload>) => {
    if (!userId) return;
    await saveSettings.mutateAsync({ userId, ...partial });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient blob */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-64 w-full max-w-lg rounded-full bg-[hsl(var(--accent)/0.06)] blur-3xl" />
      </div>

      <Sidebar activeRoute={location} onNavigate={setLocation} />

      <main className="ml-60 p-8 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-sans">
              Preferences
            </p>
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              <em>Settings</em>
            </h1>
          </div>
          <span className="text-xs text-muted-foreground font-sans pt-2">
            Provider: <span className="text-foreground capitalize">{userSettings?.marketDataProvider ?? providerName}</span>
          </span>
        </div>

        {/* Account */}
        <SettingsSection
          icon={<User size={15} strokeWidth={1.5} />}
          title="Account"
          delay={1}
        >
          <InfoRow label="Email"   value={user?.primaryEmailAddress?.emailAddress ?? "—"} />
          <InfoRow label="Status"  value={user ? "Active" : "Signed out"} />
          <InfoRow label="Updated" value={user?.updatedAt ? user.updatedAt.toLocaleDateString() : "—"} />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection
          icon={<Sun size={15} strokeWidth={1.5} />}
          title="Appearance"
          delay={2}
        >
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-sans mb-3">Theme</p>
            <div className="flex gap-2 flex-wrap">
              {(["light", "dark", "system"] as const).map((t) => (
                <ThemeButton
                  key={t}
                  current={theme}
                  value={t}
                  onClick={() => setTheme(t)}
                  icon={
                    t === "light"
                      ? <Sun size={13} strokeWidth={1.5} />
                      : t === "dark"
                        ? <Moon size={13} strokeWidth={1.5} />
                        : <Settings size={13} strokeWidth={1.5} />
                  }
                />
              ))}
            </div>
          </div>
        </SettingsSection>

        {/* Trading Preferences */}
        <SettingsSection
          icon={<Database size={15} strokeWidth={1.5} />}
          title="Trading Preferences"
          delay={3}
        >
          <ToggleRow
            label="Notifications"
            description="Enable execution and system alerts"
            checked={notificationsEnabled}
            onToggle={async () => {
              const next = !notificationsEnabled;
              setNotificationsEnabled(next);
              await persist({ notificationsEnabled: next });
            }}
          />
          <ToggleRow
            label="Trade Rationale"
            description="Allow model-generated rationale in the UI"
            checked={llmRationaleEnabled}
            onToggle={async () => {
              const next = !llmRationaleEnabled;
              setLlmRationaleEnabled(next);
              await persist({ llmRationaleEnabled: next });
            }}
          />
          <InfoRow
            label="Trading Mode"
            value={(userSettings?.tradingMode ?? "paper").toUpperCase()}
          />
        </SettingsSection>

        {/* Session */}
        <SettingsSection
          icon={<Bell size={15} strokeWidth={1.5} />}
          title="Session"
          delay={4}
        >
          {confirmingLogout ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground font-sans leading-relaxed">
                Are you sure you want to sign out of this trading session?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:opacity-90 font-sans"
                  style={{ background: "var(--signal-sell)" }}
                >
                  Confirm Sign Out
                </button>
                <button
                  onClick={() => setConfirmingLogout(false)}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-all duration-300 font-sans"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingLogout(true)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-widest border border-border text-muted-foreground hover:border-[var(--signal-sell)] hover:text-[var(--signal-sell)] transition-all duration-300 font-sans"
            >
              <LogOut size={14} strokeWidth={1.5} />
              Sign Out
            </button>
          )}
        </SettingsSection>
      </main>
    </div>
  );
}

/* ─── Settings Section Card ──────────────────────────────────────── */
function SettingsSection({
  icon, title, children, delay = 1,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-border bg-card p-7 shadow-botanical space-y-5 animate-fade-in",
        `stagger-${delay}`,
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center"
          style={{ background: "hsl(var(--accent)/0.10)" }}
        >
          <span className="text-[hsl(var(--accent))]">{icon}</span>
        </div>
        <h2
          className="font-semibold text-base"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-4 pl-11">
        {children}
      </div>
    </section>
  );
}

/* ─── Info Row ───────────────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs uppercase tracking-widest text-muted-foreground font-sans">{label}</span>
      <span className="text-sm font-medium text-foreground font-sans">{value}</span>
    </div>
  );
}

/* ─── Theme Button ───────────────────────────────────────────────── */
function ThemeButton({
  current, value, onClick, icon,
}: {
  current: string;
  value: "light" | "dark" | "system";
  onClick: () => void;
  icon: ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wide border transition-all duration-300 font-sans",
        active
          ? "text-primary-foreground border-transparent"
          : "border-border text-muted-foreground hover:border-[hsl(var(--accent))] hover:text-foreground",
      ].join(" ")}
      style={active ? { background: "var(--botanical-forest)" } : {}}
    >
      {icon}
      {value[0].toUpperCase() + value.slice(1)}
    </button>
  );
}

/* ─── Toggle Row ─────────────────────────────────────────────────── */
function ToggleRow({
  label, description, checked, onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5 border-b border-border/60 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground font-sans">{label}</p>
        <p className="text-xs text-muted-foreground font-sans mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        className={[
          "relative h-7 w-[52px] flex-shrink-0 rounded-full transition-colors duration-300",
          checked ? "" : "bg-border",
        ].join(" ")}
        style={checked ? { background: "hsl(var(--accent))" } : {}}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300",
            checked ? "left-7" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
