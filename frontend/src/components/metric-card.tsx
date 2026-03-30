import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
  testId?: string;
}

export function MetricCard({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend,
  className = "",
  testId,
}: MetricCardProps) {
  const [pulse, setPulse] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setPulse(true);
      prevValue.current = value;
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  const getTrendIcon = () => {
    if (trend === "up") return ArrowUp;
    if (trend === "down") return ArrowDown;
    return Minus;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-accent";
    if (trend === "down") return "text-destructive";
    return "text-muted-foreground";
  };

  const TrendIcon = getTrendIcon();
  const trendColor = getTrendColor();

  return (
    <Card
      className={`hover-lift min-h-32 transition-shadow ${pulse ? "animate-pulse-glow" : ""} ${className}`}
      data-testid={testId || `card-metric-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </CardHeader>
      <CardContent>
        <div
          className="text-3xl font-mono font-bold tracking-tight text-foreground"
          data-testid={`text-value-${testId || label}`}
        >
          {value}
        </div>
        {(change !== undefined || changeLabel) && (
          <div className={`flex items-center gap-1 text-sm mt-2 ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            <span data-testid={`text-change-${testId || label}`}>
              {change !== undefined && `${change > 0 ? "+" : ""}${change.toFixed(2)}%`}
              {changeLabel && ` ${changeLabel}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
