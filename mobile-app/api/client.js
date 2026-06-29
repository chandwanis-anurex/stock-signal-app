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
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  runScreenerPreview: (criteria) =>
    request("/screener/run", { method: "POST", body: JSON.stringify(criteria) }),

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

  listWatchlists: () => request("/screener/watchlists"),

  deleteWatchlist: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}`, { method: "DELETE" }),

  getWatchlistSymbols: (watchlistId) =>
    request(`/screener/watchlists/${watchlistId}/symbols`),

  createRule: (watchlistId, name, buyCondition, sellCondition) =>
    request(`/watchlists/${watchlistId}/rules`, {
      method: "POST",
      body: JSON.stringify({ name, buy_condition: buyCondition, sell_condition: sellCondition }),
    }),

  listRules: (watchlistId) => request(`/watchlists/${watchlistId}/rules`),

  getRule: (watchlistId, ruleId) => request(`/watchlists/${watchlistId}/rules/${ruleId}`),

  listAlertChannels: (watchlistId, ruleId) =>
    request(`/watchlists/${watchlistId}/rules/${ruleId}/alert-channels`),

  updateAlertChannel: (watchlistId, ruleId, channelId, channelType, destination) =>
    request(`/watchlists/${watchlistId}/rules/${ruleId}/alert-channels/${channelId}`, {
      method: "PATCH",
      body: JSON.stringify({ channel_type: channelType, destination }),
    }),

  testAlertChannel: (watchlistId, ruleId, channelId) =>
    request(`/watchlists/${watchlistId}/rules/${ruleId}/alert-channels/${channelId}/test`, { method: "POST" }),

  addAlertChannel: (watchlistId, ruleId, channelType, destination) =>
    request(`/watchlists/${watchlistId}/rules/${ruleId}/alert-channels`, {
      method: "POST",
      body: JSON.stringify({ channel_type: channelType, destination }),
    }),

  listSignals: (ruleId, symbol) => {
    const params = new URLSearchParams();
    if (ruleId) params.append("rule_id", ruleId);
    if (symbol) params.append("symbol", symbol);
    return request(`/signals?${params.toString()}`);
  },

  listAllRules: () => request("/signals/rules"),

  getRulePerformance: (ruleId) => request(`/signals/rules/${ruleId}/performance`),
};
