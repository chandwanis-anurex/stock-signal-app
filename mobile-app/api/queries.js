import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { qk } from "./queryKeys";

// staleTime per resource — how long cached data is treated as fresh before a
// mounted screen will trigger a silent background refetch of it.
const STALE = {
  watchlists: 60 * 1000,       // rule_active/last_run_at can change via background jobs
  symbols: 5 * 60 * 1000,      // only changes via explicit add/delete/refresh
  channels: 5 * 60 * 1000,
  rules: 5 * 60 * 1000,
  signals: 15 * 1000,          // time-sensitive alerts
  analytics: 5 * 60 * 1000,
};

// ── Watchlists ────────────────────────────────────────────────────────────
export function useWatchlistsQuery() {
  return useQuery({ queryKey: qk.watchlists.list(), queryFn: api.listWatchlists, staleTime: STALE.watchlists });
}

// No single-watchlist GET on the backend — detail is derived from the list,
// but kept under its own key so a specific watchlist can be invalidated
// without forcing a refetch of every row.
export function useWatchlistDetailQuery(watchlistId) {
  return useQuery({
    queryKey: qk.watchlists.detail(watchlistId),
    queryFn: () => api.listWatchlists().then((list) => list.find((w) => w.id === watchlistId)),
    staleTime: STALE.watchlists,
    enabled: !!watchlistId,
  });
}

export function useWatchlistSymbolsQuery(watchlistId) {
  return useQuery({
    queryKey: qk.watchlists.symbols(watchlistId),
    queryFn: () => api.getWatchlistSymbols(watchlistId),
    staleTime: STALE.symbols,
    enabled: !!watchlistId,
  });
}

export function useWatchlistChannelsQuery(watchlistId) {
  return useQuery({
    queryKey: qk.watchlists.channels(watchlistId),
    queryFn: () => api.listAlertChannels(watchlistId),
    staleTime: STALE.channels,
    enabled: !!watchlistId,
  });
}

export function useCreateWatchlistMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, criteria }) => api.createWatchlist(name, criteria),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.watchlists.list() }),
  });
}

export function useCreateWatchlistManualMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, symbols }) => api.createWatchlistManual(name, symbols),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.watchlists.list() }),
  });
}

export function useUpdateWatchlistMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fields) => api.updateWatchlist(watchlistId, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.watchlists.detail(watchlistId) });
      qc.invalidateQueries({ queryKey: qk.watchlists.list() });
      // GET /rules returns each rule's watchlist_count/active_count computed
      // live from the Watchlist table, so reassigning a watchlist's rule_id
      // here makes that count stale until rules.list() is invalidated too.
      qc.invalidateQueries({ queryKey: qk.rules.list() });
    },
  });
}

export function useDeleteWatchlistMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (watchlistId) => api.deleteWatchlist(watchlistId),
    onSuccess: (_data, watchlistId) => {
      qc.invalidateQueries({ queryKey: qk.watchlists.list() });
      qc.removeQueries({ queryKey: qk.watchlists.detail(watchlistId) });
      qc.invalidateQueries({ queryKey: qk.rules.list() }); // watchlist_count/active_count for its rule changes
    },
  });
}

export function useToggleWatchlistRuleMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.toggleWatchlistRule(watchlistId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.watchlists.detail(watchlistId) });
      qc.invalidateQueries({ queryKey: qk.watchlists.list() });
      qc.invalidateQueries({ queryKey: qk.rules.list() }); // active_count for this rule changes
    },
  });
}

export function useHaltAllWatchlistsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.haltAllWatchlists,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.watchlists.all() });
      qc.invalidateQueries({ queryKey: qk.rules.list() }); // active_count drops across every rule
    },
  });
}

export function useRefreshWatchlistMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.refreshWatchlist(watchlistId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.watchlists.detail(watchlistId) }),
  });
}

export function useAddWatchlistSymbolMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol) => api.addWatchlistSymbol(watchlistId, symbol),
    onSuccess: (result) => {
      if (result.already_exists) return;
      qc.setQueryData(qk.watchlists.symbols(watchlistId), (prev = []) => [
        ...prev,
        { symbol: result.symbol, company_name: result.company_name, is_manual: true },
      ]);
    },
  });
}

export function useDeleteWatchlistSymbolMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (symbol) => api.deleteWatchlistSymbol(watchlistId, symbol),
    onSuccess: (_data, symbol) => {
      qc.setQueryData(qk.watchlists.symbols(watchlistId), (prev = []) => prev.filter((s) => s.symbol !== symbol));
    },
  });
}

export function useAddAlertChannelMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channelType, destination }) => api.addAlertChannel(watchlistId, channelType, destination),
    onSuccess: (ch) => qc.setQueryData(qk.watchlists.channels(watchlistId), (prev = []) => [...prev, ch]),
  });
}

export function useDeleteAlertChannelMutation(watchlistId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId) => api.deleteAlertChannel(watchlistId, channelId),
    onSuccess: (_data, channelId) => {
      qc.setQueryData(qk.watchlists.channels(watchlistId), (prev = []) => prev.filter((c) => c.id !== channelId));
    },
  });
}

export function useTestAlertChannelMutation(watchlistId) {
  return useMutation({ mutationFn: (channelId) => api.testAlertChannel(watchlistId, channelId) });
}

// ── Rules ─────────────────────────────────────────────────────────────────
export function useRulesQuery() {
  return useQuery({ queryKey: qk.rules.list(), queryFn: api.listRules, staleTime: STALE.rules });
}

// Same backend endpoint/shape as useRulesQuery — share the query key so
// AnalyticsScreen and RulesListScreen share one cache entry instead of
// double-fetching the identical resource.
export function useAllRulesQuery() {
  return useQuery({ queryKey: qk.rules.list(), queryFn: api.listAllRules, staleTime: STALE.rules });
}

export function useCreateRuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, buyCondition, sellCondition }) => api.createRule(name, buyCondition, sellCondition),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.rules.list() }),
  });
}

export function useUpdateRuleMutation(ruleId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, buyCondition, sellCondition }) => api.updateRule(ruleId, name, buyCondition, sellCondition),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.rules.list() });
      qc.invalidateQueries({ queryKey: qk.rules.detail(ruleId) });
      // Editing a rule can server-side force-stop watchlists using it
      // (RuleBuilderScreen.js reads result.stopped_watchlists) — those
      // watchlists' rule_active flag is now stale too.
      if (result.stopped_watchlists?.length) {
        qc.invalidateQueries({ queryKey: qk.watchlists.all() });
      }
    },
  });
}

export function useDeleteRuleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId) => api.deleteRule(ruleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.rules.list() });
      // Deleting a rule detaches it from any watchlist using it server-side.
      qc.invalidateQueries({ queryKey: qk.watchlists.all() });
    },
  });
}

// ── Signals ───────────────────────────────────────────────────────────────
export function useSignalsQuery(filters = {}) {
  return useQuery({
    queryKey: qk.signals.list(filters),
    queryFn: () => api.listSignals(filters.ruleId, filters.symbol),
    staleTime: STALE.signals,
  });
}

export function useDeleteSignalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signalId) => api.deleteSignal(signalId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.signals.list() }),
  });
}

export function useSignalQuery(signalId) {
  return useQuery({
    queryKey: qk.signals.detail(signalId),
    queryFn: () => api.getSignal(signalId),
    staleTime: STALE.signals,
    enabled: !!signalId,
  });
}

export function useSellSignalMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signalId) => api.sellSignalNow(signalId),
    onSuccess: (_data, signalId) => {
      qc.invalidateQueries({ queryKey: qk.signals.list() });
      qc.invalidateQueries({ queryKey: qk.signals.detail(signalId) });
    },
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────
export function useRulePerformanceQuery(ruleId, period) {
  return useQuery({
    queryKey: qk.analytics.rulePerformance(ruleId, period),
    queryFn: () => api.getRulePerformance(ruleId, period),
    staleTime: STALE.analytics,
    enabled: !!ruleId,
  });
}
