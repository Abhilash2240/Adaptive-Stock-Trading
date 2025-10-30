import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, Download, Search, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock log entries
const logs = [
  { timestamp: "2024-01-15 18:42:15", level: "INFO", service: "Training", message: "Episode 1842 completed. Loss: 0.2847, Q-Value: 6.52" },
  { timestamp: "2024-01-15 18:42:10", level: "INFO", service: "Training", message: "Replay buffer size: 842,000 samples" },
  { timestamp: "2024-01-15 18:42:05", level: "INFO", service: "Training", message: "Checkpoint saved to /models/checkpoints/double_dqn_v2.4_ep1840.pt" },
  { timestamp: "2024-01-15 18:42:00", level: "INFO", service: "Training", message: "Target network updated" },
  { timestamp: "2024-01-15 18:41:55", level: "DEBUG", service: "Environment", message: "State normalized: price_window=[0.82, 0.85, ...], indicators=[...]" },
  { timestamp: "2024-01-15 18:41:50", level: "INFO", service: "Paper Trading", message: "Executed BUY 5% AAPL @ $189.50, Q=0.89" },
  { timestamp: "2024-01-15 18:41:45", level: "INFO", service: "Data Ingestion", message: "Market data updated for 15 tickers (latency: 8ms)" },
  { timestamp: "2024-01-15 18:41:40", level: "INFO", service: "Gemini", message: "Sentiment analysis completed for AAPL: score=0.72, confidence=0.85" },
  { timestamp: "2024-01-15 18:41:35", level: "WARNING", service: "Data Ingestion", message: "API rate limit approaching (85% of quota used)" },
  { timestamp: "2024-01-15 18:41:30", level: "INFO", service: "WebSocket", message: "Client connected from 192.168.1.100" },
  { timestamp: "2024-01-15 18:41:25", level: "DEBUG", service: "Portfolio", message: "Portfolio value updated: $115,247 (+15.2%)" },
  { timestamp: "2024-01-15 18:41:20", level: "INFO", service: "Backtest", message: "Backtest 'Double DQN - Tech Stocks' completed. CAGR: 32.5%, Sharpe: 1.85" },
  { timestamp: "2024-01-15 18:41:15", level: "ERROR", service: "Data Ingestion", message: "Failed to fetch data for TSLA: Connection timeout" },
  { timestamp: "2024-01-15 18:41:10", level: "INFO", service: "Training", message: "Epsilon decay: 0.125 (step 184,200 / 200,000)" },
];

export default function Logs() {
  return (
    <div className="space-y-8" data-testid="page-logs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Logs & Diagnostics
          </h1>
          <p className="text-muted-foreground mt-1">
            System logs, debugging information, and service status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-refresh-logs">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" data-testid="button-export-logs">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-9"
                data-testid="input-search-logs"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger data-testid="select-log-level">
                <SelectValue placeholder="Log Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="error">ERROR</SelectItem>
                <SelectItem value="warning">WARNING</SelectItem>
                <SelectItem value="info">INFO</SelectItem>
                <SelectItem value="debug">DEBUG</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger data-testid="select-service">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="training">Training</SelectItem>
                <SelectItem value="paper-trading">Paper Trading</SelectItem>
                <SelectItem value="data-ingestion">Data Ingestion</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="backtest">Backtest</SelectItem>
                <SelectItem value="websocket">WebSocket</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="24h">
              <SelectTrigger data-testid="select-timeframe">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Training Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="w-full justify-center">
              Running
            </Badge>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Uptime: 3h 42m
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paper Trading
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="w-full justify-center">
              Active
            </Badge>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              23 trades today
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Data Ingestion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="w-full justify-center">
              Throttled
            </Badge>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              85% quota used
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              WebSocket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="w-full justify-center">
              Connected
            </Badge>
            <div className="text-xs text-muted-foreground mt-2 text-center">
              Latency: 42ms
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log Viewer */}
      <Card data-testid="card-log-viewer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>System Logs</CardTitle>
            <Badge variant="outline" data-testid="badge-log-count">
              {logs.length} entries
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs space-y-1 max-h-[600px] overflow-y-auto">
            {logs.map((log, idx) => {
              const levelColors = {
                ERROR: "text-red-600 dark:text-red-400",
                WARNING: "text-yellow-600 dark:text-yellow-400",
                INFO: "text-blue-600 dark:text-blue-400",
                DEBUG: "text-muted-foreground",
              };
              
              return (
                <div 
                  key={idx} 
                  className="hover-elevate px-2 py-1 rounded"
                  data-testid={`log-entry-${idx}`}
                >
                  <span className="text-muted-foreground">[{log.timestamp}]</span>{" "}
                  <span className={`font-semibold ${levelColors[log.level as keyof typeof levelColors]}`}>
                    {log.level}
                  </span>{" "}
                  <span className="text-primary">{log.service}:</span>{" "}
                  <span className="text-foreground">{log.message}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Auto-refresh enabled • Updates every 5 seconds
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
