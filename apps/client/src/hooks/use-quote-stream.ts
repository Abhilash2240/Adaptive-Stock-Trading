import { useCallback, useMemo, useState } from "react";

import { useWebSocket } from "@/hooks/use-websocket";
import { useSubscribeToStream } from "@/hooks/use-api";

export interface QuoteMessage {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
}

interface QuoteHistoryMap {
  [symbol: string]: QuoteMessage[];
}

export interface QuoteStreamState {
  status: "connected" | "disconnected" | "reconnecting";
  isConnected: boolean;
  latency: number | null;
  lastMessageAt: Date | null;
  lastQuote: QuoteMessage | null;
  quotes: QuoteMessage[];
  history: QuoteHistoryMap;
  symbols: string[];
  subscribe: (symbol: string) => Promise<void>;
  isSubscribing: boolean;
  subscribeError: Error | null;
  reconnect: () => void;
  close: () => void;
}

const HISTORY_SIZE = 120; // keep roughly last 2 minutes at 1s cadence

export function useQuoteStream(): QuoteStreamState {
  const [quotesMap, setQuotesMap] = useState<Record<string, QuoteMessage>>({});
  const [historyMap, setHistoryMap] = useState<QuoteHistoryMap>({});
  const [lastQuote, setLastQuote] = useState<QuoteMessage | null>(null);

  const subscribeMutation = useSubscribeToStream();

  const handleMessage = useCallback((message: QuoteMessage) => {
    if (!message || !message.symbol) {
      return;
    }

    const normalizedSymbol = message.symbol.toUpperCase();
    const nextQuote = { ...message, symbol: normalizedSymbol };

    setLastQuote(nextQuote);
    setQuotesMap((prev) => ({
      ...prev,
      [normalizedSymbol]: nextQuote,
    }));

    setHistoryMap((prev) => {
      const existing = prev[normalizedSymbol] ?? [];
      const nextHistory = [...existing, nextQuote];
      if (nextHistory.length > HISTORY_SIZE) {
        nextHistory.splice(0, nextHistory.length - HISTORY_SIZE);
      }
      return {
        ...prev,
        [normalizedSymbol]: nextHistory,
      };
    });
  }, []);

  const websocket = useWebSocket<QuoteMessage>({
    onMessage: handleMessage,
  });

  const subscribe = useCallback(
    async (symbol: string) => {
      const trimmed = symbol.trim().toUpperCase();
      if (!trimmed) {
        return;
      }
      await subscribeMutation.mutateAsync({ symbol: trimmed, channel: "quotes" });
    },
    [subscribeMutation],
  );

  const quotes = useMemo(() => {
    return Object.values(quotesMap).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [quotesMap]);

  const symbols = useMemo(() => quotes.map((quote) => quote.symbol), [quotes]);

  const history = useMemo(() => historyMap, [historyMap]);

  return {
    status: websocket.status,
    isConnected: websocket.isConnected,
    latency: websocket.latency,
    lastMessageAt: websocket.lastMessageAt,
    lastQuote,
    quotes,
    history,
    symbols,
    subscribe,
    isSubscribing: subscribeMutation.isPending,
    subscribeError: (subscribeMutation.error as Error) ?? null,
    reconnect: websocket.reconnect,
    close: websocket.close,
  };
}
