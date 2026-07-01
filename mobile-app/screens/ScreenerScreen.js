import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, FlatList,
} from "react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";
import Dropdown from "../components/Dropdown";

const FIELDS = [
  { value: "market_cap_basic", label: "Market Cap" },
  { value: "close",            label: "Price (Close)" },
  { value: "volume",           label: "Volume" },
  { value: "relative_volume_10d_calc", label: "Relative Volume (10D)" },
  { value: "average_volume_10d_calc",  label: "Avg Volume (10D)" },
  { value: "change",           label: "Change %" },
  { value: "RSI",              label: "RSI (14)" },
  { value: "SMA20",            label: "SMA 20" },
  { value: "SMA50",            label: "SMA 50" },
  { value: "SMA200",           label: "SMA 200" },
  { value: "EMA20",            label: "EMA 20" },
  { value: "EMA50",            label: "EMA 50" },
  { value: "MACD.macd",        label: "MACD Line" },
  { value: "MACD.signal",      label: "MACD Signal" },
  { value: "W.R",              label: "Williams %R" },
  { value: "BB.upper",         label: "Bollinger Upper" },
  { value: "BB.lower",         label: "Bollinger Lower" },
  { value: "pe_ratio",         label: "P/E Ratio" },
  { value: "High.52W",         label: "52-Week High" },
  { value: "Low.52W",          label: "52-Week Low" },
];
const OPS = [
  { value: "gt",  label: "Greater than (>)" },
  { value: "gte", label: "Greater or equal (≥)" },
  { value: "lt",  label: "Less than (<)" },
  { value: "lte", label: "Less or equal (≤)" },
  { value: "eq",  label: "Equal to (=)" },
];
const EXCHANGES = [
  { value: "NASDAQ,NYSE,AMEX", label: "All US (NASDAQ + NYSE + AMEX)" },
  { value: "NASDAQ",           label: "NASDAQ only" },
  { value: "NYSE",             label: "NYSE only" },
  { value: "AMEX",             label: "AMEX only" },
];

export default function ScreenerScreen({ navigation }) {
  const [exchanges, setExchanges] = useState("NASDAQ,NYSE,AMEX");
  const [filters, setFilters]     = useState([{ field: "market_cap_basic", operator: "gt", value: "1000000000" }]);
  const [loading, setLoading]     = useState(false);
  const [results, setResults]     = useState(null); // null = not run yet

  const buildCriteria = () => ({
    exchanges: exchanges.split(",").map(e => e.trim()).filter(Boolean),
    filters: filters.map(f => ({ ...f, value: isNaN(f.value) ? f.value : Number(f.value) })),
    logic: "and",
    limit: 500,
  });

  const runScreener = async () => {
    setLoading(true);
    try {
      const data = await api.runScreenerPreview(buildCriteria());
      const rows = (data.results || []).map(r => ({
        symbol:  r.name || r.symbol || "",
        company: r.description || r.company_name || "",
      })).filter(r => r.symbol);
      setResults(rows);
    } catch (e) {
      Alert.alert("Screener failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const removeSymbol = (symbol) => {
    setResults(prev => prev.filter(r => r.symbol !== symbol));
  };

  const saveToWatchlist = () => {
    Alert.prompt(
      "Name This Watchlist",
      "Enter a name for this watchlist:",
      async (name) => {
        if (!name?.trim()) return;
        const trimmed = name.trim();
        try {
          const existing = await api.listWatchlists();
          const conflict = existing.find(w => w.name.toLowerCase() === trimmed.toLowerCase());
          if (conflict) {
            Alert.alert(
              "Name Already Exists",
              `A watchlist named "${trimmed}" already exists.`,
              [
                { text: "Replace It", style: "destructive", onPress: async () => {
                  await api.deleteWatchlist(conflict.id);
                  await _create(trimmed);
                }},
                { text: "Change Name", onPress: () => saveToWatchlist() },
                { text: "Cancel", style: "cancel" },
              ]
            );
            return;
          }
          await _create(trimmed);
        } catch (e) {
          Alert.alert("Save failed", e.message);
        }
      },
      "plain-text",
    );
  };

  const _create = async (name) => {
    try {
      const wl = await api.createWatchlist(name, buildCriteria());
      Alert.alert("Watchlist Saved", `"${name}" created with ${results.length} symbols.`, [
        { text: "View Watchlist", onPress: () => navigation.navigate("WatchlistsTab", { screen: "WatchlistDetail", params: { watchlistId: wl.id, name: wl.name } }) },
        { text: "Done" },
      ]);
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  const updateFilter = (i, key, val) => {
    const next = [...filters];
    next[i][key] = val;
    setFilters(next);
  };

  const renderRightActions = (symbol) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => removeSymbol(symbol)}>
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.swipeDeleteText}>Remove</Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Criteria */}
        <Dropdown label="Exchanges" value={exchanges} options={EXCHANGES} onChange={setExchanges} />

        <Text style={styles.sectionLabel}>Filters</Text>
        {filters.map((f, i) => (
          <View key={i} style={styles.filterCard}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterNum}>Filter {i + 1}</Text>
              {filters.length > 1 && (
                <TouchableOpacity onPress={() => setFilters(filters.filter((_, j) => j !== i))}>
                  <Text style={styles.removeLink}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
            <Dropdown label="Field"    value={f.field}    options={FIELDS} onChange={v => updateFilter(i, "field",    v)} />
            <Dropdown label="Operator" value={f.operator} options={OPS}    onChange={v => updateFilter(i, "operator", v)} />
            <Text style={styles.inputLabel}>Value</Text>
            <TextInput
              style={styles.input}
              value={String(f.value)}
              onChangeText={v => updateFilter(i, "value", v)}
              placeholder="e.g. 30"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
        ))}
        <TouchableOpacity style={styles.addFilterBtn} onPress={() => setFilters([...filters, { field: "RSI", operator: "lt", value: "30" }])}>
          <Text style={styles.addFilterText}>+ Add Filter</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.runBtn} onPress={runScreener} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#000" />
            : <><Ionicons name="search" size={18} color="#000" /><Text style={styles.runBtnText}>  Run Screener</Text></>
          }
        </TouchableOpacity>

        {/* Results */}
        {results !== null && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>{results.length} stocks matched</Text>
              <Text style={styles.resultsHint}>Swipe left to remove a symbol</Text>
            </View>

            {results.length === 0 ? (
              <Text style={styles.empty}>No stocks matched your criteria. Try adjusting the filters.</Text>
            ) : (
              results.map(r => (
                <Swipeable key={r.symbol} renderRightActions={() => renderRightActions(r.symbol)} overshootRight={false}>
                  <View style={styles.resultRow}>
                    <View>
                      <Text style={styles.resultSymbol}>{r.symbol}</Text>
                      {r.company ? <Text style={styles.resultCompany}>{r.company}</Text> : null}
                    </View>
                    <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
                  </View>
                </Swipeable>
              ))
            )}

            {results.length > 0 && (
              <TouchableOpacity style={styles.saveBtn} onPress={saveToWatchlist}>
                <Ionicons name="bookmark" size={18} color="#000" />
                <Text style={styles.saveBtnText}>  Save to Watchlist</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },

  sectionLabel: { ...typography.label, marginTop: 8, marginBottom: 10 },
  inputLabel:   { ...typography.label, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 14, color: colors.textPrimary, fontSize: 15, marginBottom: 12,
  },

  filterCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12,
  },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  filterNum:  { ...typography.label },
  removeLink: { color: colors.danger, fontSize: 13, fontFamily: "Inter_600SemiBold" },

  addFilterBtn: { padding: 12, alignItems: "center", marginBottom: 8 },
  addFilterText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },

  runBtn: {
    backgroundColor: colors.accent, flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 16, borderRadius: layout.buttonRadius, marginBottom: 24,
  },
  runBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },

  resultsHeader: { marginBottom: 12 },
  resultsCount: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.textPrimary },
  resultsHint:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  resultRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
  },
  resultSymbol:  { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.textPrimary },
  resultCompany: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  swipeDelete: {
    backgroundColor: colors.sell, borderRadius: layout.cardRadius,
    marginBottom: 8, width: 80, alignItems: "center", justifyContent: "center", gap: 4,
  },
  swipeDeleteText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },

  empty: { ...typography.bodySmall, textAlign: "center", marginTop: 16 },

  saveBtn: {
    backgroundColor: colors.buy, flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 16, borderRadius: layout.buttonRadius, marginTop: 16,
  },
  saveBtnText: { color: "#fff", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
