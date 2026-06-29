import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";

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
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Rules ({rules.length})</Text>
      <FlatList
        data={rules}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("AlertChannels", { watchlistId, ruleId: item.id, ruleName: item.name })}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No rules yet.</Text>}
      />
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate("RuleBuilder", { watchlistId })}
      >
        <Text style={styles.secondaryButtonText}>+ New Rule</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Matched symbols ({symbols.length})</Text>
      <FlatList
        data={symbols}
        keyExtractor={(item, i) => `${item.symbol}-${i}`}
        renderItem={({ item }) => (
          <View style={styles.symbolRow}>
            <Text>{item.symbol}</Text>
            <Text style={styles.rowSub}>{item.exchange}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No symbols yet — the screener runs on a schedule.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginTop: 16, marginBottom: 8, color: "#333" },
  row: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowSub: { fontSize: 12, color: "#888" },
  symbolRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f3f3",
  },
  empty: { color: "#999", paddingVertical: 8 },
  secondaryButton: { padding: 10, alignItems: "center" },
  secondaryButtonText: { color: "#1a73e8", fontWeight: "600" },
});
