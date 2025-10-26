import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle } from "lucide-react";

interface TradingModeBadgeProps {
  mode: "paper" | "live";
  testId?: string;
}

export function TradingModeBadge({ mode, testId }: TradingModeBadgeProps) {
  const isPaper = mode === "paper";

  return (
    <Badge 
      variant={isPaper ? "secondary" : "destructive"}
      className="gap-1.5 px-3 py-1"
      data-testid={testId || `badge-trading-mode-${mode}`}
    >
      {isPaper ? (
        <Shield className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
      )}
      <span className="font-semibold">
        {isPaper ? "Paper Trading" : "LIVE TRADING"}
      </span>
    </Badge>
  );
}
