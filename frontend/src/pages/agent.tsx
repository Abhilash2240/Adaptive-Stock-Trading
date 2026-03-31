import { ReactNode, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Activity, Bot, Play, Zap } from "lucide-react";

import { Sidebar } from "@/components/Sidebar";
import { useAgentStatus, useTrainStep } from "@/hooks/use-api";

export default function AgentPage() {
  const [location, setLocation] = useLocation();

  const { data: status, isLoading, refetch } = useAgentStatus(true);
  const train = useTrainStep();
  const [manualCount, setManualCount] = useState(1);

  const confidence = useMemo(() => Math.round((status?.last_action?.confidence ?? 0) * 100), [status]);

  const runTraining = async () => {
    for (let i = 0; i < manualCount; i += 1) {
      await train.mutateAsync();
    }
    await refetch();
  };

  return (
    <div className="min-h-screen bg-[#081221] text-[#f1f6ff]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-72 space-y-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[#7f98bb]">Automation Desk</p>
            <h1 className="text-3xl font-semibold">AI Agent</h1>
          </div>
          <button className="rounded-md border border-[#35527d] bg-[#152848] px-3 py-1.5 text-sm text-[#d6e6ff]" onClick={() => refetch()}>Refresh</button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card icon={<Activity size={16} />} label="State" value={status?.state ?? "idle"} />
          <Card icon={<Bot size={16} />} label="Model" value={status?.model_version ?? "-"} />
          <Card icon={<Zap size={16} />} label="Epsilon" value={String(status?.epsilon ?? "-")} />
          <Card icon={<Activity size={16} />} label="Buffer" value={String(status?.buffer_size ?? "-")} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <section className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
            <h2 className="font-semibold text-[#e8f2ff]">Latest Decision</h2>
            {isLoading ? (
              <p className="mt-3 text-sm text-[#94a3b8]">Loading status...</p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <Info label="Symbol" value={status?.last_action?.symbol ?? "-"} />
                <Info label="Action" value={status?.last_action?.side ?? "HOLD"} />
                <Info label="Confidence" value={`${confidence}%`} />
                <Info label="Updated" value={status?.updated_at ? new Date(status.updated_at).toLocaleString() : "-"} />
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
            <h2 className="font-semibold text-[#e8f2ff]">Signal Confidence</h2>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-xs text-[#9bb3d2]">
                <span>Confidence</span>
                <span>{confidence}%</span>
              </div>
              <div className="h-2 rounded bg-[#213a5e]">
                <div className="h-2 rounded bg-[#2d8bff]" style={{ width: `${confidence}%` }} />
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[#bfd2ed]">
              <div className="flex items-center justify-between border-b border-[#233b5f] pb-2">
                <span>Side</span>
                <span className="font-semibold text-[#f0f6ff]">{status?.last_action?.side ?? "HOLD"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#233b5f] pb-2">
                <span>Step Count</span>
                <span className="font-semibold text-[#f0f6ff]">{status?.step_count ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between pb-2">
                <span>Last Trained</span>
                <span className="font-semibold text-[#f0f6ff]">{status?.last_trained ? new Date(status.last_trained).toLocaleTimeString() : "-"}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
          <h2 className="font-semibold text-[#e8f2ff]">Manual Training</h2>
          <p className="mt-1 text-sm text-[#94a3b8]">Run one or more RL training steps and refresh metrics.</p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={25}
              value={manualCount}
              onChange={(e) => setManualCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
              className="w-24 rounded-md border border-[#35527d] bg-[#0d1c33] px-3 py-2"
            />
            <button
              onClick={runTraining}
              disabled={train.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-[#2d8bff] px-4 py-2 text-white disabled:opacity-60"
            >
              <Play size={14} />
              {train.isPending ? "Training..." : "Run Training"}
            </button>
          </div>
          {train.data && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <Info label="Loss" value={train.data.loss == null ? "-" : train.data.loss.toFixed(4)} />
              <Info label="Epsilon" value={train.data.epsilon.toFixed(4)} />
              <Info label="Steps" value={String(train.data.steps)} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Card({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#233b5f] bg-[#0f1d34] p-5">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#94a3b8]">{icon}{label}</p>
      <p className="mt-2 text-xl font-semibold capitalize">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#2b4670] bg-[#0d1c33] p-3">
      <p className="text-xs text-[#94a3b8]">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
