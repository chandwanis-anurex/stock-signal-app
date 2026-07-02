// Hierarchical query keys. Nesting matters: invalidateQueries({ queryKey: qk.watchlists.detail(id) })
// prefix-matches that watchlist's symbols/channels sub-keys too, since React Query
// does prefix (not exact) matching on key arrays by default.
export const qk = {
  watchlists: {
    list: () => ["watchlists", "list"],
    detail: (id) => ["watchlists", "detail", id],
    symbols: (id) => ["watchlists", "detail", id, "symbols"],
    channels: (id) => ["watchlists", "detail", id, "channels"],
    all: () => ["watchlists"],
  },
  rules: {
    list: () => ["rules", "list"],
    detail: (id) => ["rules", "detail", id],
    all: () => ["rules"],
  },
  signals: {
    list: (filters = {}) => ["signals", "list", filters],
    detail: (id) => ["signals", "detail", id],
  },
  analytics: {
    rulePerformance: (ruleId, period) => ["analytics", "rulePerformance", ruleId, period],
  },
};
