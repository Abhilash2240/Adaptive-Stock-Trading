import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  testId?: string;
}

export function MetricCard({ 
  label, 
  value, 
  change, 
  changeLabel,
  icon: Icon,
  trend,
  testId 
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return ArrowUp;
    if (trend === "down") return ArrowDown;
    return Minus;
  };

  const getTrendColor = () => {
    if (trend === "up") return "text-green-600 dark:text-green-400";
    if (trend === "down") return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  const TrendIcon = getTrendIcon();
  const trendColor = getTrendColor();

  return (
    <Card 
      className="transition-all hover:scale-[1.02] hover:shadow-lg duration-300 ease-in-out min-h-32 group"
      data-testid={testId || `card-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        {Icon && (
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-mono font-bold tracking-tight animate-in fade-in duration-500" data-testid={`text-value-${testId || label}`}>
          {value}
        </div>
        {(change !== undefined || changeLabel) && (
          <div className={`flex items-center gap-1 text-sm mt-2 ${trendColor} animate-in slide-in-from-bottom-2 duration-500`}>
            <TrendIcon className="h-3 w-3" />
            <span data-testid={`text-change-${testId || label}`}>
              {change !== undefined && `${change > 0 ? '+' : ''}${change.toFixed(2)}%`}
              {changeLabel && ` ${changeLabel}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
