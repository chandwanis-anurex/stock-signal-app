const BASE = process.env.NEXT_PUBLIC_API_URL || "https://stock-signal-app-production-912e.up.railway.app";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sf_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user_id: number; email: string }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),

  listWatchlists: () => request<any[]>("/screener/watchlists"),
  getWatchlistSymbols: (id: number) => request<any[]>(`/screener/watchlists/${id}/symbols`),
  deleteWatchlist: (id: number) => request<any>(`/screener/watchlists/${id}`, { method: "DELETE" }),

  listRules: (watchlistId: number) => request<any[]>(`/watchlists/${watchlistId}/rules`),
  getRule: (watchlistId: number, ruleId: number) => request<any>(`/watchlists/${watchlistId}/rules/${ruleId}`),

  listSignals: (ruleId?: number) => {
    const q = ruleId ? `?rule_id=${ruleId}` : "";
    return request<any[]>(`/signals${q}`);
  },
  deleteSignal: (id: number) => request<any>(`/signals/${id}`, { method: "DELETE" }),
  listAllRules: () => request<any[]>("/signals/rules"),
  getRulePerformance: (ruleId: number, period = "all") =>
    request<any>(`/signals/rules/${ruleId}/performance?period=${period}`),
};
