import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/metric-card";
import { ChartCard } from "@/components/chart-card";
import { Play, Pause, Square, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Mock real-time performance data
const performanceData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  value: 100000 + Math.random() * 15000 + i * 600,
  spy: 100000 + Math.random() * 6500 + i * 400,
}));

// Mock recent actions
const recentActions = [
  { time: "14:32:15", ticker: "AAPL", action: "BUY 5%", quantity: 8, price: 189.50, qValue: 0.89 },
  { time: "14:18:42", ticker: "MSFT", action: "HOLD", quantity: 0, price: 346.75, qValue: 0.62 },
  { time: "14:05:28", ticker: "NVDA", action: "SELL 5%", quantity: 5, price: 513.15, qValue: 0.71 },
  { time: "13:47:09", ticker: "GOOGL", action: "BUY 10%", quantity: 15, price: 141.00, qValue: 0.92 },
  { time: "13:22:56", ticker: "TSLA", action: "HOLD", quantity: 0, price: 239.85, qValue: 0.55 },
];

export default function PaperTrading() {
  return (
    <div className="space-y-8" data-testid="page-paper-trading">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Paper Trading Simulator
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time simulation with live market data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
            Simulation Active
          </Badge>
        </div>
      </div>

      {/* Control Panel */}
      <Card data-testid="card-controls">
        <CardHeader>
          <CardTitle>Simulation Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button data-testid="button-start-simulation">
              <Play className="h-4 w-4 mr-2" />
              Start Simulation
            </Button>
            <Button variant="secondary" data-testid="button-pause-simulation">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
            <Button variant="destructive" data-testid="button-stop-simulation">
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
            <Button variant="outline" data-testid="button-reset-simulation">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset to Initial State
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Model: <span className="font-mono">double_dqn_v2.3</span> • Initial Cash: <span className="font-mono">$100,000</span> • Started: <span className="font-mono">Today 9:30 AM</span>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Current Value"
          value="$115,247"
          change={15.2}
          changeLabel="vs initial"
          trend="up"
        />
        <MetricCard
          label="Today's Return"
          value="+3.2%"
          change={3.2}
          changeLabel="intraday"
          trend="up"
        />
        <MetricCard
          label="Sharpe Ratio"
          value="1.68"
          trend="up"
        />
        <MetricCard
          label="Active Positions"
          value="12"
          changeLabel="5 pending actions"
        />
      </div>

      {/* Real-time Performance Chart */}
      <ChartCard
        title="Intraday Performance"
        timeframes={[]}
        footer={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-full" />
              <span>Paper Portfolio: +15.2%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-chart-2 rounded-full" />
              <span>SPY: +6.8%</span>
            </div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="hour" fontSize={12} />
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
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              name="Portfolio"
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

      {/* Recent Actions */}
      <Card data-testid="card-recent-actions">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Actions</CardTitle>
            <Badge variant="outline" data-testid="badge-live-updates">
              Live Updates
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Q-Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActions.map((action, idx) => (
                  <TableRow key={idx} data-testid={`row-action-${idx}`}>
                    <TableCell className="font-mono text-sm">{action.time}</TableCell>
                    <TableCell className="font-mono font-bold">{action.ticker}</TableCell>
                    <TableCell>
                      <Badge variant={
                        action.action.includes("BUY") ? "default" : 
                        action.action.includes("SELL") ? "secondary" : 
                        "outline"
                      }>
                        {action.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{action.quantity}</TableCell>
                    <TableCell className="text-right font-mono">${action.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{action.qValue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today's Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Trades</span>
              <span className="font-mono font-semibold">23</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <span className="font-mono font-semibold">65.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg P/L per Trade</span>
              <span className="font-mono font-semibold text-green-600 dark:text-green-400">+$287</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Fees</span>
              <span className="font-mono font-semibold">$34.50</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risk Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Current Drawdown</span>
              <span className="font-mono font-semibold">-1.8%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Max Drawdown</span>
              <span className="font-mono font-semibold">-4.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Volatility</span>
              <span className="font-mono font-semibold">12.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Beta vs SPY</span>
              <span className="font-mono font-semibold">1.15</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Model Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Q-Value</span>
              <span className="font-mono font-semibold">0.74</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Avg Sentiment</span>
              <span className="font-mono font-semibold">0.68</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Inference Time</span>
              <span className="font-mono font-semibold">87ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Data Freshness</span>
              <span className="font-mono font-semibold">8s</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
