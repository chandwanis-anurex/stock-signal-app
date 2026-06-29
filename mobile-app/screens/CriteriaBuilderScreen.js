import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { api } from "../api/client";

const FIELD_OPTIONS = ["market_cap_basic", "close", "volume", "RSI", "sector", "exchange"];
const OPERATOR_OPTIONS = ["gt", "gte", "lt", "lte", "eq", "neq"];

export default function CriteriaBuilderScreen({ navigation }) {
  const [name, setName] = useState("");
  const [exchanges, setExchanges] = useState("NASDAQ,NYSE,AMEX");
  const [filters, setFilters] = useState([{ field: "market_cap_basic", operator: "gt", value: "1000000000" }]);
  const [previewCount, setPreviewCount] = useState(null);
  const [loading, setLoading] = useState(false);

  const updateFilter = (index, key, value) => {
    const next = [...filters];
    next[index][key] = value;
    setFilters(next);
  };

  const addFilter = () => setFilters([...filters, { field: "RSI", operator: "lt", value: "30" }]);

  const buildCriteria = () => ({
    exchanges: exchanges.split(",").map((e) => e.trim()).filter(Boolean),
    filters: filters.map((f) => ({ ...f, value: isNaN(f.value) ? f.value : Number(f.value) })),
    logic: "and",
    limit: 500,
  });

  const preview = async () => {
    setLoading(true);
    try {
      const result = await api.runScreenerPreview(buildCriteria());
      setPreviewCount(result.count);
    } catch (e) {
      Alert.alert("Preview failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required");
      return;
    }
    try {
      const wl = await api.createWatchlist(name, buildCriteria());
      navigation.replace("WatchlistDetail", { watchlistId: wl.id, name: wl.name });
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Watchlist name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Oversold Tech Stocks" />

      <Text style={styles.label}>Exchanges (comma separated)</Text>
      <TextInput style={styles.input} value={exchanges} onChangeText={setExchanges} />

      <Text style={styles.label}>Filters</Text>
      {filters.map((f, i) => (
        <View key={i} style={styles.filterRow}>
          <TextInput
            style={styles.filterField}
            value={f.field}
            onChangeText={(v) => updateFilter(i, "field", v)}
            placeholder="field (e.g. RSI)"
          />
          <TextInput
            style={styles.filterOp}
            value={f.operator}
            onChangeText={(v) => updateFilter(i, "operator", v)}
            placeholder="op"
          />
          <TextInput
            style={styles.filterValue}
            value={String(f.value)}
            onChangeText={(v) => updateFilter(i, "value", v)}
            placeholder="value"
          />
        </View>
      ))}
      <Text style={styles.hint}>
        Field options: {FIELD_OPTIONS.join(", ")} (or any tradingview-screener field name). Operators:{" "}
        {OPERATOR_OPTIONS.join(", ")}.
      </Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={addFilter}>
        <Text style={styles.secondaryButtonText}>+ Add filter</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={preview} disabled={loading}>
        <Text style={styles.secondaryButtonText}>{loading ? "Loading..." : "Preview match count"}</Text>
      </TouchableOpacity>
      {previewCount !== null && <Text style={styles.previewText}>{previewCount} stocks match</Text>}

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Watchlist</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  label: { fontSize: 13, color: "#555", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  filterField: { flex: 2, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 },
  filterOp: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 },
  filterValue: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8 },
  hint: { fontSize: 11, color: "#999", marginBottom: 8 },
  secondaryButton: { padding: 10, alignItems: "center", marginVertical: 4 },
  secondaryButtonText: { color: "#1a73e8", fontWeight: "600" },
  previewText: { textAlign: "center", marginVertical: 8, fontWeight: "600" },
  saveButton: { backgroundColor: "#1a73e8", padding: 16, alignItems: "center", borderRadius: 8, marginVertical: 20 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
