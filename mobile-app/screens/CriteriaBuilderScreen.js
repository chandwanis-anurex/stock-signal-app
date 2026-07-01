import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";
import Dropdown from "../components/Dropdown";

const SCREENER_FIELDS = [
  { value: "market_cap_basic", label: "Market Cap" },
  { value: "close", label: "Price (Close)" },
  { value: "volume", label: "Volume" },
  { value: "relative_volume_10d_calc", label: "Relative Volume (10D)" },
  { value: "average_volume_10d_calc", label: "Avg Volume (10D)" },
  { value: "change", label: "Change %" },
  { value: "change_from_open", label: "Change from Open %" },
  { value: "RSI", label: "RSI (14)" },
  { value: "SMA20", label: "SMA 20" },
  { value: "SMA50", label: "SMA 50" },
  { value: "SMA200", label: "SMA 200" },
  { value: "EMA20", label: "EMA 20" },
  { value: "EMA50", label: "EMA 50" },
  { value: "EMA200", label: "EMA 200" },
  { value: "MACD.macd", label: "MACD Line" },
  { value: "MACD.signal", label: "MACD Signal" },
  { value: "W.R", label: "Williams %R" },
  { value: "UO", label: "Ultimate Oscillator" },
  { value: "Stoch.K", label: "Stochastic %K" },
  { value: "Stoch.D", label: "Stochastic %D" },
  { value: "ADX", label: "ADX" },
  { value: "ATR", label: "ATR (14)" },
  { value: "BB.upper", label: "Bollinger Band Upper" },
  { value: "BB.lower", label: "Bollinger Band Lower" },
  { value: "pe_ratio", label: "P/E Ratio" },
  { value: "eps_diluted_ttm", label: "EPS (TTM)" },
  { value: "dividend_yield_recent", label: "Dividend Yield" },
  { value: "debt_to_equity", label: "Debt to Equity" },
  { value: "High.52W", label: "52-Week High" },
  { value: "Low.52W", label: "52-Week Low" },
  { value: "High.1M", label: "1-Month High" },
  { value: "Low.1M", label: "1-Month Low" },
];

const OPERATORS = [
  { value: "gt", label: "Greater than (>)" },
  { value: "gte", label: "Greater than or equal (≥)" },
  { value: "lt", label: "Less than (<)" },
  { value: "lte", label: "Less than or equal (≤)" },
  { value: "eq", label: "Equal to (=)" },
  { value: "neq", label: "Not equal to (≠)" },
];

const EXCHANGES = [
  { value: "NASDAQ,NYSE,AMEX", label: "All US (NASDAQ + NYSE + AMEX)" },
  { value: "NASDAQ", label: "NASDAQ only" },
  { value: "NYSE", label: "NYSE only" },
  { value: "AMEX", label: "AMEX only" },
  { value: "NASDAQ,NYSE", label: "NASDAQ + NYSE" },
];

export default function CriteriaBuilderScreen({ navigation, route }) {
  const { watchlistId, existingName, existingCriteria } = route.params || {};
  const isEditing = !!watchlistId;

  const [name, setName] = useState(existingName || "");
  const [exchanges, setExchanges] = useState(
    existingCriteria?.exchanges?.join(",") || "NASDAQ,NYSE,AMEX"
  );
  const [filters, setFilters] = useState(
    existingCriteria?.filters?.map(f => ({ ...f, value: String(f.value) })) ||
    [{ field: "market_cap_basic", operator: "gt", value: "1000000000" }]
  );
  const [previewCount, setPreviewCount] = useState(null);
  const [loading, setLoading] = useState(false);

  const updateFilter = (index, key, value) => {
    const next = [...filters];
    next[index][key] = value;
    setFilters(next);
  };

  const removeFilter = (index) => setFilters(filters.filter((_, i) => i !== index));

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
    if (!name.trim()) { Alert.alert("Name required"); return; }
    try {
      if (isEditing) {
        await api.updateWatchlist(watchlistId, { name: name.trim(), criteria: buildCriteria() });
        navigation.navigate("WatchlistDetail", { watchlistId, name: name.trim(), criteria: buildCriteria() });
      } else {
        const wl = await api.createWatchlist(name, buildCriteria());
        navigation.replace("WatchlistDetail", { watchlistId: wl.id, name: wl.name, criteria: buildCriteria() });
      }
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.inputLabel}>Watchlist Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Oversold Tech Stocks"
        placeholderTextColor={colors.textMuted}
      />

      <Dropdown label="Exchanges" value={exchanges} options={EXCHANGES} onChange={setExchanges} />

      <Text style={styles.sectionLabel}>Filters</Text>
      {filters.map((f, i) => (
        <View key={i} style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterNum}>Filter {i + 1}</Text>
            {filters.length > 1 && (
              <TouchableOpacity onPress={() => removeFilter(i)}>
                <Text style={styles.removeBtn}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>
          <Dropdown label="Field" value={f.field} options={SCREENER_FIELDS} onChange={(v) => updateFilter(i, "field", v)} />
          <Dropdown label="Operator" value={f.operator} options={OPERATORS} onChange={(v) => updateFilter(i, "operator", v)} />
          <Text style={styles.inputLabel}>Value</Text>
          <TextInput
            style={styles.input}
            value={String(f.value)}
            onChangeText={(v) => updateFilter(i, "value", v)}
            placeholder="e.g. 30"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </View>
      ))}

      <TouchableOpacity style={styles.addButton} onPress={addFilter}>
        <Text style={styles.addButtonText}>+ Add Filter</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.previewButton} onPress={preview} disabled={loading}>
        <Text style={styles.previewButtonText}>{loading ? "Loading..." : "Preview Match Count"}</Text>
      </TouchableOpacity>

      {previewCount !== null && (
        <View style={styles.previewResult}>
          <Text style={styles.previewCount}>{previewCount}</Text>
          <Text style={styles.previewLabel}>stocks match your criteria</Text>
        </View>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>{isEditing ? "Update Criteria" : "Save Watchlist"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  sectionLabel: { ...typography.label, marginTop: 8, marginBottom: 10 },
  inputLabel: { ...typography.label, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 14, color: colors.textPrimary, fontSize: 15, marginBottom: 12,
  },
  filterCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12,
  },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  filterNum: { ...typography.label },
  removeBtn: { color: colors.danger, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addButton: { padding: 14, alignItems: "center", marginBottom: 8 },
  addButtonText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },
  previewButton: {
    borderWidth: 1, borderColor: colors.accent, padding: 14,
    borderRadius: layout.buttonRadius, alignItems: "center", marginBottom: 16,
  },
  previewButtonText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },
  previewResult: { alignItems: "center", marginBottom: 16 },
  previewCount: { fontSize: 36, fontFamily: "Inter_800ExtraBold", color: colors.accent },
  previewLabel: { ...typography.bodySmall, marginTop: 4 },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginVertical: 20,
  },
  saveButtonText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
