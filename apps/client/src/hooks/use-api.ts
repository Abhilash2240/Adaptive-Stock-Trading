import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

function getAuthHeaders(): Record<string, string> {
	const token = localStorage.getItem("auth_token");
	return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(resolveUrl(path), {
		credentials: "include",
		...init,
		headers: {
			Accept: "application/json",
			...getAuthHeaders(),
			...(init.headers ?? {}),
		},
	});

	if (response.status === 401) {
		localStorage.removeItem("auth_token");
		// Signal the auth context to clear state gracefully instead of
		// hard-reloading the page (which caused a login redirect loop).
		window.dispatchEvent(new Event("auth:expired"));
		throw new Error("Session expired");
	}

	if (!response.ok) {
		const message = (await response.text()) || `Request failed with status ${response.status}`;
		throw new Error(message);
	}

	return response;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await request(path, init);
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
	updated_at: string;
}

export interface StreamSubscribePayload {
	symbol: string;
	channel?: "quotes" | "trades";
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
		queryFn: () => requestJson<BackendReadyResponse>("/health/ready"),
		refetchInterval: 15000,
		staleTime: 15000,
		retry: 2,
	});
}

export function useBackendLive() {
	return useQuery<BackendLiveResponse>({
		queryKey: ["backend-live"],
		queryFn: () => requestJson<BackendLiveResponse>("/health/live"),
		refetchInterval: 30000,
		staleTime: 30000,
	});
}

export function useAgentStatus(enabled = true) {
	return useQuery<AgentStatusResponse>({
		queryKey: ["agent-status"],
		queryFn: () => requestJson<AgentStatusResponse>("/agent/status"),
		refetchInterval: enabled ? 4000 : false,
		enabled,
		retry: 1,
	});
}

export function useSubscribeToStream() {
	return useMutation({
		mutationFn: async ({ symbol, channel = "quotes" }: StreamSubscribePayload) => {
			await request("/stream", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ symbol, channel }),
			});
		},
	});
}

export function useSettings(userId: string) {
	return useQuery<UserSettingsResponse>({
		queryKey: ["settings", userId],
		enabled: Boolean(userId),
		queryFn: () => requestJson<UserSettingsResponse>(`/settings?userId=${encodeURIComponent(userId)}`),
		staleTime: 60_000,
	});
}

export function useSaveSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: SaveSettingsPayload) => {
			return requestJson<UserSettingsResponse>("/settings", {
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

