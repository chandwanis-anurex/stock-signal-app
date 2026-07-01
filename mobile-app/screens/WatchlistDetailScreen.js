import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

const FIELD_LABELS = {
  market_cap_basic: "Market Cap", close: "Price", volume: "Volume",
  relative_volume_10d_calc: "Rel. Volume 10D", average_volume_10d_calc: "Avg Volume 10D",
  change: "Change %", change_from_open: "Change from Open %",
  RSI: "RSI", SMA20: "SMA 20", SMA50: "SMA 50", SMA200: "SMA 200",
  EMA20: "EMA 20", EMA50: "EMA 50", EMA200: "EMA 200",
  "MACD.macd": "MACD", "MACD.signal": "MACD Signal",
  "W.R": "Williams %R", UO: "Ultimate Oscillator",
  pe_ratio: "P/E Ratio", eps_diluted_ttm: "EPS (TTM)",
  dividend_yield_recent: "Dividend Yield", debt_to_equity: "Debt/Equity",
  "High.52W": "52W High", "Low.52W": "52W Low",
};

const OP_LABELS = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", neq: "≠" };

function formatValue(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return String(v);
}

export default function WatchlistDetailScreen({ route, navigation }) {
  const { watchlistId, name: initialName, criteria: initialCriteria } = route.params;
  const [symbols, setSymbols] = useState([]);
  const [rules, setRules] = useState([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

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
    navigation.setOptions({
      title: editing ? "Edit Watchlist" : name,
      headerRight: () => (
        <TouchableOpacity onPress={() => setEditing(e => !e)} style={{ marginRight: 16 }}>
          <Text style={{ color: colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
            {editing ? "Done" : "Edit"}
          </Text>
        </TouchableOpacity>
      ),
    });
    load();
  }, [load, navigation, name, editing]));

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.updateWatchlist(watchlistId, { name: name.trim() });
      navigation.setOptions({ title: name.trim() });
    } catch (e) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSymbol = (symbol) => {
    Alert.alert("Remove Symbol", `Remove ${symbol} from this watchlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            await api.deleteWatchlistSymbol(watchlistId, symbol);
            setSymbols(prev => prev.filter(s => s.symbol !== symbol));
          } catch (e) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  const filters = initialCriteria?.filters || [];
  const exchanges = initialCriteria?.exchanges || [];

  return (
    <ScrollView style={styles.container}>

      {/* Name editor (edit mode only) */}
      {editing && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Watchlist Name</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "..." : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Screener Criteria */}
      {initialCriteria && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Screener Criteria</Text>
            {editing && (
              <TouchableOpacity onPress={() => navigation.navigate("CriteriaBuilder", {
                watchlistId,
                existingName: name,
                existingCriteria: initialCriteria,
              })}>
                <Text style={styles.editLink}>Edit Criteria</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.criteriaCard}>
            {exchanges.length > 0 && (
              <Text style={styles.criteriaExchange}>
                Exchanges: {exchanges.join(", ")}
              </Text>
            )}
            {filters.map((f, i) => (
              <View key={i} style={styles.criteriaRow}>
                <Text style={styles.criteriaField}>
                  {FIELD_LABELS[f.field] || f.field}
                </Text>
                <Text style={styles.criteriaOp}>{OP_LABELS[f.operator] || f.operator}</Text>
                <Text style={styles.criteriaValue}>{formatValue(f.value)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Rules */}
      <Text style={styles.sectionLabel}>Rules</Text>
      {rules.length === 0 ? (
        <Text style={styles.empty}>No rules yet.</Text>
      ) : (
        rules.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate("RuleDetail", { watchlistId, ruleId: item.id })}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        ))
      )}
      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate("RuleBuilder", { watchlistId })}>
        <Text style={styles.addButtonText}>+ New Rule</Text>
      </TouchableOpacity>

      {/* Symbols */}
      <Text style={styles.sectionLabel}>
        Symbols ({symbols.length}){editing ? " — tap × to remove" : ""}
      </Text>
      {symbols.length === 0 ? (
        <Text style={styles.empty}>No symbols yet — screener runs on a schedule.</Text>
      ) : (
        <View style={styles.symbolList}>
          {symbols.map((item) => (
            <View key={item.symbol} style={styles.symbolRow}>
              <View>
                <Text style={styles.symbolText}>{item.symbol}</Text>
                {item.company_name ? (
                  <Text style={styles.symbolCompany}>{item.company_name}</Text>
                ) : null}
              </View>
              {editing && (
                <TouchableOpacity onPress={() => deleteSymbol(item.symbol)} style={styles.deleteBtn}>
                  <Ionicons name="close-circle" size={22} color={colors.sell} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  section: { marginBottom: 8 },
  sectionLabel: { ...typography.label, marginTop: 20, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 10 },
  editLink: { color: colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  empty: { ...typography.bodySmall, marginBottom: 12 },

  nameRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  nameInput: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 12, color: colors.textPrimary,
    fontSize: 15, fontFamily: "Inter_600SemiBold",
  },
  saveBtn: { backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: layout.buttonRadius },
  saveBtnText: { color: "#000", fontFamily: "Inter_700Bold", fontSize: 14 },

  criteriaCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  criteriaExchange: { fontSize: 12, color: colors.textSecondary, marginBottom: 10, fontFamily: "Inter_600SemiBold" },
  criteriaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  criteriaField: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.textPrimary },
  criteriaOp: { fontSize: 14, color: colors.accent, fontFamily: "Inter_700Bold", minWidth: 20, textAlign: "center" },
  criteriaValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.textPrimary },

  card: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius, borderWidth: 1,
    borderColor: colors.border, padding: 16, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  cardTitle: { ...typography.heading3 },
  cardArrow: { fontSize: 22, color: colors.textSecondary },
  addButton: { padding: 12, alignItems: "center", marginBottom: 8 },
  addButtonText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },

  symbolList: { marginBottom: 16 },
  symbolRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.card, borderRadius: layout.cardRadius, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
  },
  symbolText: { fontFamily: "Inter_700Bold", fontSize: 15, color: colors.textPrimary },
  symbolCompany: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  deleteBtn: { padding: 4 },
});
