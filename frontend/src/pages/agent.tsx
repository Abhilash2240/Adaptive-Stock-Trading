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
    <div className="min-h-screen bg-[#0a0a0f] text-[#f1f5f9]">
      <Sidebar
        activeRoute={location}
        onNavigate={setLocation}
      />

      <main className="ml-60 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">AI Agent</h1>
          <button className="text-sm text-[#6366f1]" onClick={() => refetch()}>Refresh</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={<Activity size={16} />} label="State" value={status?.state ?? "idle"} />
          <Card icon={<Bot size={16} />} label="Model" value={status?.model_version ?? "-"} />
          <Card icon={<Zap size={16} />} label="Epsilon" value={String(status?.epsilon ?? "-")} />
          <Card icon={<Activity size={16} />} label="Buffer" value={String(status?.buffer_size ?? "-")} />
        </div>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="font-semibold">Latest Decision</h2>
          {isLoading ? (
            <p className="text-sm text-[#94a3b8] mt-3">Loading status...</p>
          ) : (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Info label="Symbol" value={status?.last_action?.symbol ?? "-"} />
              <Info label="Action" value={status?.last_action?.side ?? "HOLD"} />
              <Info label="Confidence" value={`${confidence}%`} />
              <Info label="Updated" value={status?.updated_at ? new Date(status.updated_at).toLocaleString() : "-"} />
            </div>
          )}
        </section>

        <section className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
          <h2 className="font-semibold">Manual Training</h2>
          <p className="text-sm text-[#94a3b8] mt-1">Run one or more RL training steps and refresh metrics.</p>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={25}
              value={manualCount}
              onChange={(e) => setManualCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
              className="w-24 bg-[#0d0d14] border border-[#1e1e2e] rounded-md px-3 py-2"
            />
            <button
              onClick={runTraining}
              disabled={train.isPending}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-[#6366f1] text-white disabled:opacity-60"
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
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
      <p className="text-[#94a3b8] text-xs uppercase tracking-wide flex items-center gap-2">{icon}{label}</p>
      <p className="text-xl font-semibold mt-2 capitalize">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-md p-3">
      <p className="text-[#94a3b8] text-xs">{label}</p>
      <p className="text-sm mt-1">{value}</p>
    </div>
  );
}
