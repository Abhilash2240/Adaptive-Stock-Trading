import { useEffect, useState } from "react";
import { getAccessTokenForApi } from "@/hooks/use-api";

export interface StockQuote {
  symbol: string;
  name?: string;
  price: number | null;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change?: number;
  percentChange?: number;
  currency?: string;
  exchange?: string;
  provider?: string;
}

export function useStockQuote(symbol: string, pollMs = 5000) {
  const base = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
  const [quote, setQuote] = useState<StockQuote>({ symbol, price: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    let timer: NodeJS.Timeout | null = null;
    if (!symbol) return;
    async function fetchQuote() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessTokenForApi();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        const res = await fetch(
          `${base}/api/v1/quotes?symbol=${encodeURIComponent(symbol)}`,
          { headers }
        );
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancel) {
          setQuote({
            symbol: data.symbol ?? symbol,
            name: data.name,
            price: data.price ?? null,
            open: data.open,
            high: data.high,
            low: data.low,
            volume: data.volume,
            change: data.change,
            percentChange: data.percent_change,
            currency: data.currency,
            exchange: data.exchange,
            provider: data.provider,
          });
        }
      } catch (e: any) {
        if (!cancel) setError(e.message || "Unknown error");
      } finally {
        setLoading(false);
        if (!cancel && pollMs) timer = setTimeout(fetchQuote, pollMs);
      }
    }
    fetchQuote();
    return () => {
      cancel = true;
      if (timer) clearTimeout(timer);
    };
  }, [symbol, pollMs]);

  // Backwards-compatible individual fields
  return {
    ...quote,
    loading,
    error,
  };
}
