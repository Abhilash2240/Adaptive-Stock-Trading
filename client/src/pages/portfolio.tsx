import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";

// Mock position data
const positions = [
  {
    id: "1",
    ticker: "AAPL",
    quantity: 50,
    entryPrice: 175.20,
    currentPrice: 189.50,
    pnl: 715.00,
    pnlPercent: 8.16,
    lastAction: "BUY 10%",
    qValue: 0.92,
  },
  {
    id: "2",
    ticker: "MSFT",
    quantity: 30,
    entryPrice: 335.00,
    currentPrice: 346.75,
    pnl: 352.50,
    pnlPercent: 3.51,
    lastAction: "HOLD",
    qValue: 0.65,
  },
  {
    id: "3",
    ticker: "GOOGL",
    quantity: 75,
    entryPrice: 125.80,
    currentPrice: 141.00,
    pnl: 1140.00,
    pnlPercent: 12.08,
    lastAction: "BUY 5%",
    qValue: 0.88,
  },
  {
    id: "4",
    ticker: "NVDA",
    quantity: 25,
    entryPrice: 485.00,
    currentPrice: 513.15,
    pnl: 703.75,
    pnlPercent: 5.80,
    lastAction: "SELL 5%",
    qValue: 0.71,
  },
  {
    id: "5",
    ticker: "TSLA",
    quantity: 40,
    entryPrice: 245.00,
    currentPrice: 239.85,
    pnl: -206.00,
    pnlPercent: -2.10,
    lastAction: "HOLD",
    qValue: 0.55,
  },
];

// Mock recommendations
const recommendations = [
  {
    ticker: "META",
    company: "Meta Platforms Inc.",
    action: "BUY 10%",
    confidence: 0.89,
    sentiment: 0.72,
    signals: ["RSI oversold", "Positive sentiment", "Strong Q-value"],
  },
  {
    ticker: "AMD",
    company: "Advanced Micro Devices",
    action: "BUY 5%",
    confidence: 0.76,
    sentiment: 0.65,
    signals: ["Momentum building", "Technical breakout", "Sector strength"],
  },
];

export default function Portfolio() {
  const [sortBy, setSortBy] = useState<string>("ticker");

  return (
    <div className="space-y-8" data-testid="page-portfolio">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Portfolio
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage positions and view AI-powered recommendations
          </p>
        </div>
        <Button data-testid="button-create-portfolio">
          <Plus className="h-4 w-4 mr-2" />
          New Portfolio
        </Button>
      </div>

      {/* Positions Table */}
      <Card data-testid="card-positions">
        <CardHeader>
          <CardTitle>Current Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => setSortBy("ticker")}>
                    Ticker
                  </TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Entry Price</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">P/L ($)</TableHead>
                  <TableHead className="text-right">P/L (%)</TableHead>
                  <TableHead>Last Action</TableHead>
                  <TableHead className="text-right">Q-Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position, idx) => (
                  <TableRow 
                    key={position.id}
                    className="hover-elevate"
                    data-testid={`row-position-${position.ticker}`}
                  >
                    <TableCell className="font-mono font-bold">
                      {position.ticker}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {position.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${position.entryPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${position.currentPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={position.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        ${Math.abs(position.pnl).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="flex items-center justify-end gap-1">
                        {position.pnlPercent >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                        )}
                        <span className={position.pnlPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {position.pnlPercent >= 0 ? "+" : ""}{position.pnlPercent.toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{position.lastAction}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {position.qValue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-actions-${position.ticker}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Simulate Sale</DropdownMenuItem>
                          <DropdownMenuItem>Set Alert</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">AI Recommendations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec) => (
            <Card key={rec.ticker} className="hover-elevate" data-testid={`card-recommendation-${rec.ticker}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold font-mono">
                      {rec.ticker}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rec.company}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="default" className="text-base px-3 py-1">
                      {rec.action}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Q: {rec.confidence}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Confidence</div>
                    <div className="font-mono font-semibold">{(rec.confidence * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sentiment</div>
                    <div className="font-mono font-semibold">{(rec.sentiment * 100).toFixed(0)}%</div>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Key Signals</div>
                  <div className="flex flex-wrap gap-2">
                    {rec.signals.map((signal) => (
                      <Badge key={signal} variant="outline" className="text-xs">
                        {signal}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" data-testid={`button-execute-${rec.ticker}`}>
                    Execute Paper Trade
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`button-watchlist-${rec.ticker}`}>
                    Add to Watchlist
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
