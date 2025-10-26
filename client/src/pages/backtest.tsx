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
import { ChartCard } from "@/components/chart-card";
import { Plus, Play, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { MetricCard } from "@/components/metric-card";

// Mock backtest equity curve
const equityCurve = [
  { date: "2023-01", portfolio: 100000, spy: 100000 },
  { date: "2023-02", portfolio: 102500, spy: 101200 },
  { date: "2023-03", portfolio: 105800, spy: 102800 },
  { date: "2023-04", portfolio: 108200, spy: 103500 },
  { date: "2023-05", portfolio: 111500, spy: 105100 },
  { date: "2023-06", portfolio: 115200, spy: 106300 },
  { date: "2023-07", portfolio: 118800, spy: 107900 },
  { date: "2023-08", portfolio: 116200, spy: 106800 },
  { date: "2023-09", portfolio: 119500, spy: 108200 },
  { date: "2023-10", portfolio: 123400, spy: 109800 },
  { date: "2023-11", portfolio: 127800, spy: 111500 },
  { date: "2023-12", portfolio: 132500, spy: 113200 },
];

// Mock trades
const trades = [
  { date: "2023-12-15", ticker: "AAPL", action: "BUY 10%", quantity: 15, price: 195.20, fees: 2.93, pnl: null },
  { date: "2023-12-14", ticker: "MSFT", action: "SELL 5%", quantity: 8, price: 372.50, fees: 1.49, pnl: 425.80 },
  { date: "2023-12-13", ticker: "GOOGL", action: "BUY 5%", quantity: 22, price: 138.90, fees: 1.53, pnl: null },
  { date: "2023-12-12", ticker: "NVDA", action: "HOLD", quantity: 0, price: 495.00, fees: 0, pnl: null },
  { date: "2023-12-11", ticker: "TSLA", action: "SELL 10%", quantity: 12, price: 242.50, fees: 1.46, pnl: -185.40 },
];

// Mock backtests
const backtests = [
  { 
    id: "1", 
    name: "Double DQN - Tech Stocks", 
    model: "double_dqn_v2.3", 
    tickers: ["AAPL", "MSFT", "GOOGL", "NVDA"], 
    cagr: 32.5, 
    sharpe: 1.85, 
    maxDD: -8.2, 
    status: "completed" 
  },
  { 
    id: "2", 
    name: "Double DQN - Diversified", 
    model: "double_dqn_v2.2", 
    tickers: ["SPY", "QQQ", "IWM", "DIA"], 
    cagr: 18.3, 
    sharpe: 1.42, 
    maxDD: -12.5, 
    status: "completed" 
  },
  { 
    id: "3", 
    name: "SAC Experimental - Tech", 
    model: "sac_v1.0", 
    tickers: ["AAPL", "MSFT", "GOOGL"], 
    cagr: 28.7, 
    sharpe: 1.68, 
    maxDD: -10.3, 
    status: "running" 
  },
];

export default function Backtest() {
  return (
    <div className="space-y-8" data-testid="page-backtest">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Backtest & Experiments
          </h1>
          <p className="text-muted-foreground mt-1">
            Historical performance analysis and model comparison
          </p>
        </div>
        <Button data-testid="button-new-backtest">
          <Plus className="h-4 w-4 mr-2" />
          New Backtest
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="CAGR"
          value="32.5%"
          change={6.3}
          changeLabel="vs benchmark"
          trend="up"
        />
        <MetricCard
          label="Sharpe Ratio"
          value="1.85"
          trend="up"
        />
        <MetricCard
          label="Max Drawdown"
          value="-8.2%"
          trend="up"
        />
        <MetricCard
          label="Win Rate"
          value="68.5%"
          trend="up"
        />
      </div>

      {/* Equity Curve */}
      <ChartCard
        title="Equity Curve vs Benchmark"
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <span>RL Strategy: +32.5%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-chart-2 rounded-full" />
                <span>SPY: +13.2%</span>
              </div>
            </div>
            <Button size="sm" variant="outline" data-testid="button-export-data">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={equityCurve}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value: number) => `$${value.toLocaleString()}`}
            />
            <Legend />
            <ReferenceLine y={100000} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="RL Strategy"
            />
            <Line
              type="monotone"
              dataKey="spy"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={false}
              name="SPY"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Trade History */}
      <Card data-testid="card-trade-history">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trade History</CardTitle>
            <Button size="sm" variant="outline" data-testid="button-export-trades">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade, idx) => (
                  <TableRow key={idx} data-testid={`row-trade-${idx}`}>
                    <TableCell className="font-mono text-sm">{trade.date}</TableCell>
                    <TableCell className="font-mono font-bold">{trade.ticker}</TableCell>
                    <TableCell>
                      <Badge variant={trade.action.includes("BUY") ? "default" : trade.action.includes("SELL") ? "secondary" : "outline"}>
                        {trade.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{trade.quantity}</TableCell>
                    <TableCell className="text-right font-mono">${trade.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${trade.fees.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {trade.pnl !== null ? (
                        <span className={trade.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Backtest Runs */}
      <Card data-testid="card-backtest-runs">
        <CardHeader>
          <CardTitle>Recent Backtest Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Tickers</TableHead>
                  <TableHead className="text-right">CAGR</TableHead>
                  <TableHead className="text-right">Sharpe</TableHead>
                  <TableHead className="text-right">Max DD</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backtests.map((backtest) => (
                  <TableRow key={backtest.id} data-testid={`row-backtest-${backtest.id}`}>
                    <TableCell className="font-semibold">{backtest.name}</TableCell>
                    <TableCell className="font-mono text-sm">{backtest.model}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {backtest.tickers.map((ticker) => (
                          <Badge key={ticker} variant="outline" className="text-xs">
                            {ticker}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{backtest.cagr.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{backtest.sharpe.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{backtest.maxDD.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Badge variant={backtest.status === "completed" ? "default" : "secondary"}>
                        {backtest.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" data-testid={`button-view-${backtest.id}`}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
