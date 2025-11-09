import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, CheckCircle, AlertTriangle, Save } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSettings, useSaveSettings, type UserSettingsResponse, type SaveSettingsPayload } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

const auditLogs = [
  { timestamp: "2024-01-15 14:32:18", user: "admin@example.com", action: "Changed to Paper Trading", ip: "192.168.1.100" },
  { timestamp: "2024-01-10 09:15:42", user: "admin@example.com", action: "Enabled Gemini AI", ip: "192.168.1.100" },
  { timestamp: "2024-01-05 16:28:33", user: "admin@example.com", action: "Updated API Keys", ip: "192.168.1.100" },
];

export default function Settings() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showLiveConfirmation, setShowLiveConfirmation] = useState(false);
  const [confirmations, setConfirmations] = useState({
    realMoney: false,
    responsibility: false,
    risks: false,
    testing: false,
  });

  // For MVP, use a demo user ID (in production, this would come from auth)
  const demoUserId = "demo-user-1";
  const { data: userSettings, isLoading } = useSettings(demoUserId);
  const saveSettings = useSaveSettings();
  const { toast } = useToast();

  const [tradingMode, setTradingMode] = useState<"paper" | "live">("paper");
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [marketDataProvider, setMarketDataProvider] = useState("yfinance");

  // Load settings from backend when available
  useEffect(() => {
    if (userSettings) {
      setTradingMode(userSettings.tradingMode as "paper" | "live");
      setGeminiEnabled(userSettings.geminiEnabled ?? true);
      setNotificationsEnabled(userSettings.notificationsEnabled ?? true);
      setMarketDataProvider(userSettings.marketDataProvider ?? "yfinance");
    }
  }, [userSettings]);

  const handleTradingModeChange = (checked: boolean) => {
    if (checked) {
      setShowLiveConfirmation(true);
    } else {
      setTradingMode("paper");
      handleSaveSettings({ tradingMode: "paper" });
    }
  };

  const handleConfirmLiveTrading = () => {
    const allConfirmed = Object.values(confirmations).every(v => v);
    
    if (!allConfirmed) {
      toast({
        title: "Confirmation Required",
        description: "Please check all confirmation boxes before enabling live trading.",
        variant: "destructive",
      });
      return;
    }

    setTradingMode("live");
    setShowLiveConfirmation(false);
    setConfirmations({ realMoney: false, responsibility: false, risks: false, testing: false });
    handleSaveSettings({ tradingMode: "live" });
  };

  const handleSaveSettings = async (updates: Partial<UserSettingsResponse>) => {
    try {
      const base: SaveSettingsPayload = userSettings
        ? { ...userSettings }
        : {
            userId: demoUserId,
            tradingMode,
            marketDataProvider,
            geminiEnabled,
            notificationsEnabled,
          };

      const payload: SaveSettingsPayload = {
        ...base,
        ...updates,
      };

      await saveSettings.mutateAsync(payload);
      
      toast({
        title: "Settings Saved",
        description: "Your settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure API keys, trading mode, and system preferences
        </p>
      </div>

      {/* Trading Mode */}
      <Card data-testid="card-trading-mode">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Trading Mode
            {tradingMode === "live" && (
              <Badge variant="destructive" className="animate-pulse">
                LIVE TRADING ENABLED
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Control whether the system operates in paper trading (simulation) or live trading mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="font-semibold">Enable Live Trading</div>
              <div className="text-sm text-muted-foreground">
                Switch from paper trading to real money trading
              </div>
            </div>
            <Switch
              checked={tradingMode === "live"}
              onCheckedChange={handleTradingModeChange}
              data-testid="switch-trading-mode"
            />
          </div>

          {tradingMode === "paper" && (
            <div className="bg-muted/50 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Paper Trading Mode Active</div>
                <div className="text-xs text-muted-foreground mt-1">
                  You're using simulated funds. No real money is at risk.
                </div>
              </div>
            </div>
          )}

          {tradingMode === "live" && (
            <div className="bg-destructive/10 border border-destructive p-4 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-destructive">LIVE TRADING ACTIVE</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Real money is at risk. All trades will be executed with real funds.
                </div>
              </div>
            </div>
          )}

          <Dialog open={showLiveConfirmation} onOpenChange={setShowLiveConfirmation}>
            <DialogContent data-testid="dialog-live-trading-confirmation">
              <DialogHeader>
                <DialogTitle className="text-destructive">⚠️ Enable Live Trading?</DialogTitle>
                <DialogDescription className="space-y-4 pt-4">
                  <p>
                    You are about to enable LIVE TRADING mode. This means all trades will be executed with real money through your connected broker account.
                  </p>
                  <p className="font-semibold">
                    Please confirm you understand the following:
                  </p>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3">
                      <Checkbox 
                        checked={confirmations.realMoney}
                        onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, realMoney: !!checked }))}
                        data-testid="checkbox-real-money" 
                      />
                      <span className="text-sm">
                        I understand this involves real money and I can lose some or all of my investment
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <Checkbox 
                        checked={confirmations.responsibility}
                        onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, responsibility: !!checked }))}
                        data-testid="checkbox-responsibility" 
                      />
                      <span className="text-sm">
                        I accept full responsibility for all trading decisions and outcomes
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <Checkbox 
                        checked={confirmations.risks}
                        onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, risks: !!checked }))}
                        data-testid="checkbox-risks" 
                      />
                      <span className="text-sm">
                        I have read and understood the risks associated with algorithmic trading
                      </span>
                    </label>
                    <label className="flex items-start gap-3">
                      <Checkbox 
                        checked={confirmations.testing}
                        onCheckedChange={(checked) => setConfirmations(prev => ({ ...prev, testing: !!checked }))}
                        data-testid="checkbox-testing" 
                      />
                      <span className="text-sm">
                        I have thoroughly tested this strategy in paper trading mode
                      </span>
                    </label>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowLiveConfirmation(false);
                    setConfirmations({ realMoney: false, responsibility: false, risks: false, testing: false });
                  }}
                  data-testid="button-cancel-live"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmLiveTrading}
                  data-testid="button-confirm-live"
                >
                  Enable Live Trading
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card data-testid="card-api-keys">
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Manage API keys for market data providers and AI services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="gemini-key">Gemini API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="gemini-key"
                  type={showApiKey ? "text" : "password"}
                  defaultValue="AIza...xyz123"
                  className="font-mono pr-10"
                  data-testid="input-gemini-key"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0"
                  onClick={() => setShowApiKey(!showApiKey)}
                  data-testid="button-toggle-key-visibility"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" data-testid="button-test-gemini">
                Test Connection
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Last verified: <span className="font-mono">2024-01-15 14:32:18</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="market-data-provider">Market Data Provider</Label>
            <Select value={marketDataProvider} onValueChange={setMarketDataProvider}>
              <SelectTrigger id="market-data-provider" data-testid="select-market-data-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yfinance">Yahoo Finance (Free)</SelectItem>
                <SelectItem value="iex">IEX Cloud</SelectItem>
                <SelectItem value="polygon">Polygon.io</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="market-data-key">Market Data API Key</Label>
            <Input
              id="market-data-key"
              type="password"
              placeholder="Optional for Yahoo Finance"
              className="font-mono"
              data-testid="input-market-data-key"
            />
          </div>

          <Button 
            onClick={() => handleSaveSettings({ marketDataProvider })}
            data-testid="button-save-api-keys"
            disabled={saveSettings.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveSettings.isPending ? "Saving..." : "Save API Keys"}
          </Button>
        </CardContent>
      </Card>

      {/* System Preferences */}
      <Card data-testid="card-preferences">
        <CardHeader>
          <CardTitle>System Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Enable Gemini Sentiment Analysis</div>
              <div className="text-sm text-muted-foreground">
                Use AI to analyze market sentiment from news and social media
              </div>
            </div>
            <Switch 
              checked={geminiEnabled}
              onCheckedChange={(checked) => {
                setGeminiEnabled(checked);
                handleSaveSettings({ geminiEnabled: checked });
              }}
              data-testid="switch-gemini-sentiment" 
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Real-time Notifications</div>
              <div className="text-sm text-muted-foreground">
                Receive alerts for trade executions and model updates
              </div>
            </div>
            <Switch 
              checked={notificationsEnabled}
              onCheckedChange={(checked) => {
                setNotificationsEnabled(checked);
                handleSaveSettings({ notificationsEnabled: checked });
              }}
              data-testid="switch-notifications" 
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Dark Mode</div>
              <div className="text-sm text-muted-foreground">
                Switch between light and dark theme
              </div>
            </div>
            <Switch data-testid="switch-dark-mode" />
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card data-testid="card-audit-log">
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            Track all trading mode changes and system configuration updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log, idx) => (
                  <TableRow key={idx} data-testid={`row-audit-${idx}`}>
                    <TableCell className="font-mono text-sm">{log.timestamp}</TableCell>
                    <TableCell>{log.user}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell className="font-mono text-sm">{log.ip}</TableCell>
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
