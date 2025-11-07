import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  timeframes?: string[];
  onTimeframeChange?: (timeframe: string) => void;
  testId?: string;
}

export function ChartCard({ 
  title, 
  children, 
  footer, 
  timeframes = ["1D", "1W", "1M", "3M", "1Y", "All"],
  onTimeframeChange,
  testId 
}: ChartCardProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframes[2]); // Default to 1M

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
    onTimeframeChange?.(timeframe);
  };

  return (
    <Card 
      className="transition-all hover:shadow-md duration-300"
      data-testid={testId || `card-chart-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
        <CardTitle className="text-xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          {title}
        </CardTitle>
        {timeframes.length > 0 && (
          <div className="flex gap-1 flex-wrap" data-testid="timeframe-selector">
            {timeframes.map((timeframe) => (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? "default" : "ghost"}
                size="sm"
                onClick={() => handleTimeframeChange(timeframe)}
                data-testid={`button-timeframe-${timeframe.toLowerCase()}`}
                className="h-8 px-3 transition-all duration-200"
              >
                {timeframe}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 min-h-80 animate-in fade-in duration-700">
        {children}
      </CardContent>
      {footer && (
        <CardFooter className="text-sm text-muted-foreground border-t pt-4 bg-muted/30">
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
