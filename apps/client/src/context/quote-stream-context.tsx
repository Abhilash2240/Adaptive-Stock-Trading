import { createContext, useContext } from "react";

import type { QuoteStreamState } from "@/hooks/use-quote-stream";
import { useQuoteStream } from "@/hooks/use-quote-stream";

const QuoteStreamContext = createContext<QuoteStreamState | null>(null);

interface QuoteStreamProviderProps {
  children: React.ReactNode;
}

export function QuoteStreamProvider({ children }: QuoteStreamProviderProps) {
  const value = useQuoteStream();
  return <QuoteStreamContext.Provider value={value}>{children}</QuoteStreamContext.Provider>;
}

export function useQuoteStreamContext(): QuoteStreamState {
  const context = useContext(QuoteStreamContext);
  if (!context) {
    throw new Error("useQuoteStreamContext must be used within a QuoteStreamProvider");
  }
  return context;
}
