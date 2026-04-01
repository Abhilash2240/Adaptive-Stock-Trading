import { useState } from "react";

import { LiveTick, useTradingWebSocket } from "@/hooks/use-trading-websocket";

const ACTION_STYLES: Record<string, string> = {
  BUY: "background:#16a34a;color:#fff",
  SELL: "background:#dc2626;color:#fff",
  HOLD: "background:#d97706;color:#fff",
};

interface Props {
  symbol?: string;
}

export function LiveSignalCard({ symbol = "AAPL" }: Props) {
  const [tick, setTick] = useState<LiveTick | null>(null);

  useTradingWebSocket({
    enabled: true,
    onTick: (incoming) => {
      if (!symbol || incoming.symbol === symbol) {
        setTick(incoming);
      }
    },
  });

  if (!tick) {
    return (
      <div style={{ padding: "1rem", opacity: 0.5 }}>
        Waiting for live signal...
      </div>
    );
  }

  const pct = Math.round(tick.confidence * 100);
  const isPredicted = tick.is_predicted ?? false;
  const dataConfidence = tick.data_confidence ?? 0;

  return (
    <div
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <strong style={{ fontSize: "1.1rem" }}>{tick.symbol}</strong>
        <span
          style={{
            padding: "2px 10px",
            borderRadius: "999px",
            fontSize: "0.85rem",
            fontWeight: 600,
            ...Object.fromEntries(
              ACTION_STYLES[tick.action_signal]
                .split(";")
                .filter(Boolean)
                .map((s) => s.split(":").map((x) => x.trim()))
            ),
          }}
        >
          {tick.action_signal}
        </span>
        {isPredicted && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "999px",
              fontSize: "0.7rem",
              fontWeight: 500,
              background: "rgba(245, 158, 11, 0.2)",
              color: "#f59e0b",
            }}
            title={`Estimated price (${Math.round(dataConfidence * 100)}% confidence)`}
          >
            ~predicted
          </span>
        )}
      </div>

      <div style={{ fontSize: "0.8rem", color: "#888" }}>
        Confidence: {pct}%
      </div>
      <div
        style={{
          height: "6px",
          background: "#e5e7eb",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background:
              tick.action_signal === "BUY"
                ? "#16a34a"
                : tick.action_signal === "SELL"
                  ? "#dc2626"
                  : "#d97706",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <div style={{ fontSize: "0.85rem" }}>
        Price: <strong>${tick.close?.toFixed(2) ?? "-"}</strong>
        &nbsp;·&nbsp;
        Vol: {tick.volume?.toLocaleString() ?? "-"}
      </div>

      <div style={{ fontSize: "0.7rem", color: "#aaa" }}>
        Signal at {new Date(tick.signal_timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
