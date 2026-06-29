import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

export default function WatchlistDetailScreen({ route, navigation }) {
  const { watchlistId, name } = route.params;
  const [symbols, setSymbols] = useState([]);
  const [rules, setRules] = useState([]);

  const load = useCallback(async () => {
    try {
      const [syms, rls] = await Promise.all([
        api.getWatchlistSymbols(watchlistId),
        api.listRules(watchlistId),
      ]);
      setSymbols(syms);
      setRules(rls);
    } catch (e) {
      console.warn(e);
    }
  }, [watchlistId]);

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: name });
    load();
  }, [load, navigation, name]));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionLabel}>Rules</Text>
      {rules.length === 0 ? (
        <Text style={styles.empty}>No rules yet.</Text>
      ) : (
        rules.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate("AlertChannels", { watchlistId, ruleId: item.id, ruleName: item.name })}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate("RuleBuilder", { watchlistId })}
      >
        <Text style={styles.addButtonText}>+ New Rule</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Matched Symbols ({symbols.length})</Text>
      {symbols.length === 0 ? (
        <Text style={styles.empty}>No symbols yet — screener runs on a schedule.</Text>
      ) : (
        <View style={styles.symbolGrid}>
          {symbols.map((item, i) => (
            <View key={`${item.symbol}-${i}`} style={styles.symbolChip}>
              <Text style={styles.symbolText}>{item.symbol}</Text>
              <Text style={styles.symbolExchange}>{item.exchange}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  sectionLabel: { ...typography.label, marginTop: 20, marginBottom: 10 },
  empty: { ...typography.bodySmall, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { ...typography.heading3 },
  cardArrow: { fontSize: 22, color: colors.textSecondary },
  addButton: { padding: 12, alignItems: "center", marginBottom: 8 },
  addButtonText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
  symbolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  symbolChip: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  symbolText: { ...typography.body, fontWeight: "700" },
  symbolExchange: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
