import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Alert, Keyboard, TouchableWithoutFeedback,
} from "react-native";
import { api } from "../api/client";

export default function AnalyticsScreen() {
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [summary, setSummary] = useState(null);

  const loadRules = useCallback(async () => {
    try {
      const data = await api.listAllRules();
      setRules(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const selectRule = async (rule) => {
    setSelectedRule(rule);
    setSummary(null);
    try {
      const data = await api.getRulePerformance(rule.id);
      setSummary(data);
    } catch (e) {
      Alert.alert("Failed to load", e.message);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Select a rule</Text>
        {rules.length === 0 && (
          <Text style={styles.empty}>No rules yet — create one from a watchlist.</Text>
        )}
        {rules.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.ruleRow, selectedRule?.id === r.id && styles.ruleRowSelected]}
            onPress={() => selectRule(r)}
          >
            <Text style={[styles.ruleName, selectedRule?.id === r.id && styles.ruleNameSelected]}>
              {r.name}
            </Text>
          </TouchableOpacity>
        ))}

        {summary && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedRule.name}</Text>
            <Text style={styles.metric}>
              Total signals: <Text style={styles.metricValue}>{summary.total_signals}</Text>
            </Text>
            <Text style={styles.metric}>
              Win rate:{" "}
              <Text style={styles.metricValue}>
                {summary.win_rate !== null ? `${(summary.win_rate * 100).toFixed(1)}%` : "n/a (no data yet)"}
              </Text>
            </Text>
            <Text style={styles.metric}>
              Avg return:{" "}
              <Text style={styles.metricValue}>
                {summary.avg_return_pct !== null ? `${summary.avg_return_pct.toFixed(2)}%` : "n/a (no data yet)"}
              </Text>
            </Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10, color: "#333" },
  empty: { color: "#999", marginBottom: 12 },
  ruleRow: {
    padding: 14, borderWidth: 1, borderColor: "#ddd",
    borderRadius: 8, marginBottom: 8,
  },
  ruleRowSelected: { borderColor: "#1a73e8", backgroundColor: "#f0f5ff" },
  ruleName: { fontSize: 15, fontWeight: "600", color: "#333" },
  ruleNameSelected: { color: "#1a73e8" },
  card: { marginTop: 20, padding: 16, backgroundColor: "#f7f9fc", borderRadius: 10 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#111" },
  metric: { fontSize: 14, marginBottom: 8, color: "#444" },
  metricValue: { fontWeight: "700", color: "#111" },
});
