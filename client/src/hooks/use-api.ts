import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Portfolio, Model, Backtest, TrainingJob, PaperTradingSession, Settings } from "@shared/schema";

// Portfolio hooks
export function usePortfolios(userId: string) {
  return useQuery<Portfolio[]>({
    queryKey: ["/api/portfolios", { userId }],
    queryFn: async () => {
      const res = await fetch(`/api/portfolios?userId=${userId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!userId,
  });
}

export function usePortfolio(id: string) {
  return useQuery<Portfolio>({
    queryKey: [`/api/portfolios/${id}`],
    enabled: !!id,
  });
}

export function useCreatePortfolio() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/portfolios", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolios"] });
    },
  });
}

// Model hooks
export function useModels() {
  return useQuery<Model[]>({
    queryKey: ["/api/models"],
  });
}

export function useModel(id: string) {
  return useQuery<Model>({
    queryKey: [`/api/models/${id}`],
    enabled: !!id,
  });
}

export function useCreateModel() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/models", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    },
  });
}

// Backtest hooks
export function useBacktests() {
  return useQuery<Backtest[]>({
    queryKey: ["/api/backtests"],
  });
}

export function useBacktest(id: string) {
  return useQuery<Backtest>({
    queryKey: [`/api/backtests/${id}`],
    enabled: !!id,
  });
}

export function useCreateBacktest() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/backtests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtests"] });
    },
  });
}

// Training job hooks
export function useTrainingJob(id: string) {
  return useQuery<TrainingJob>({
    queryKey: [`/api/training/${id}`],
    enabled: !!id,
    refetchInterval: 2000, // Poll every 2 seconds for active jobs
  });
}

export function useStartTraining() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/training", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training"] });
    },
  });
}

export function useUpdateTrainingJob() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/training/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/training/${variables.id}`] });
    },
  });
}

// Paper trading hooks
export function useActivePaperTradingSessions() {
  return useQuery<PaperTradingSession[]>({
    queryKey: ["/api/paper-trading/active"],
    refetchInterval: 5000, // Poll every 5 seconds
  });
}

export function usePaperTradingSession(id: string) {
  return useQuery<PaperTradingSession>({
    queryKey: [`/api/paper-trading/${id}`],
    enabled: !!id,
    refetchInterval: 2000,
  });
}

export function useStartPaperTrading() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/paper-trading", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/paper-trading"] });
    },
  });
}

export function useUpdatePaperTrading() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/paper-trading/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/paper-trading/${variables.id}`] });
    },
  });
}

// Settings hooks
export function useSettings(userId: string) {
  return useQuery<Settings>({
    queryKey: ["/api/settings", { userId }],
    queryFn: async () => {
      const res = await fetch(`/api/settings?userId=${userId}`, {
        credentials: "include",
      });
      if (res.status === 404) {
        // Return default settings if not found
        return {
          id: "",
          userId,
          tradingMode: "paper",
          marketDataProvider: "yfinance",
          geminiEnabled: true,
          notificationsEnabled: true,
          updatedAt: new Date(),
        } as Settings;
      }
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useSaveSettings() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/settings", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings", { userId: variables.userId }] });
    },
  });
}

// Sentiment analysis hook
export function useAnalyzeSentiment() {
  return useMutation({
    mutationFn: async (data: { ticker: string; text: string }) => {
      const res = await apiRequest("POST", "/api/sentiment", data);
      return res.json();
    },
  });
}

// Agent decision hook
export function useAgentStep() {
  return useMutation({
    mutationFn: async (data: { ticker: string; state: any }) => {
      const res = await apiRequest("POST", "/api/agent/step", data);
      return res.json();
    },
  });
}
