import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PriceIndicatorProps {
  /** Current actual price */
  currentPrice: number;
  /** Predicted price (if available) */
  predictedPrice?: number;
  /** Whether the displayed price is a prediction */
  isPredicted?: boolean;
  /** Confidence score (0-1) for predicted prices */
  confidence?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Displays a price prediction indicator with directional arrow and confidence tooltip.
 *
 * - Green up arrow: predicted > current
 * - Red down arrow: predicted < current
 * - Gray dash: no change or no prediction
 *
 * Shows confidence percentage on hover.
 */
export function PriceIndicator({
  currentPrice,
  predictedPrice,
  isPredicted = false,
  confidence = 0,
  size = "md",
}: PriceIndicatorProps) {
  const iconSize = size === "sm" ? 12 : size === "lg" ? 20 : 16;
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";

  // Determine direction
  const hasValidPrediction = predictedPrice !== undefined && predictedPrice > 0 && currentPrice > 0;
  const priceDiff = hasValidPrediction ? predictedPrice - currentPrice : 0;
  const isUp = priceDiff > 0.01; // Small threshold to avoid noise
  const isDown = priceDiff < -0.01;

  // Format confidence
  const confidencePct = Math.round(confidence * 100);

  // No prediction data available
  if (!hasValidPrediction && !isPredicted) {
    return null;
  }

  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendColor = isUp
    ? "text-emerald-400"
    : isDown
      ? "text-rose-400"
      : "text-slate-400";

  const trendLabel = isUp ? "Bullish" : isDown ? "Bearish" : "Neutral";
  const diffPct = currentPrice > 0 ? ((priceDiff / currentPrice) * 100).toFixed(2) : "0.00";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 ${trendColor} cursor-help`}
          aria-label={`${trendLabel} prediction with ${confidencePct}% confidence`}
        >
          <TrendIcon size={iconSize} />
          {isPredicted && (
            <span className={`${textSize} font-medium opacity-80`}>
              ~
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p className="font-semibold">
            {trendLabel} Signal
          </p>
          {hasValidPrediction && (
            <p>
              Predicted: ${predictedPrice.toFixed(2)}{" "}
              <span className={trendColor}>
                ({isUp ? "+" : ""}{diffPct}%)
              </span>
            </p>
          )}
          <p>
            Confidence:{" "}
            <span className={confidencePct >= 70 ? "text-emerald-400" : confidencePct >= 40 ? "text-amber-400" : "text-rose-400"}>
              {confidencePct}%
            </span>
          </p>
          {isPredicted && (
            <p className="text-muted-foreground italic">
              Price is estimated (API rate limited)
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Badge shown when displaying predicted (not real-time) price data.
 */
export function PredictedBadge({
  confidence,
  className = "",
}: {
  confidence?: number;
  className?: string;
}) {
  const confidencePct = Math.round((confidence ?? 0) * 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400 ${className}`}
        >
          ~predicted
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          Estimated price (API rate limited)
          {confidence !== undefined && (
            <span className="ml-1">• {confidencePct}% confidence</span>
          )}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
