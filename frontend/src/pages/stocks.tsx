import React, { useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { StockDetailOverview } from "@/components/StockDetailOverview";
import { useTradingWebSocket } from "@/hooks/use-trading-websocket";

export default function StocksPage() {
  const [, setLocation] = useLocation();
  const path = typeof window !== "undefined" ? window.location.pathname : "/stocks";

  const [symbol, setSymbol] = useState("AAPL");
  const [livePrice, setLivePrice] = useState<number | undefined>(undefined);
  const [liveChange, setLiveChange] = useState<number | undefined>(undefined);
  const [liveChangePct, setLiveChangePct] = useState<number | undefined>(undefined);

  const { connected } = useTradingWebSocket({
    onTick: (tick) => {
      if (tick.symbol === symbol) {
        setLivePrice(tick.close);
        const delta = tick.close - tick.open;
        setLiveChange(delta);
        setLiveChangePct(tick.open > 0 ? (delta / tick.open) * 100 : 0);
      }
    },
    enabled: true,
  });

  const handleSymbolSelect = (newSym: string) => {
    setSymbol(newSym);
    setLivePrice(undefined);
    setLiveChange(undefined);
    setLiveChangePct(undefined);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient decorative background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-32 -left-20 h-[28rem] w-[28rem] rounded-full bg-[hsl(var(--accent)/0.08)] blur-3xl" />
        <div className="absolute top-1/2 -right-20 h-96 w-96 rounded-full bg-[hsl(var(--destructive)/0.06)] blur-3xl" />
      </div>

      <Sidebar activeRoute={path} onNavigate={setLocation} />

      <main className="relative ml-60 p-8 space-y-7">
        {/* Page Header */}
        <div className="flex items-start justify-between animate-fade-in">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-sans">
              Market Analysis
            </p>
            <h1
              className="text-3xl font-semibold text-foreground leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Stock <em>Price Overview</em>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm pt-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full transition-all duration-700 ${
                  connected ? "bg-[hsl(var(--accent))] animate-pulse" : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-muted-foreground font-sans text-xs tracking-wide uppercase">
                {connected ? "Realtime Streaming" : "Market Data Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Google Finance Stock Price Component */}
        <StockDetailOverview
          currentSymbol={symbol}
          onSymbolSelect={handleSymbolSelect}
          overridePrice={livePrice}
          overrideChange={liveChange}
          overrideChangePct={liveChangePct}
        />
      </main>
    </div>
  );
}
