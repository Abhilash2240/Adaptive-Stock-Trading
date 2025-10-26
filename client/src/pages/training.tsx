import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, Square, Save, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartCard } from "@/components/chart-card";

// Mock loss data
const lossData = Array.from({ length: 50 }, (_, i) => ({
  episode: i * 50,
  loss: Math.max(0.1, 1.2 - i * 0.02 + Math.random() * 0.1),
  qValue: Math.min(10, i * 0.15 + Math.random() * 0.5),
}));

export default function Training() {
  return (
    <div className="space-y-8" data-testid="page-training">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
          Training Control
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure and monitor reinforcement learning agent training
        </p>
      </div>

      {/* Training Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hyperparameters */}
        <Card data-testid="card-hyperparameters">
          <CardHeader>
            <CardTitle>Hyperparameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset">Preset Config</Label>
              <Select defaultValue="default">
                <SelectTrigger id="preset" data-testid="select-preset">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (Recommended)</SelectItem>
                  <SelectItem value="aggressive">Aggressive Learning</SelectItem>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="replay-size">Replay Buffer Size</Label>
              <Input
                id="replay-size"
                type="number"
                defaultValue="1000000"
                data-testid="input-replay-size"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                defaultValue="64"
                data-testid="input-batch-size"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="learning-rate">Learning Rate</Label>
              <Input
                id="learning-rate"
                type="number"
                step="0.0001"
                defaultValue="0.0001"
                data-testid="input-learning-rate"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gamma">Gamma (Discount Factor)</Label>
              <Input
                id="gamma"
                type="number"
                step="0.01"
                defaultValue="0.99"
                data-testid="input-gamma"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="epsilon-start">Epsilon Start</Label>
              <Input
                id="epsilon-start"
                type="number"
                step="0.1"
                defaultValue="1.0"
                data-testid="input-epsilon-start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="epsilon-end">Epsilon End</Label>
              <Input
                id="epsilon-end"
                type="number"
                step="0.01"
                defaultValue="0.05"
                data-testid="input-epsilon-end"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="episodes">Total Episodes</Label>
              <Input
                id="episodes"
                type="number"
                defaultValue="3000"
                data-testid="input-episodes"
              />
            </div>
          </CardContent>
        </Card>

        {/* Live Metrics */}
        <Card data-testid="card-live-metrics">
          <CardHeader>
            <CardTitle>Live Training Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Training Progress</span>
                <span className="font-mono font-semibold">61.4%</span>
              </div>
              <Progress value={61.4} className="h-2" data-testid="progress-training" />
              <div className="text-xs text-muted-foreground mt-1">
                Episode 1,842 / 3,000
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Epsilon Decay</span>
                <span className="font-mono font-semibold">0.125</span>
              </div>
              <Progress value={12.5} className="h-2" data-testid="progress-epsilon" />
              <div className="text-xs text-muted-foreground mt-1">
                Exploration vs Exploitation
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Current Loss</div>
                <div className="text-2xl font-mono font-bold mt-1">0.2847</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Avg Q-Value</div>
                <div className="text-2xl font-mono font-bold mt-1">6.52</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Replay Buffer</div>
                <div className="font-mono text-sm mt-1">842k / 1M</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Time Elapsed</div>
                <div className="font-mono text-sm mt-1">3h 42m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Est. Time Left</div>
                <div className="font-mono text-sm mt-1">2h 18m</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">GPU Usage</div>
                <div className="font-mono text-sm mt-1">87%</div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm font-semibold mb-2">Model Info</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-mono">Double DQN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-mono">v2.4</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seed:</span>
                  <span className="font-mono">42</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card data-testid="card-actions">
          <CardHeader>
            <CardTitle>Training Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button className="flex-1" data-testid="button-start-training">
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
              <Button variant="secondary" className="flex-1" data-testid="button-pause-training">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            </div>

            <Button variant="destructive" className="w-full" data-testid="button-stop-training">
              <Square className="h-4 w-4 mr-2" />
              Stop Training
            </Button>

            <div className="border-t pt-4 space-y-2">
              <Button variant="outline" className="w-full" data-testid="button-save-checkpoint">
                <Save className="h-4 w-4 mr-2" />
                Save Checkpoint
              </Button>
              <Button variant="outline" className="w-full" data-testid="button-export-config">
                <Download className="h-4 w-4 mr-2" />
                Export Config
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-semibold mb-3">Status</div>
              <Badge variant="default" className="w-full justify-center py-2">
                Training in Progress
              </Badge>
              <div className="text-xs text-muted-foreground mt-2 text-center">
                Last checkpoint: 18 minutes ago
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-semibold mb-2">Logs</div>
              <div className="bg-muted/50 rounded-md p-3 font-mono text-xs space-y-1 h-32 overflow-y-auto">
                <div>[18:42:15] Episode 1842 completed</div>
                <div>[18:42:15] Loss: 0.2847, Q: 6.52</div>
                <div>[18:42:10] Replay buffer: 842k samples</div>
                <div>[18:42:05] Epsilon: 0.125</div>
                <div>[18:42:00] Checkpoint saved</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Training Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Loss Curve" timeframes={[]}>
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

        <ChartCard title="Average Q-Value" timeframes={[]}>
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
                dataKey="qValue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Q-Value"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
