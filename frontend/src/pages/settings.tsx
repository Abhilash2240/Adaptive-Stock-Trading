import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bell, Database, LogOut, Moon, Settings, Sun, User } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/components/theme-provider";
import { SaveSettingsPayload, useBackendReady, useSaveSettings, useSettings } from "@/hooks/use-api";

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: backendReady } = useBackendReady();
  const providerName = backendReady?.summary?.provider ?? "--";
  const userId = user?.id ?? "";
  const { data: userSettings } = useSettings(userId);
  const saveSettings = useSaveSettings();

  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    userSettings?.notificationsEnabled ?? true,
  );
  const [geminiEnabled, setGeminiEnabled] = useState<boolean>(
    userSettings?.geminiEnabled ?? true,
  );

  useEffect(() => {
    if (!userSettings) return;
    setNotificationsEnabled(userSettings.notificationsEnabled);
    setGeminiEnabled(userSettings.geminiEnabled);
  }, [userSettings]);

  const persist = async (partial: Partial<SaveSettingsPayload>) => {
    if (!userId) return;
    await saveSettings.mutateAsync({ userId, ...partial });
  };

  const handleLogout = () => {
    if (!confirmingLogout) {
      setConfirmingLogout(true);
      return;
    }
    logout();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f5f9]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
        userEmail={user?.username ?? ""}
        onSignOut={logout}
      />

      <main className="ml-60 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings size={22} /> Settings</h1>
          <span className="text-sm text-[#94a3b8]">Provider: {userSettings?.marketDataProvider ?? providerName}</span>
        </div>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><User size={16} /> Account</h2>
          <Row label="User" value={user?.username ?? "-"} />
          <Row label="Status" value={user?.is_active ? "Active" : "Inactive"} />
          <Row
            label="Created"
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
          />
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Sun size={16} /> Appearance</h2>
          <div className="flex gap-3">
            <ThemeButton current={theme} value="light" onClick={() => setTheme("light")} icon={<Sun size={14} />} />
            <ThemeButton current={theme} value="dark" onClick={() => setTheme("dark")} icon={<Moon size={14} />} />
            <ThemeButton current={theme} value="system" onClick={() => setTheme("system")} icon={<Settings size={14} />} />
          </div>
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Database size={16} /> Trading Preferences</h2>
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
            label="Gemini Assistance"
            description="Allow model-generated rationale in the UI"
            checked={geminiEnabled}
            onToggle={async () => {
              const next = !geminiEnabled;
              setGeminiEnabled(next);
              await persist({ geminiEnabled: next });
            }}
          />
          <Row label="Trading Mode" value={(userSettings?.tradingMode ?? "paper").toUpperCase()} />
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Bell size={16} /> Session</h2>
          {confirmingLogout ? (
            <div className="space-y-3">
              <p className="text-sm text-[#94a3b8]">Are you sure you want to sign out of this trading session?</p>
              <div className="flex gap-3">
                <button onClick={handleLogout} className="rounded-md px-4 py-2 bg-[#ef4444] text-white">Confirm Sign Out</button>
                <button onClick={() => setConfirmingLogout(false)} className="rounded-md px-4 py-2 bg-[#1e1e2e]">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-[#ef4444] text-white">
              <LogOut size={14} />
              Sign Out
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm border-b border-[#1e1e2e] pb-2">
      <span className="text-[#94a3b8]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ThemeButton({
  current,
  value,
  onClick,
  icon,
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
        "inline-flex items-center gap-2 px-3 py-2 rounded-md border",
        active ? "bg-[#6366f1] border-[#6366f1]" : "bg-[#0d0d14] border-[#1e1e2e]",
      ].join(" ")}
    >
      {icon}
      {value[0].toUpperCase() + value.slice(1)}
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#1e1e2e] pb-3">
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-xs text-[#94a3b8]">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={[
          "h-7 w-14 rounded-full relative transition-colors",
          checked ? "bg-[#22c55e]" : "bg-[#334155]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
            checked ? "left-8" : "left-1",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
