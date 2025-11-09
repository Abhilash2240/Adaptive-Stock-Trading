import { useEffect, useMemo, useState } from "react";
import { Activity, Database, LineChart as LineChartIcon, RefreshCw, Wifi } from "lucide-react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ResponsiveContainer,
} from "recharts";

import { useQuoteStreamContext } from "@/context/quote-stream-context";
import { useAgentStatus, useBackendReady } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { formatPrice, formatRelativeTime, titleCase } from "@/utils/formatters";

export default function Dashboard() {
	const { toast } = useToast();
	const {
		quotes,
		history,
		status: connectionStatus,
		latency,
		lastMessageAt,
		subscribe,
		isSubscribing,
	} = useQuoteStreamContext();
	const { data: backendReady } = useBackendReady();
	const {
		data: agentStatus,
		refetch: refetchAgent,
		isFetching: isAgentRefreshing,
		isLoading: isAgentLoading,
	} = useAgentStatus();

	const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
	const [symbolInput, setSymbolInput] = useState("");

	useEffect(() => {
		if (!selectedSymbol && quotes.length > 0) {
			setSelectedSymbol(quotes[0].symbol);
		}
	}, [quotes, selectedSymbol]);

	const selectedHistory = useMemo(() => {
		if (!selectedSymbol) {
			return [];
		}
		return history[selectedSymbol] ?? [];
	}, [history, selectedSymbol]);

	const chartData = useMemo(
		() =>
			selectedHistory.map((item) => ({
				time: new Date(item.timestamp).toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				}),
				price: item.price,
			})),
		[selectedHistory],
	);

	const currentQuote = useMemo(() => {
		if (!selectedSymbol) {
			return undefined;
		}
		return quotes.find((quote) => quote.symbol === selectedSymbol);
	}, [quotes, selectedSymbol]);

	const providerName = backendReady?.summary?.provider ?? "mock";
	const environment = backendReady?.summary?.environment ?? "development";
		const agentState = titleCase(agentStatus?.state ?? "idle");
	const agentModel = agentStatus?.model_version ?? "unknown";
	const agentUpdatedAt = agentStatus?.updated_at ?? null;

	const connectionTrend = connectionStatus === "connected" ? "up" : connectionStatus === "reconnecting" ? "neutral" : "down";
	const latencyTrend = latency !== null && latency <= 150 ? "up" : latency !== null ? "down" : "neutral";
	const agentTrend = agentStatus?.state === "running" ? "up" : agentStatus?.state === "error" ? "down" : "neutral";

	const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = symbolInput.trim().toUpperCase();
		if (!trimmed) {
			return;
		}
		try {
			await subscribe(trimmed);
			toast({
				title: `Subscribed to ${trimmed}`,
				description: "The backend will stream quotes for this symbol as data becomes available.",
			});
			setSelectedSymbol(trimmed);
			setSymbolInput("");
		} catch (error) {
			const description = error instanceof Error ? error.message : "Unable to subscribe to the requested symbol.";
			toast({
				title: "Subscription failed",
				description,
				variant: "destructive",
			});
		}
	};

	return (
		<div className="space-y-8" data-testid="page-dashboard">
			<div className="flex flex-col gap-2">
				<h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
					Live Trading Overview
				</h1>
				<p className="text-muted-foreground" data-testid="text-page-subtitle">
					Monitor streaming market data, backend health, and agent readiness in real time.
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<MetricCard
					label="Connection"
					value={connectionStatus.toUpperCase()}
					icon={Wifi}
					trend={connectionTrend}
					testId="metric-connection"
				/>
				<MetricCard
					label="Latency"
					value={latency !== null ? `${Math.max(0, Math.round(latency))} ms` : "—"}
					icon={LineChartIcon}
					trend={latencyTrend}
					changeLabel={latency !== null ? "avg message delay" : undefined}
					testId="metric-latency"
				/>
				<MetricCard
					label="Agent State"
					value={agentState}
					icon={Activity}
					trend={agentTrend}
					changeLabel={`Model ${agentModel}`}
					testId="metric-agent"
				/>
				<MetricCard
					label="Data Provider"
					value={providerName.toUpperCase()}
					icon={Database}
					trend="neutral"
					changeLabel={environment.toUpperCase()}
					testId="metric-provider"
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<Card className="lg:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between gap-4">
						<div>
							<CardTitle className="text-xl font-semibold">Price Stream</CardTitle>
							<p className="text-sm text-muted-foreground">
								{selectedSymbol ? `Last ${selectedHistory.length} ticks for ${selectedSymbol}` : "Select a symbol to view recent price action."}
							</p>
						</div>
						{selectedSymbol && (
							<Badge variant="outline" className="font-mono px-3 py-1 text-sm">
								{selectedSymbol}
							</Badge>
						)}
					</CardHeader>
					<CardContent className="h-[320px]">
						{chartData.length > 1 ? (
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" opacity={0.15} />
									<XAxis dataKey="time" tick={{ fontSize: 12 }} minTickGap={24} />
									<YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
									<Tooltip
										contentStyle={{
											backgroundColor: "hsl(var(--popover))",
											border: "1px solid hsl(var(--border))",
											borderRadius: "0.5rem",
										}}
										formatter={(value: number) => `$${value.toFixed(2)}`}
									/>
									<Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
								</LineChart>
							</ResponsiveContainer>
						) : (
							<div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
								<p>No recent ticks for the selected symbol yet.</p>
								<p className="mt-2">Stream activity will appear here once the backend publishes data.</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="space-y-4">
					<CardHeader className="space-y-2">
						<CardTitle className="text-xl font-semibold">Controls</CardTitle>
						<p className="text-sm text-muted-foreground">
							Subscribe to additional symbols and inspect the agent heartbeat.
						</p>
					</CardHeader>
					<CardContent className="space-y-6">
						<form className="space-y-3" onSubmit={handleSubscribe}>
							<label className="text-sm font-medium" htmlFor="symbol-input">
								Subscribe to symbol
							</label>
							<div className="flex gap-2">
								<Input
									id="symbol-input"
									placeholder="e.g. AAPL"
									value={symbolInput}
									onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
									maxLength={8}
									className="uppercase"
									autoComplete="off"
									data-testid="input-subscribe-symbol"
								/>
								<Button type="submit" disabled={isSubscribing} data-testid="button-subscribe">
									{isSubscribing ? "Subscribing…" : "Subscribe"}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								Symbols must be enabled server-side. The mock provider streams {"AAPL"}, {"MSFT"}, and {"TSLA"} by default.
							</p>
						</form>

						<div className="border rounded-lg p-4 space-y-3 bg-muted/50">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-semibold">Agent heartbeat</p>
									<p className="text-xs text-muted-foreground">
										Updated {formatRelativeTime(agentUpdatedAt)}
									</p>
								</div>
								<Button
									size="icon"
									variant="outline"
									onClick={() => refetchAgent()}
									disabled={isAgentRefreshing}
									data-testid="button-refresh-agent"
								>
									<RefreshCw className={`h-4 w-4 ${isAgentRefreshing ? "animate-spin" : ""}`} />
								</Button>
							</div>
							<div className="grid grid-cols-2 gap-3 text-sm">
								<div>
									<p className="text-muted-foreground">State</p>
									<p className="font-semibold">{agentState}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Model</p>
									<p className="font-semibold">{agentModel}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Connection</p>
									<p className="font-semibold">{connectionStatus}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Last socket event</p>
									<p className="font-semibold">{formatRelativeTime(lastMessageAt)}</p>
								</div>
							</div>
							{isAgentLoading && <p className="text-xs text-muted-foreground">Fetching agent status…</p>}
						</div>

						<div className="rounded-lg border p-4 bg-muted/40">
							<p className="text-xs text-muted-foreground leading-relaxed">
								Tip: Run the FastAPI backend locally with <code className="font-mono text-[11px]">python -m backend.main</code> and
								configure <code className="font-mono text-[11px]">VITE_API_BASE</code> / <code className="font-mono text-[11px]">VITE_WS_URL</code> to connect from the client.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Active Streams</CardTitle>
						<p className="text-sm text-muted-foreground">
							Latest tick per symbol. Click a row to focus the chart.
						</p>
					</div>
					<Badge variant="outline" className="px-3 py-1 font-medium">
						{quotes.length} symbols
					</Badge>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Symbol</TableHead>
								<TableHead className="text-right">Last Price</TableHead>
								<TableHead className="text-right">Δ (1 tick)</TableHead>
								<TableHead className="text-right">Volume</TableHead>
								<TableHead className="text-right">Updated</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{quotes.map((quote) => {
								const rows = history[quote.symbol] ?? [];
								const previousQuote = rows.length > 1 ? rows[rows.length - 2] : null;
								const priceChange = previousQuote ? quote.price - previousQuote.price : null;
								const priceChangePct = previousQuote && previousQuote.price !== 0 ? (priceChange! / previousQuote.price) * 100 : null;
								const changeIsPositive = priceChange !== null && priceChange > 0;
								const changeIsNegative = priceChange !== null && priceChange < 0;

								return (
									<TableRow
										key={quote.symbol}
										data-state={selectedSymbol === quote.symbol ? "selected" : undefined}
										className="cursor-pointer"
										onClick={() => setSelectedSymbol(quote.symbol)}
										data-testid={`row-quote-${quote.symbol}`}
									>
										<TableCell>
											<span className="font-mono font-semibold">{quote.symbol}</span>
										</TableCell>
										<TableCell className="text-right font-mono">{formatPrice(quote.price)}</TableCell>
										<TableCell className="text-right">
											{priceChange !== null ? (
												<span
													className={`font-mono text-sm ${
														changeIsPositive ? "text-green-600 dark:text-green-400" : changeIsNegative ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
													}`}
												>
													{priceChange > 0 ? "+" : ""}
													{priceChange.toFixed(2)}
													{priceChangePct !== null && ` (${priceChangePct > 0 ? "+" : ""}${priceChangePct.toFixed(2)}%)`}
												</span>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell className="text-right font-mono text-sm">{quote.volume.toLocaleString()}</TableCell>
										<TableCell className="text-right text-sm text-muted-foreground">
											{formatRelativeTime(quote.timestamp)}
										</TableCell>
									</TableRow>
								);
							})}
							{quotes.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
										Waiting for the first quote from the backend…
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}

