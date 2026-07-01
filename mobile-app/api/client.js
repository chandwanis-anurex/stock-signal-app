import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = "https://stock-signal-app-production-912e.up.railway.app";

const TOKEN_KEY = "auth_token";

export const auth = {
  saveToken: (token) => AsyncStorage.setItem(TOKEN_KEY, token),
  getToken: () => AsyncStorage.getItem(TOKEN_KEY),
  removeToken: () => AsyncStorage.removeItem(TOKEN_KEY),
};

async function request(path, options = {}) {
  const token = await auth.getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  forgotPassword: (email) =>
    request("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (email, code, newPassword) =>
    request("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code, new_password: newPassword }) }),

  // ── Screener ──────────────────────────────────────────────────────────────
  runScreenerPreview: (criteria) =>
    request("/screener/run", { method: "POST", body: JSON.stringify(criteria) }),

  // ── Watchlists ────────────────────────────────────────────────────────────
  listWatchlists: () => request("/screener/watchlists"),

  createWatchlist: (name, criteria, refreshIntervalSeconds = 300) =>
    request("/screener/watchlists", {
      method: "POST",
      body: JSON.stringify({ name, criteria, refresh_interval_seconds: refreshIntervalSeconds }),
    }),

  createWatchlistManual: (name, symbols) =>
    request("/screener/watchlists/manual", {
      method: "POST",
      body: JSON.stringify({ name, symbols }),
    }),

  updateWatchlist: (id, fields) =>
    request(`/screener/watchlists/${id}`, { method: "PATCH", body: JSON.stringify(fields) }),

  deleteWatchlist: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}`, { method: "DELETE" }),

  // ── Rule toggle / halt ────────────────────────────────────────────────────
  toggleWatchlistRule: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}/toggle`, { method: "POST" }),

  haltAllWatchlists: () =>
    request("/screener/watchlists/halt-all", { method: "POST" }),

  refreshWatchlist: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}/refresh`, { method: "POST" }),

  // ── Symbols ───────────────────────────────────────────────────────────────
  getWatchlistSymbols: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}/symbols`),

  addWatchlistSymbol: (watchlistId, symbol) =>
    request(`/screener/watchlists/${watchlistId}/symbols`, {
      method: "POST",
      body: JSON.stringify({ symbol }),
    }),

  deleteWatchlistSymbol: (watchlistId, symbol) =>
    request(`/screener/watchlists/${watchlistId}/symbols/${symbol}`, { method: "DELETE" }),

  // ── Alert channels (watchlist-level) ─────────────────────────────────────
  listAlertChannels: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}/alert-channels`),

  addAlertChannel: (watchlistId, channelType, destination) =>
    request(`/screener/watchlists/${watchlistId}/alert-channels`, {
      method: "POST",
      body: JSON.stringify({ channel_type: channelType, destination }),
    }),

  updateAlertChannel: (watchlistId, channelId, fields) =>
    request(`/screener/watchlists/${watchlistId}/alert-channels/${channelId}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    }),

  deleteAlertChannel: (watchlistId, channelId) =>
    request(`/screener/watchlists/${watchlistId}/alert-channels/${channelId}`, { method: "DELETE" }),

  testAlertChannel: (watchlistId, channelId) =>
    request(`/screener/watchlists/${watchlistId}/alert-channels/${channelId}/test`, { method: "POST" }),

  // ── Standalone rules ──────────────────────────────────────────────────────
  listRules: () => request("/rules"),

  createRule: (name, buyCondition, sellCondition) =>
    request("/rules", {
      method: "POST",
      body: JSON.stringify({ name, buy_condition: buyCondition, sell_condition: sellCondition }),
    }),

  getRule: (ruleId) => request(`/rules/${ruleId}`),

  updateRule: (ruleId, name, buyCondition, sellCondition) =>
    request(`/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify({ name, buy_condition: buyCondition, sell_condition: sellCondition }),
    }),

  deleteRule: (ruleId) => request(`/rules/${ruleId}`, { method: "DELETE" }),

  // ── Signals ───────────────────────────────────────────────────────────────
  listSignals: (ruleId, symbol) => {
    const params = new URLSearchParams();
    if (ruleId) params.append("rule_id", ruleId);
    if (symbol) params.append("symbol", symbol);
    return request(`/signals?${params.toString()}`);
  },

  deleteSignal: (signalId) =>
    request(`/signals/${signalId}`, { method: "DELETE" }),

  // ── Analytics ─────────────────────────────────────────────────────────────
  listAllRules: () => request("/rules"),

  getRulePerformance: (ruleId, period = "all") =>
    request(`/signals/rules/${ruleId}/performance?period=${period}`),
};
