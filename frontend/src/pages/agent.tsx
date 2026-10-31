import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Activity, Bot, Loader2, Play, Zap, Brain, Database, RefreshCw, Calendar } from "lucide-react";
import { useUser } from "@clerk/react";

import { Sidebar } from "@/components/Sidebar";
import {
  useAgentRationale,
  useAgentStatus,
  useSettings,
  useTrainStep,
  useDailyTrain,
  useSyncStockPrices,
  useStockDbStats,
  useTrainingRuns,
} from "@/hooks/use-api";

export default function AgentPage() {
  const [location, setLocation] = useLocation();
  const { user } = useUser();

  const { data: status, isLoading, refetch } = useAgentStatus(false);

  // Fetch once on mount so the page isn't permanently empty
  useEffect(() => { refetch(); }, []);
  const { data: userSettings }               = useSettings(user?.id ?? "");
  const train                                = useTrainStep();
  const dailyTrain                           = useDailyTrain();
  const syncPrices                           = useSyncStockPrices();
  const { data: dbStats }                    = useStockDbStats(true);
  const { data: trainingRuns }               = useTrainingRuns(5, true);
  const rationaleEnabled                     = userSettings?.llmRationaleEnabled === true;
  const decisionSymbol                       = status?.last_action?.symbol ?? "";
  const rationale                            = useAgentRationale(decisionSymbol, rationaleEnabled);
  const [manualCount, setManualCount]        = useState(1);
  const [trainProgress, setTrainProgress]    = useState<{ done: number; total: number } | null>(null);
  const [trainError, setTrainError]          = useState<string | null>(null);
  const [dailyTrainResult, setDailyTrainResult] = useState<string | null>(null);
  const [syncSymbol, setSyncSymbol]          = useState("AAPL");

  const confidence = useMemo(
    () => Math.round((status?.last_action?.confidence ?? 0) * 100),
    [status],
  );

  const runTraining = async () => {
    setTrainError(null);
    setTrainProgress({ done: 0, total: manualCount });
    try {
      for (let i = 0; i < manualCount; i += 1) {
        await train.mutateAsync();
        setTrainProgress({ done: i + 1, total: manualCount });
      }
      await refetch();
    } catch (err) {
      setTrainError(err instanceof Error ? err.message : "Training failed. Check the backend logs.");
    } finally {
      setTrainProgress(null);
    }
  };

  const runDailyTrain = async () => {
    setDailyTrainResult(null);
    try {
      const result = await dailyTrain.mutateAsync({ epochs: 1 });
      setDailyTrainResult(
        `Done! ${result.training_results.steps} steps · ε=${result.training_results.epsilon.toFixed(4)} · reward=${result.training_results.total_reward.toFixed(3)}`
      );
      await refetch();
    } catch (err) {
      setDailyTrainResult(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-20 right-0 h-[28rem] w-[28rem] rounded-full bg-[hsl(var(--accent)/0.08)] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[hsl(var(--destructive)/0.05)] blur-3xl" />
      </div>

      <Sidebar activeRoute={location} onNavigate={setLocation} />

      <main className="ml-60 p-8 space-y-7">
        {/* Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-sans">
              Reinforcement learning
            </p>
            <h1
              className="text-3xl font-semibold text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              AI <em>Agent</em>
            </h1>
          </div>
          <button
            className="text-xs uppercase tracking-widest text-[hsl(var(--accent))] hover:text-foreground transition-colors duration-300 font-sans pt-2"
            onClick={() => refetch()}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: <Activity size={15} strokeWidth={1.5} />, label: "State",  value: status?.state ?? "idle" },
            { icon: <Bot      size={15} strokeWidth={1.5} />, label: "Model",  value: status?.model_version ?? "—" },
            { icon: <Zap      size={15} strokeWidth={1.5} />, label: "Epsilon",value: String(status?.epsilon ?? "—") },
            { icon: <Activity size={15} strokeWidth={1.5} />, label: "Buffer", value: String(status?.buffer_size ?? "—") },
          ].map((c, i) => (
            <MetricCard key={c.label} icon={c.icon} label={c.label} value={c.value} delay={i + 1} />
          ))}
        </div>

        {/* Latest Decision */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-botanical animate-fade-in stagger-2">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--accent)/0.12)" }}
            >
              <Brain size={16} strokeWidth={1.5} className="text-[hsl(var(--accent))]" />
            </div>
            <h2
              className="font-semibold text-base"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Latest Decision
            </h2>
          </div>

          {isLoading && !status ? (
            <div className="py-8 text-center">
              <Loader2 size={20} className="animate-spin mx-auto text-[hsl(var(--accent))] mb-2" />
              <p className="text-sm text-muted-foreground font-sans">Loading agent status…</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Symbol"     value={status?.last_action?.symbol ?? "—"} />
              <InfoRow label="Action"     value={status?.last_action?.side ?? "HOLD"} />
              <InfoRow label="Confidence" value={`${confidence}%`} />
              <InfoRow
                label="Updated"
                value={status?.updated_at ? new Date(status.updated_at).toLocaleString() : "—"}
              />
            </div>
          )}

          {/* Confidence bar */}
          {status && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-sans mb-1.5">
                <span className="uppercase tracking-widest">Confidence</span>
                <span className="font-mono">{confidence}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${confidence}%`,
                    background: "hsl(var(--accent))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Rationale */}
          {rationaleEnabled && decisionSymbol && (
            <div className="mt-6 border-t border-border pt-5">
              <button
                onClick={() => rationale.mutate()}
                disabled={rationale.isPending}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:opacity-90 disabled:opacity-60 font-sans"
                style={{ background: "var(--botanical-forest)" }}
              >
                {rationale.isPending && <Loader2 size={13} className="animate-spin" />}
                {rationale.isPending ? "Explaining…" : "Explain this decision"}
              </button>

              {rationale.data && (
                <div
                  className="mt-4 rounded-2xl border-l-2 pl-4 py-3 pr-3 text-sm text-muted-foreground font-sans leading-relaxed"
                  style={{
                    borderColor: "hsl(var(--accent))",
                    background: "hsl(var(--accent)/0.04)",
                  }}
                >
                  {rationale.data.rationale ?? "No rationale available"}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Manual Training */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-botanical animate-fade-in stagger-3">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--destructive)/0.10)" }}
            >
              <Play size={15} strokeWidth={1.5} className="text-[hsl(var(--destructive))]" />
            </div>
            <h2
              className="font-semibold text-base"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Manual Training
            </h2>
          </div>
          <p className="text-sm text-muted-foreground font-sans mb-5 ml-12">
            Run one or more RL training steps and refresh agent metrics.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={25}
              value={manualCount}
              onChange={(e) => setManualCount(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
              disabled={train.isPending}
              className="w-24 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-mono text-center text-foreground focus:outline-none focus:border-[hsl(var(--accent))] transition-colors disabled:opacity-50"
            />
            <button
              onClick={runTraining}
              disabled={train.isPending}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 font-sans"
              style={{ background: "var(--botanical-forest)" }}
            >
              {train.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {train.isPending
                ? trainProgress
                  ? `Step ${trainProgress.done}/${trainProgress.total}…`
                  : "Training…"
                : "Run Training"}
            </button>
          </div>

          {/* Progress bar for multi-step training */}
          {trainProgress && trainProgress.total > 1 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-sans mb-1.5">
                <span className="uppercase tracking-widest">Progress</span>
                <span className="font-mono">{trainProgress.done}/{trainProgress.total} steps</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{
                    width: `${(trainProgress.done / trainProgress.total) * 100}%`,
                    background: "hsl(var(--accent))",
                  }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {trainError && (
            <div
              className="mt-4 rounded-2xl border-l-2 pl-4 py-3 pr-3 text-sm font-sans leading-relaxed"
              style={{ borderColor: "hsl(var(--destructive))", background: "hsl(var(--destructive)/0.06)", color: "hsl(var(--destructive))" }}
            >
              ⚠ {trainError}
            </div>
          )}

          {/* Last step results */}
          {!trainError && train.data && (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <InfoRow label="Loss"    value={train.data.loss == null ? "—" : train.data.loss.toFixed(4)} />
              <InfoRow label="Epsilon" value={train.data.epsilon.toFixed(4)} />
              <InfoRow label="Steps"   value={String(train.data.steps)} />
            </div>
          )}
        </section>

        {/* Daily Training from Database */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-botanical animate-fade-in stagger-4">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--accent)/0.12)" }}
            >
              <Calendar size={15} strokeWidth={1.5} className="text-[hsl(var(--accent))]" />
            </div>
            <h2
              className="font-semibold text-base"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Daily Training <span className="text-muted-foreground text-sm font-normal">(from stored prices)</span>
            </h2>
          </div>
          <p className="text-sm text-muted-foreground font-sans mb-5 ml-12">
            Sync daily OHLCV candles from the market data provider and train the agent on stored database prices.
          </p>

          <button
            onClick={runDailyTrain}
            disabled={dailyTrain.isPending}
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 font-sans"
            style={{ background: "hsl(var(--accent))" }}
          >
            {dailyTrain.isPending ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
            {dailyTrain.isPending ? "Running daily train…" : "Run Daily Training"}
          </button>

          {dailyTrainResult && (
            <div
              className="mt-4 rounded-2xl border-l-2 pl-4 py-3 pr-3 text-sm font-sans leading-relaxed"
              style={{
                borderColor: dailyTrainResult.startsWith("Error") ? "hsl(var(--destructive))" : "hsl(var(--accent))",
                background: dailyTrainResult.startsWith("Error") ? "hsl(var(--destructive)/0.06)" : "hsl(var(--accent)/0.04)",
                color: dailyTrainResult.startsWith("Error") ? "hsl(var(--destructive))" : "inherit",
              }}
            >
              {dailyTrainResult.startsWith("Error") ? "⚠ " : "✓ "}{dailyTrainResult}
            </div>
          )}

          {/* Recent training runs */}
          {trainingRuns && trainingRuns.length > 0 && (
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans mb-3">Recent Training Runs</p>
              <div className="space-y-2">
                {trainingRuns.slice(0, 3).map((run) => (
                  <div key={run.id} className="flex items-center justify-between rounded-2xl border border-border bg-background/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${run.status === "completed" ? "bg-green-500" : run.status === "failed" ? "bg-red-500" : "bg-yellow-500"}`}
                      />
                      <span className="text-xs font-mono text-foreground">{run.symbol}</span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans">{run.status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      <span>{run.steps} steps</span>
                      {run.epsilon != null && <span>ε={run.epsilon.toFixed(3)}</span>}
                      <span>{new Date(run.started_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Stock Price Database */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-botanical animate-fade-in stagger-4">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center"
              style={{ background: "hsl(var(--accent)/0.10)" }}
            >
              <Database size={15} strokeWidth={1.5} className="text-[hsl(var(--accent))]" />
            </div>
            <h2
              className="font-semibold text-base"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Stock Price Database
            </h2>
          </div>
          <p className="text-sm text-muted-foreground font-sans mb-5 ml-12">
            Sync and inspect the stored historical price data used for training.
          </p>

          {/* DB Stats */}
          {dbStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <InfoRow label="Quotes stored"  value={String(dbStats.quotes_count)} />
              <InfoRow label="OHLCV candles"  value={String(dbStats.ohlcv_count)} />
              <InfoRow label="Symbols tracked" value={dbStats.symbols.join(", ") || "—"} />
            </div>
          )}

          {/* Manual Sync */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="AAPL"
              value={syncSymbol}
              onChange={(e) => setSyncSymbol(e.target.value.toUpperCase())}
              disabled={syncPrices.isPending}
              className="w-28 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-mono text-center text-foreground focus:outline-none focus:border-[hsl(var(--accent))] transition-colors disabled:opacity-50 uppercase"
            />
            <button
              onClick={() => syncPrices.mutate({ symbol: syncSymbol, days: 30 })}
              disabled={syncPrices.isPending || !syncSymbol}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-semibold uppercase tracking-widest transition-all duration-300 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 font-sans border border-border bg-background text-foreground"
            >
              {syncPrices.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {syncPrices.isPending ? "Syncing…" : "Sync 30d"}
            </button>
          </div>

          {syncPrices.data && (
            <div
              className="mt-4 rounded-2xl border-l-2 pl-4 py-3 pr-3 text-sm font-sans"
              style={{ borderColor: "hsl(var(--accent))", background: "hsl(var(--accent)/0.04)" }}
            >
              ✓ Synced <strong>{syncPrices.data.synced_days}</strong> days of {syncPrices.data.symbol} prices
            </div>
          )}

          {syncPrices.isError && (
            <div
              className="mt-4 rounded-2xl border-l-2 pl-4 py-3 pr-3 text-sm font-sans"
              style={{ borderColor: "hsl(var(--destructive))", background: "hsl(var(--destructive)/0.06)", color: "hsl(var(--destructive))" }}
            >
              ⚠ {syncPrices.error instanceof Error ? syncPrices.error.message : "Sync failed"}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  icon, label, value, delay = 1,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <div
      className={[
        "rounded-3xl border border-border bg-card p-6 shadow-botanical card-hover animate-fade-in",
        `stagger-${delay}`,
      ].join(" ")}
    >
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center mb-4"
        style={{ background: "hsl(var(--accent)/0.10)" }}
      >
        <span className="text-[hsl(var(--accent))]">{icon}</span>
      </div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-sans">{label}</p>
      <p
        className="text-xl font-semibold mt-1 capitalize"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-sans mb-1">{label}</p>
      <p className="text-sm font-medium font-mono text-foreground">{value}</p>
    </div>
  );
}
