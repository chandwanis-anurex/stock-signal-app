import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

const PERIODS = [
  { key: "daily",   label: "Daily" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all",     label: "All Time" },
];

function fmt(val, suffix = "%") {
  if (val === null || val === undefined) return "—";
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}${suffix}`;
}

function MetricBox({ value, label, color }) {
  return (
    <View style={styles.metricBox}>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [period, setPeriod] = useState("weekly");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const data = await api.listAllRules();
      setRules(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRules(); }, [loadRules]));

  const loadPerformance = useCallback(async (rule, p) => {
    if (!rule) return;
    setLoading(true);
    setSummary(null);
    try {
      const data = await api.getRulePerformance(rule.id, p);
      setSummary(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectRule = (rule) => {
    setSelectedRule(rule);
    loadPerformance(rule, period);
  };

  const selectPeriod = (p) => {
    setPeriod(p);
    loadPerformance(selectedRule, p);
  };

  const avgColor = summary?.avg_return_pct > 0 ? colors.buy : summary?.avg_return_pct < 0 ? colors.sell : null;
  const bestColor = summary?.best_return > 0 ? colors.buy : colors.sell;
  const worstColor = summary?.worst_return >= 0 ? colors.buy : colors.sell;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionLabel}>Rule</Text>
      {rules.length === 0 ? (
        <Text style={styles.empty}>No rules yet — create one from a watchlist.</Text>
      ) : (
        rules.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.ruleCard, selectedRule?.id === r.id && styles.ruleCardSelected]}
            onPress={() => selectRule(r)}
          >
            <Text style={[styles.ruleName, selectedRule?.id === r.id && styles.ruleNameSelected]}>{r.name}</Text>
            {selectedRule?.id === r.id && <Text style={styles.ruleCheck}>✓</Text>}
          </TouchableOpacity>
        ))
      )}

      {selectedRule && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Period</Text>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodTab, period === p.key && styles.periodTabActive]}
                onPress={() => selectPeriod(p.key)}
              >
                <Text style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
          ) : summary ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{selectedRule.name}</Text>
              <Text style={styles.summaryPeriod}>{PERIODS.find(p => p.key === period)?.label} Performance</Text>

              <View style={styles.metricsRow}>
                <MetricBox value={String(summary.total_signals)} label="Signals" />
                <MetricBox value={String(summary.buy_signals)} label="Buy" color={colors.buy} />
                <MetricBox value={String(summary.sell_signals)} label="Sell" color={colors.sell} />
              </View>

              <View style={styles.divider} />

              <View style={styles.metricsRow}>
                <MetricBox
                  value={summary.win_rate !== null ? `${(summary.win_rate * 100).toFixed(1)}%` : "—"}
                  label="Win Rate"
                  color={summary.win_rate > 0.5 ? colors.buy : summary.win_rate !== null ? colors.sell : null}
                />
                <MetricBox
                  value={summary.avg_return_pct !== null ? fmt(summary.avg_return_pct) : "—"}
                  label="Avg Return"
                  color={avgColor}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.metricsRow}>
                <MetricBox
                  value={summary.best_return !== null ? fmt(summary.best_return) : "—"}
                  label="Best Signal"
                  color={summary.best_return !== null ? bestColor : null}
                />
                <MetricBox
                  value={summary.worst_return !== null ? fmt(summary.worst_return) : "—"}
                  label="Worst Signal"
                  color={summary.worst_return !== null ? worstColor : null}
                />
              </View>

              {summary.win_rate === null && summary.total_signals > 0 && (
                <Text style={styles.noDataNote}>
                  Return data populates after checkpoint windows close (1d, 1w, 1m).
                </Text>
              )}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  sectionLabel: { ...typography.label, marginBottom: 10 },
  empty: { ...typography.bodySmall },
  ruleCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 8,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  ruleCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  ruleName: { ...typography.body, fontFamily: "Inter_600SemiBold" },
  ruleNameSelected: { color: colors.accent },
  ruleCheck: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 16 },

  periodRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  periodTab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", backgroundColor: colors.card,
  },
  periodTabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  periodTabText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.textSecondary },
  periodTabTextActive: { color: "#000" },

  summaryCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 20, marginTop: 20, marginBottom: 32,
  },
  summaryTitle: { ...typography.heading3, marginBottom: 2 },
  summaryPeriod: { ...typography.bodySmall, marginBottom: 20 },
  metricsRow: { flexDirection: "row", justifyContent: "space-around", marginVertical: 8 },
  metricBox: { flex: 1, alignItems: "center", paddingVertical: 4 },
  metricValue: { fontSize: 24, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary },
  metricLabel: { ...typography.label, marginTop: 4, textAlign: "center" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  noDataNote: { ...typography.bodySmall, marginTop: 16, textAlign: "center", lineHeight: 20 },
});
