import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";
import Dropdown from "../components/Dropdown";

const INDICATORS = [
  { value: "RSI", label: "RSI", hasPeriod: true },
  { value: "SMA", label: "SMA", hasPeriod: true },
  { value: "EMA", label: "EMA", hasPeriod: true },
  { value: "MACD", label: "MACD Line", hasPeriod: false },
  { value: "MACD_SIGNAL", label: "MACD Signal", hasPeriod: false },
  { value: "WILLIAMS_R", label: "Williams %R", hasPeriod: true },
  { value: "ULTIMATE_OSC", label: "Ultimate Oscillator", hasPeriod: false },
  { value: "VOLUME", label: "Volume", hasPeriod: false },
  { value: "VOLUME_SMA", label: "Volume SMA", hasPeriod: true },
  { value: "CLOSE", label: "Price (Close)", hasPeriod: false },
  { value: "BB_UPPER", label: "Bollinger Band Upper", hasPeriod: true },
  { value: "BB_LOWER", label: "Bollinger Band Lower", hasPeriod: true },
];

const INDICATOR_OPTIONS = INDICATORS.map((i) => ({ value: i.value, label: i.label }));

const OPERATORS = [
  { value: "gt", label: "is greater than (>)" },
  { value: "gte", label: "is greater than or equal (≥)" },
  { value: "lt", label: "is less than (<)" },
  { value: "lte", label: "is less than or equal (≤)" },
  { value: "crosses_above", label: "crosses above" },
  { value: "crosses_below", label: "crosses below" },
];

function TermCard({ term, index, onChange, onRemove, showRemove, side }) {
  const meta = INDICATORS.find((i) => i.value === term.indicator);
  return (
    <View style={styles.termCard}>
      <View style={styles.termHeader}>
        <View style={[styles.sideBadge, side === "buy" ? styles.buyBadge : styles.sellBadge]}>
          <Text style={styles.sideBadgeText}>{side === "buy" ? "BUY" : "SELL"} {index + 1}</Text>
        </View>
        {showRemove && (
          <TouchableOpacity onPress={onRemove}>
            <Text style={styles.removeBtn}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
      <Dropdown
        label="Indicator"
        value={term.indicator}
        options={INDICATOR_OPTIONS}
        onChange={(v) => onChange({ ...term, indicator: v, params: { period: 14 } })}
      />
      {meta?.hasPeriod && (
        <>
          <Text style={styles.inputLabel}>Period</Text>
          <TextInput
            style={styles.input}
            value={String(term.params?.period ?? 14)}
            onChangeText={(v) => onChange({ ...term, params: { period: Number(v) || 14 } })}
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}
      <Dropdown
        label="Condition"
        value={term.operator}
        options={OPERATORS}
        onChange={(v) => onChange({ ...term, operator: v })}
      />
      <Text style={styles.inputLabel}>Value</Text>
      <TextInput
        style={styles.input}
        value={String(term.value)}
        onChangeText={(v) => onChange({ ...term, value: v })}
        placeholder="e.g. 30"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

export default function RuleBuilderScreen({ route, navigation }) {
  const { watchlistId } = route.params;
  const [name, setName] = useState("");
  const [buyTerms, setBuyTerms] = useState([{ indicator: "RSI", params: { period: 14 }, operator: "lt", value: "30" }]);
  const [sellTerms, setSellTerms] = useState([{ indicator: "RSI", params: { period: 14 }, operator: "gt", value: "70" }]);

  const updateTerm = (list, setList, index, updated) => {
    const next = [...list];
    next[index] = updated;
    setList(next);
  };

  const removeTerm = (list, setList, index) => setList(list.filter((_, i) => i !== index));

  const save = async () => {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    try {
      const toNum = (terms) => terms.map((t) => ({ ...t, value: isNaN(t.value) ? t.value : Number(t.value) }));
      const rule = await api.createRule(
        watchlistId, name,
        { logic: "and", terms: toNum(buyTerms) },
        { logic: "and", terms: toNum(sellTerms) },
      );
      navigation.replace("AlertChannels", { watchlistId, ruleId: rule.id, ruleName: rule.name });
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.inputLabel}>Rule Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. RSI Mean Reversion"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.sectionLabel}>Buy Conditions</Text>
      <Text style={styles.sectionHint}>Signal fires when ALL conditions are true</Text>
      {buyTerms.map((t, i) => (
        <TermCard
          key={i} term={t} index={i} side="buy"
          showRemove={buyTerms.length > 1}
          onChange={(u) => updateTerm(buyTerms, setBuyTerms, i, u)}
          onRemove={() => removeTerm(buyTerms, setBuyTerms, i)}
        />
      ))}
      <TouchableOpacity style={styles.addButton} onPress={() => setBuyTerms([...buyTerms, { indicator: "MACD", params: {}, operator: "crosses_above", value: "0" }])}>
        <Text style={styles.addButtonText}>+ Add Buy Condition</Text>
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>Sell Conditions</Text>
      <Text style={styles.sectionHint}>Signal fires when ALL conditions are true</Text>
      {sellTerms.map((t, i) => (
        <TermCard
          key={i} term={t} index={i} side="sell"
          showRemove={sellTerms.length > 1}
          onChange={(u) => updateTerm(sellTerms, setSellTerms, i, u)}
          onRemove={() => removeTerm(sellTerms, setSellTerms, i)}
        />
      ))}
      <TouchableOpacity style={styles.addButton} onPress={() => setSellTerms([...sellTerms, { indicator: "MACD", params: {}, operator: "crosses_below", value: "0" }])}>
        <Text style={styles.addButtonText}>+ Add Sell Condition</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Rule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  inputLabel: { ...typography.label, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 14, color: colors.textPrimary, fontSize: 15, marginBottom: 12,
  },
  sectionLabel: { ...typography.label, marginTop: 20, marginBottom: 4 },
  sectionHint: { ...typography.bodySmall, marginBottom: 12 },
  termCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 12,
  },
  termHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sideBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  buyBadge: { backgroundColor: colors.buy + "22", borderWidth: 1, borderColor: colors.buy },
  sellBadge: { backgroundColor: colors.sell + "22", borderWidth: 1, borderColor: colors.sell },
  sideBadgeText: { fontSize: 11, fontWeight: "700", color: colors.textPrimary },
  removeBtn: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  addButton: { padding: 14, alignItems: "center", marginBottom: 4 },
  addButtonText: { color: colors.accent, fontWeight: "700", fontSize: 15 },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginVertical: 24,
  },
  saveButtonText: { color: "#000", fontWeight: "800", fontSize: 16 },
});
