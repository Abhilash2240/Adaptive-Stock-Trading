import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseApiError } from "@/lib/parse-api-error";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function resolveUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) {
		return path;
	}
	if (!API_BASE) {
		return path;
	}
	return `${API_BASE}${path}`;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(resolveUrl(path), {
		credentials: "include",
		...init,
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			...(init.headers ?? {}),
		},
	});

	if (!response.ok) {
		const errBody = await response.json().catch(() => null);
		console.error("[API ERROR]", response.status, errBody);
		throw new Error(parseApiError(errBody, `Request failed with status ${response.status}`));
	}

	return response;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await apiFetch(path, init);
	if (response.status === 204) {
		return undefined as unknown as T;
	}
	return (await response.json()) as T;
}

export interface BackendReadyResponse {
	status: string;
	summary: {
		environment: string;
		provider: string;
	};
}

export interface BackendLiveResponse {
	status: string;
}

export interface AgentStatusResponse {
	state: string;
	model_version: string;
	last_action?: {
		symbol: string;
		side: "BUY" | "SELL" | "HOLD";
		confidence: number;
		generated_at: string;
	} | null;
	epsilon?: number;
	buffer_size?: number;
	step_count?: number;
	last_trained?: string | null;
	updated_at: string;
}

export interface Position {
	symbol: string;
	quantity: number;
	avg_price: number;
	current_price: number;
	unrealized_pnl: number;
	unrealized_pnl_pct: number;
}

export interface PortfolioStateResponse {
	user_id: string;
	cash: number;
	total_value: number;
	unrealized_pnl: number;
	positions: Position[];
	updated_at: string;
}

export interface TradeRecord {
	id: number;
	user_id: string;
	symbol: string;
	side: "BUY" | "SELL" | "HOLD";
	quantity: number;
	price: number;
	confidence: number;
	executed_at: string;
}

export interface CreateTradePayload {
	symbol: string;
	side: "BUY" | "SELL";
	quantity: number;
	price: number;
	confidence: number;
}

export interface TradeFilters {
	symbol?: string;
	action?: "BUY" | "SELL" | "HOLD" | "ALL";
	from?: string;
	to?: string;
}

export interface TrainingResult {
	loss: number | null;
	epsilon: number;
	steps: number;
}

export interface StreamSubscribePayload {
	symbol: string;
	channel?: "quotes" | "trades";
}

export interface LiveQuoteResponse {
	symbol: string;
	name: string;
	price: number;
	open: number;
	high: number;
	low: number;
	volume: number;
	change: number;
	percent_change: number;
	currency: string;
	exchange: string;
	is_market_open: boolean;
	market_status: "open" | "closed" | "unknown";
	last_quote_time: string;
	provider: string;
}

export interface UserSettingsResponse {
	userId: string;
	tradingMode: "paper" | "live";
	marketDataProvider: string;
	geminiEnabled: boolean;
	notificationsEnabled: boolean;
}

export interface SaveSettingsPayload extends Partial<UserSettingsResponse> {
	userId: string;
}

export interface ChatRequestPayload {
	userId: string;
	message: string;
	symbol?: string;
}

export interface ChatResponsePayload {
	answer: string;
	model: string;
	timestamp: string;
}

export const apiBaseUrl = API_BASE;

export function resolveWebSocketUrl(): string {
	const envUrl = (import.meta.env as any).VITE_WS_URL as string | undefined;
	if (envUrl) {
		return envUrl;
	}
	if (typeof window !== "undefined") {
		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		return `${protocol}//${window.location.host}/ws/quotes`;
	}
	return "ws://localhost:8001/ws/quotes";
}

export function useBackendReady() {
	return useQuery<BackendReadyResponse>({
		queryKey: ["backend-ready"],
		queryFn: () => requestJson<BackendReadyResponse>("/api/v1/health/ready"),
		refetchInterval: 15000,
		staleTime: 15000,
		retry: 2,
	});
}

export function useBackendLive() {
	return useQuery<BackendLiveResponse>({
		queryKey: ["backend-live"],
		queryFn: () => requestJson<BackendLiveResponse>("/api/v1/health/live"),
		refetchInterval: 30000,
		staleTime: 30000,
	});
}

export function useAgentStatus(enabled = true) {
	return useQuery<AgentStatusResponse>({
		queryKey: ["agent-status"],
		queryFn: () => requestJson<AgentStatusResponse>("/api/v1/agent"),
		refetchInterval: enabled ? 4000 : false,
		enabled,
		retry: 1,
	});
}

export function useSubscribeToStream() {
	return useMutation({
		mutationFn: async ({ symbol, channel = "quotes" }: StreamSubscribePayload) => {
			await apiFetch("/api/v1/stream", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ symbol, channel }),
			});
		},
	});
}

export function useLiveQuote(symbol: string, enabled = true) {
	return useQuery<LiveQuoteResponse>({
		queryKey: ["live-quote", symbol],
		enabled: enabled && Boolean(symbol),
		queryFn: () => requestJson<LiveQuoteResponse>(`/api/v1/quotes?symbol=${encodeURIComponent(symbol)}`),
		staleTime: 15_000,
		refetchInterval: enabled ? 30_000 : false,
		retry: 1,
	});
}

export function useSettings(userId: string) {
	return useQuery<UserSettingsResponse>({
		queryKey: ["settings", userId],
		enabled: Boolean(userId),
		queryFn: () => requestJson<UserSettingsResponse>(`/api/v1/settings?userId=${encodeURIComponent(userId)}`),
		staleTime: 60_000,
	});
}

export function useSaveSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: SaveSettingsPayload) => {
			return requestJson<UserSettingsResponse>("/api/v1/settings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});
		},
		onSuccess: (data) => {
			queryClient.setQueryData(["settings", data.userId], data);
		},
	});
}

export function usePortfolioState(enabled = true) {
	return useQuery<PortfolioStateResponse>({
		queryKey: ["portfolio-state"],
		queryFn: () => requestJson<PortfolioStateResponse>("/api/v1/portfolio"),
		enabled,
		refetchInterval: enabled ? 4000 : false,
		staleTime: 3000,
	});
}

export function useTradeHistory(page: number, filters: TradeFilters = {}) {
	const limit = 20;
	const offset = Math.max(0, (page - 1) * limit);
	const params = new URLSearchParams();
	params.set("limit", String(Math.max(limit, offset + limit)));
	if (filters.symbol && filters.symbol !== "ALL") params.set("symbol", filters.symbol);
	if (filters.action && filters.action !== "ALL") params.set("action", filters.action);
	if (filters.from) params.set("from", filters.from);
	if (filters.to) params.set("to", filters.to);

	return useQuery<TradeRecord[]>({
		queryKey: ["trade-history", page, filters],
		queryFn: async () => {
			const all = await requestJson<TradeRecord[]>(`/api/v1/trades?${params.toString()}`);
			return all.slice(offset, offset + limit);
		},
		staleTime: 2000,
		refetchInterval: 4000,
	});
}

export function useTrainStep() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => requestJson<TrainingResult>("/api/v1/rl/train", { method: "POST" }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent-status"] });
		},
	});
}

export function useCreateTrade() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateTradePayload) =>
			requestJson<TradeRecord>("/api/v1/trades", {
				method: "POST",
				body: JSON.stringify(payload),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["trade-history"] });
			queryClient.invalidateQueries({ queryKey: ["portfolio-state"] });
		},
	});
}

export function useGeminiChat() {
	return useMutation({
		mutationFn: (payload: ChatRequestPayload) =>
			requestJson<ChatResponsePayload>("/api/v1/chat", {
				method: "POST",
				body: JSON.stringify(payload),
			}),
	});
}

