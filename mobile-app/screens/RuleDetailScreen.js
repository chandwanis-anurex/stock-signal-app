import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

const INDICATOR_LABELS = {
  RSI: "RSI", SMA: "SMA", EMA: "EMA", MACD: "MACD Line",
  MACD_SIGNAL: "MACD Signal", WILLIAMS_R: "Williams %R",
  ULTIMATE_OSC: "Ultimate Oscillator", VOLUME: "Volume",
  VOLUME_SMA: "Volume SMA", CLOSE: "Price (Close)",
  BB_UPPER: "Bollinger Band Upper", BB_LOWER: "Bollinger Band Lower",
};

const OPERATOR_LABELS = {
  gt: ">", gte: "≥", lt: "<", lte: "≤",
  crosses_above: "crosses above", crosses_below: "crosses below",
};

function ConditionBlock({ condition, side }) {
  if (!condition?.terms?.length) return null;
  const color = side === "buy" ? colors.buy : colors.sell;
  return (
    <View style={[styles.conditionBlock, { borderColor: color + "44" }]}>
      <View style={[styles.conditionHeader, { backgroundColor: color + "18" }]}>
        <Text style={[styles.conditionTitle, { color }]}>{side === "buy" ? "BUY" : "SELL"} when all are true</Text>
      </View>
      {condition.terms.map((term, i) => {
        const indLabel = INDICATOR_LABELS[term.indicator] || term.indicator;
        const opLabel = OPERATOR_LABELS[term.operator] || term.operator;
        const period = term.params?.period;
        return (
          <View key={i} style={styles.termRow}>
            <Text style={styles.termIndicator}>
              {indLabel}{period ? ` (${period})` : ""}
            </Text>
            <Text style={styles.termOperator}>{opLabel}</Text>
            <Text style={styles.termValue}>{term.value}</Text>
          </View>
        );
      })}
      {side === "sell" && (condition.take_profit_pct != null || condition.stop_loss_pct != null) && (
        <View style={styles.exitTargetsRow}>
          {condition.take_profit_pct != null && (
            <View style={styles.exitChip}>
              <Text style={styles.exitChipLabel}>Take Profit</Text>
              <Text style={[styles.exitChipValue, { color: colors.buy }]}>+{condition.take_profit_pct}%</Text>
            </View>
          )}
          {condition.stop_loss_pct != null && (
            <View style={styles.exitChip}>
              <Text style={styles.exitChipLabel}>Stop Loss</Text>
              <Text style={[styles.exitChipValue, { color: colors.sell }]}>-{condition.stop_loss_pct}%</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function RuleDetailScreen({ route, navigation }) {
  const { watchlistId, ruleId } = route.params;
  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.getRule(watchlistId, ruleId)
      .then((data) => { setRule(data); navigation.setOptions({ title: data.name }); })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, [watchlistId, ruleId]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.ruleName}>{rule?.name}</Text>

      <ConditionBlock condition={rule?.buy_condition} side="buy" />
      <ConditionBlock condition={rule?.sell_condition} side="sell" />

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.alertButton}
          onPress={() => navigation.navigate("AlertChannels", { watchlistId, ruleId, ruleName: rule.name })}
        >
          <Text style={styles.alertButtonText}>Alert Channels</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate("RuleBuilder", { watchlistId, ruleId, existingRule: rule })}
        >
          <Text style={styles.editButtonText}>Edit Rule</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  ruleName: { ...typography.heading2, marginBottom: 20 },

  conditionBlock: {
    borderWidth: 1, borderRadius: layout.cardRadius,
    marginBottom: 16, overflow: "hidden",
  },
  conditionHeader: { paddingHorizontal: 14, paddingVertical: 10 },
  conditionTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  termRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: 8,
  },
  termIndicator: { ...typography.body, fontWeight: "700", flex: 2 },
  termOperator: { ...typography.bodySmall, flex: 1, textAlign: "center" },
  termValue: { ...typography.body, color: colors.accent, fontWeight: "700", flex: 1, textAlign: "right" },

  exitTargetsRow: {
    flexDirection: "row", gap: 10, padding: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  exitChip: {
    flex: 1, backgroundColor: colors.cardAlt, borderRadius: 8,
    padding: 10, alignItems: "center",
  },
  exitChipLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  exitChipValue: { fontSize: 16, fontWeight: "800" },
  actions: { marginTop: 8, gap: 12 },
  alertButton: {
    backgroundColor: colors.accent, padding: 16,
    alignItems: "center", borderRadius: layout.buttonRadius,
  },
  alertButtonText: { color: "#000", fontWeight: "800", fontSize: 16 },
  editButton: {
    borderWidth: 1, borderColor: colors.border, padding: 16,
    alignItems: "center", borderRadius: layout.buttonRadius,
  },
  editButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 16 },
});
