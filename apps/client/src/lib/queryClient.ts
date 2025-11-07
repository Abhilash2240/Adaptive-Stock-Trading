import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Dynamically determine the API base URL
// If VITE_API_BASE is set, use it (for deployed static sites)
// Otherwise, use the current origin (for integrated deployments like Replit)
function getApiBase(): string {
  const envBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
  if (envBase) {
    return envBase;
  }
  
  // Use current origin for integrated deployments (Replit, local dev, etc.)
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return "";
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const base = getApiBase();
  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const base = getApiBase();
    const url = queryKey.join("/") as string;
    const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
