import { MetricCard } from "@/components/metric-card";
import { ChartCard } from "@/components/chart-card";
import { DollarSign, TrendingUp, Activity, Target, BarChart3, Zap } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Mock data for charts
const portfolioData = [
  { date: "Jan", value: 100000, spy: 100000 },
  { date: "Feb", value: 102500, spy: 101000 },
  { date: "Mar", value: 105800, spy: 102500 },
  { date: "Apr", value: 108200, spy: 103800 },
  { date: "May", value: 112500, spy: 105200 },
  { date: "Jun", value: 115800, spy: 106500 },
];

const lossData = [
  { episode: 0, loss: 0.85 },
  { episode: 500, loss: 0.62 },
  { episode: 1000, loss: 0.48 },
  { episode: 1500, loss: 0.35 },
  { episode: 2000, loss: 0.28 },
  { episode: 2500, loss: 0.22 },
];

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700" data-testid="page-dashboard">
      <div className="animate-in slide-in-from-top-4 duration-500">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent" data-testid="text-page-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2 text-lg" data-testid="text-page-subtitle">
          Real-time overview of your RL trading performance
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-bottom-6 duration-700"
           style={{ animationDelay: "150ms" }}>
        <MetricCard
          label="Portfolio Value"
          value="$115,800"
          change={15.8}
          changeLabel="vs initial"
          icon={DollarSign}
          trend="up"
        />
        <MetricCard
          label="Total Return"
          value="+15.8%"
          change={3.2}
          changeLabel="this month"
          icon={TrendingUp}
          trend="up"
        />
        <MetricCard
          label="Sharpe Ratio"
          value="1.85"
          change={0.15}
          changeLabel="vs benchmark"
          icon={Activity}
          trend="up"
        />
        <MetricCard
          label="Max Drawdown"
          value="-4.2%"
          change={-1.1}
          changeLabel="improved"
          icon={Target}
          trend="up"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-6 duration-700"
           style={{ animationDelay: "300ms" }}>
        <ChartCard
          title="Portfolio Performance vs SPY"
          footer={
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                <span className="font-semibold">RL Portfolio: +15.8%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-chart-2 rounded-full" />
                <span>SPY Benchmark: +6.5%</span>
              </div>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={portfolioData}>
              <defs>
                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSpy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorPortfolio)"
                name="RL Portfolio"
              />
              <Area
                type="monotone"
                dataKey="spy"
                stroke="hsl(var(--chart-2))"
                fillOpacity={1}
                fill="url(#colorSpy)"
                name="SPY"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Training Loss Curve"
          footer="Latest model: Double DQN v2.3 • Trained 6h ago"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={lossData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="episode" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Line
                type="monotone"
                dataKey="loss"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={false}
                name="Loss"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-6 duration-700"
           style={{ animationDelay: "450ms" }}>
        <Card className="transition-all hover:shadow-md duration-300" data-testid="card-active-positions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <span>Active Positions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["AAPL", "MSFT", "GOOGL", "NVDA", "TSLA"].map((ticker, idx) => (
              <div key={ticker} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <div className="font-mono font-bold text-lg">{ticker}</div>
                  <Badge variant="secondary" className="transition-all hover:scale-105">
                    {["BUY 10%", "HOLD", "BUY 5%", "SELL 5%", "HOLD"][idx]}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-semibold text-sm ${
                    ["+8.2%", "+3.5%", "+12.1%", "+5.8%", "-2.1%"][idx].startsWith('+') 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {["+8.2%", "+3.5%", "+12.1%", "+5.8%", "-2.1%"][idx]}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Q: {[0.92, 0.65, 0.88, 0.71, 0.55][idx]}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md duration-300" data-testid="card-training-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <span>Current Training Job</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Episode 1,842 / 3,000</span>
                <span className="font-mono font-semibold">61.4%</span>
              </div>
              <Progress value={61.4} className="h-2 transition-all" data-testid="progress-training" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/30 transition-all hover:bg-muted/50 duration-200">
                <div className="text-xs text-muted-foreground">Current Loss</div>
                <div className="font-mono text-lg font-semibold">0.2847</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 transition-all hover:bg-muted/50 duration-200">
                <div className="text-xs text-muted-foreground">Epsilon</div>
                <div className="font-mono text-lg font-semibold">0.125</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 transition-all hover:bg-muted/50 duration-200">
                <div className="text-xs text-muted-foreground">Replay Buffer</div>
                <div className="font-mono text-sm">842k / 1M</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 transition-all hover:bg-muted/50 duration-200">
                <div className="text-xs text-muted-foreground">Est. Time Left</div>
                <div className="font-mono text-sm">2h 18m</div>
              </div>
            </div>

            <Badge variant="default" className="w-full justify-center animate-pulse">
              Training in Progress
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
