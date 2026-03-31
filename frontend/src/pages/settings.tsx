import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bell, Database, Moon, RotateCcw, Settings, Sun, User } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { useTheme } from "@/components/theme-provider";
import { SaveSettingsPayload, useBackendReady, useSaveSettings, useSettings } from "@/hooks/use-api";

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { data: backendReady } = useBackendReady();
  const providerName = backendReady?.summary?.provider ?? "--";
  const userId = "anonymous-user";
  const { data: userSettings } = useSettings(userId);
  const saveSettings = useSaveSettings();
  const [confirmingReset, setConfirmingReset] = useState(false);

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

  const resetSession = async () => {
    await persist({
      notificationsEnabled: true,
      geminiEnabled: false,
      tradingMode: "paper",
    });
    setConfirmingReset(false);
  };

  const persist = async (partial: Partial<SaveSettingsPayload>) => {
    if (!userId) return;
    await saveSettings.mutateAsync({ userId, ...partial });
  };

  return (
    <div className="min-h-screen bg-[#081221] text-[#f1f6ff]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-0 space-y-5 p-4 md:ml-72 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#7f98bb]">System Console</p>
            <h1 className="flex items-center gap-2 text-3xl font-semibold"><Settings size={22} /> Settings</h1>
          </div>
          <span className="text-sm text-[#94a3b8]">Provider: {userSettings?.marketDataProvider ?? providerName}</span>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Metric title="User" value="Guest Trader" icon={<User size={14} />} />
          <Metric title="Provider" value={userSettings?.marketDataProvider ?? providerName} icon={<Database size={14} />} />
          <Metric title="Mode" value={(userSettings?.tradingMode ?? "paper").toUpperCase()} icon={<Bell size={14} />} />
        </section>

        <section className="space-y-4 rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-[#e7f2ff]"><Sun size={16} /> Appearance</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ThemeButton current={theme} value="light" onClick={() => setTheme("light")} icon={<Sun size={14} />} />
            <ThemeButton current={theme} value="dark" onClick={() => setTheme("dark")} icon={<Moon size={14} />} />
            <ThemeButton current={theme} value="system" onClick={() => setTheme("system")} icon={<Settings size={14} />} />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-[#e7f2ff]"><Database size={16} /> Trading Preferences</h2>
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

        <section className="space-y-4 rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
          <h2 className="flex items-center gap-2 font-semibold text-[#e7f2ff]"><Bell size={16} /> Session</h2>
          {confirmingReset ? (
            <div className="space-y-3">
              <p className="text-sm text-[#94a3b8]">Reset this local trading session to defaults?</p>
              <div className="flex gap-3">
                <button onClick={() => void resetSession()} className="rounded-md bg-[#ef4444] px-4 py-2 text-white">Confirm Reset</button>
                <button onClick={() => setConfirmingReset(false)} className="rounded-md border border-[#35527d] bg-[#152848] px-4 py-2 text-[#d6e6ff]">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmingReset(true)} className="inline-flex items-center gap-2 rounded-md bg-[#ef4444] px-4 py-2 text-white">
              <RotateCcw size={14} />
              Reset Session
            </button>
          )}
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#29466f] pb-2 text-sm">
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
        "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2",
        active ? "border-[#2d8bff] bg-[#2d8bff] text-white" : "border-[#35527d] bg-[#0d1c33] text-[#d5e7ff]",
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
    <div className="flex items-center justify-between gap-4 border-b border-[#29466f] pb-3">
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

function Metric({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#8aa4c7]">{icon}{title}</p>
      <p className="mt-2 text-xl font-semibold text-[#edf4ff]">{value}</p>
    </div>
  );
}
