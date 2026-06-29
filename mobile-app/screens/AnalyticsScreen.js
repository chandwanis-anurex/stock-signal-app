import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

export default function AnalyticsScreen() {
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
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

  const selectRule = async (rule) => {
    setSelectedRule(rule);
    setSummary(null);
    setLoading(true);
    try {
      const data = await api.getRulePerformance(rule.id);
      setSummary(data);
    } catch (e) {
      Alert.alert("Failed to load", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionLabel}>Select a Rule</Text>
      {rules.length === 0 ? (
        <Text style={styles.empty}>No rules yet — create one from a watchlist.</Text>
      ) : (
        rules.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.ruleCard, selectedRule?.id === r.id && styles.ruleCardSelected]}
            onPress={() => selectRule(r)}
          >
            <Text style={[styles.ruleName, selectedRule?.id === r.id && styles.ruleNameSelected]}>
              {r.name}
            </Text>
            {selectedRule?.id === r.id && <Text style={styles.ruleCheck}>✓</Text>}
          </TouchableOpacity>
        ))
      )}

      {loading && <Text style={styles.loading}>Loading performance...</Text>}

      {summary && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{selectedRule.name}</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{summary.total_signals}</Text>
              <Text style={styles.metricLabel}>Total Signals</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>
                {summary.win_rate !== null ? `${(summary.win_rate * 100).toFixed(1)}%` : "—"}
              </Text>
              <Text style={styles.metricLabel}>Win Rate</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricValue, summary.avg_return_pct > 0 ? styles.positive : summary.avg_return_pct < 0 ? styles.negative : null]}>
                {summary.avg_return_pct !== null ? `${summary.avg_return_pct.toFixed(2)}%` : "—"}
              </Text>
              <Text style={styles.metricLabel}>Avg Return</Text>
            </View>
          </View>
          {summary.win_rate === null && (
            <Text style={styles.noDataNote}>Win rate and avg return require closed positions with outcome data.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  sectionLabel: { ...typography.label, marginBottom: 12 },
  empty: { ...typography.bodySmall },
  ruleCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  ruleCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  ruleName: { ...typography.body, fontWeight: "600" },
  ruleNameSelected: { color: colors.accent },
  ruleCheck: { color: colors.accent, fontWeight: "700", fontSize: 16 },
  loading: { ...typography.bodySmall, textAlign: "center", marginTop: 20 },
  summaryCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 20, marginTop: 20,
  },
  summaryTitle: { ...typography.heading3, marginBottom: 20 },
  metricsRow: { flexDirection: "row", justifyContent: "space-between" },
  metricBox: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  metricLabel: { ...typography.label, marginTop: 4, textAlign: "center" },
  positive: { color: colors.buy },
  negative: { color: colors.sell },
  noDataNote: { ...typography.bodySmall, marginTop: 16, textAlign: "center", lineHeight: 18 },
});
