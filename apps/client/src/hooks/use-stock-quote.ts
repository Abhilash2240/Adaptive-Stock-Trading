import { useEffect, useState } from "react";

export function useStockQuote(symbol: string, pollMs = 3500) {
  const [price, setPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | undefined>();
  const [provider, setProvider] = useState<string | undefined>();
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
        const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!cancel) {
          setPrice(data.price);
          setCurrency(data.currency);
          setProvider(data.provider);
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

  return { price, currency, provider, loading, error };
}
