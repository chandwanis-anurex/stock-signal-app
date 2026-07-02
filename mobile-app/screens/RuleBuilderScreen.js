import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCreateRuleMutation, useUpdateRuleMutation } from "../api/queries";
import { colors, typography, layout } from "../theme";
import Dropdown from "../components/Dropdown";

// Only bounded/normalized indicators get a plain numeric threshold — a fixed
// number only makes sense across a whole watchlist if the indicator is
// already on a 0-100 (or similar) scale regardless of the stock's price.
// Raw price-level indicators (Close, SMA, EMA, Bollinger Bands) are left out
// entirely since "Price > 50" doesn't generalize across different stocks.
// MACD and Volume are still useful, but only as crossovers against their own
// companion series (Signal Line / Volume SMA) — never a fixed number.
const INDICATORS = [
  { value: "RSI",          label: "RSI",                 hasPeriod: true,  compareMode: "value" },
  { value: "WILLIAMS_R",   label: "Williams %R",         hasPeriod: true,  compareMode: "value" },
  { value: "ULTIMATE_OSC", label: "Ultimate Oscillator", hasPeriod: false, compareMode: "value" },
  { value: "STOCH_K",      label: "Stochastic %K",       hasPeriod: true,  compareMode: "value" },
  { value: "STOCH_D",      label: "Stochastic %D",       hasPeriod: true,  compareMode: "value" },
  {
    value: "MACD", label: "MACD Line", hasPeriod: false, compareMode: "indicator",
    compareTarget: "MACD_SIGNAL", compareLabel: "vs. Signal Line",
    operators: ["crosses_above", "crosses_below"],
  },
  {
    value: "VOLUME", label: "Volume", hasPeriod: false, compareMode: "indicator",
    compareTarget: "VOLUME_SMA", compareLabel: "vs. 20-Day Avg Volume",
    operators: ["gt", "gte", "lt", "lte", "crosses_above", "crosses_below"],
  },
];
const INDICATOR_OPTIONS = INDICATORS.map(i => ({ value: i.value, label: i.label }));
const OPERATORS = [
  { value: "gt",           label: "is greater than (>)"      },
  { value: "gte",          label: "is greater than or equal (≥)" },
  { value: "lt",           label: "is less than (<)"         },
  { value: "lte",          label: "is less than or equal (≤)" },
  { value: "crosses_above", label: "crosses above"           },
  { value: "crosses_below", label: "crosses below"           },
];

function operatorsFor(meta) {
  const allowed = meta?.operators ?? ["gt", "gte", "lt", "lte", "crosses_above", "crosses_below"];
  return OPERATORS.filter(o => allowed.includes(o.value));
}

// Sensible defaults when the user switches to a different indicator, so the
// term never lands on a combination the backend/UI can't represent.
function defaultsForIndicator(indicatorValue) {
  const meta = INDICATORS.find(i => i.value === indicatorValue);
  if (meta?.compareMode === "indicator") {
    return { operator: meta.operators[0], value: meta.compareTarget };
  }
  return { operator: "gt", value: "50" };
}

function TermCard({ term, index, onChange, onRemove, showRemove, side }) {
  const meta = INDICATORS.find(i => i.value === term.indicator);
  return (
    <View style={[styles.termCard, { borderColor: side === "buy" ? colors.buy + "44" : colors.sell + "44" }]}>
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
      <Dropdown label="Indicator" value={term.indicator} options={INDICATOR_OPTIONS}
        onChange={v => onChange({ ...term, indicator: v, params: { period: 14 }, ...defaultsForIndicator(v) })} />
      {meta?.hasPeriod && (
        <>
          <Text style={styles.inputLabel}>Period</Text>
          <TextInput
            style={styles.input}
            value={String(term.params?.period ?? 14)}
            onChangeText={v => onChange({ ...term, params: { period: Number(v) || 14 } })}
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}
      <Dropdown label="Condition" value={term.operator} options={operatorsFor(meta)}
        onChange={v => onChange({ ...term, operator: v })} />
      {meta?.compareMode === "indicator" ? (
        <View style={styles.compareRow}>
          <Text style={styles.compareLabel}>{meta.compareLabel}</Text>
        </View>
      ) : (
        <>
          <Text style={styles.inputLabel}>Value</Text>
          <TextInput
            style={styles.input}
            value={String(term.value)}
            onChangeText={v => onChange({ ...term, value: v })}
            placeholder="e.g. 30"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />
        </>
      )}
    </View>
  );
}

const DEFAULT_BUY  = [{ indicator: "RSI", params: { period: 14 }, operator: "lt",  value: "30" }];
const DEFAULT_SELL = [{ indicator: "RSI", params: { period: 14 }, operator: "gt",  value: "70" }];

export default function RuleBuilderScreen({ route, navigation }) {
  const existingRule = route.params?.existingRule;
  const isEditing = !!existingRule;

  const [name, setName] = useState(existingRule?.name ?? "");
  const [buyTerms, setBuyTerms] = useState(
    existingRule?.buy_condition?.terms?.map(t => ({ ...t, value: String(t.value) })) ?? DEFAULT_BUY
  );
  const [sellTerms, setSellTerms] = useState(
    existingRule?.sell_condition?.terms?.map(t => ({ ...t, value: String(t.value) })) ?? DEFAULT_SELL
  );
  const [takeProfitPct, setTakeProfitPct] = useState(
    existingRule?.sell_condition?.take_profit_pct != null ? String(existingRule.sell_condition.take_profit_pct) : ""
  );
  const [stopLossPct, setStopLossPct] = useState(
    existingRule?.sell_condition?.stop_loss_pct != null ? String(existingRule.sell_condition.stop_loss_pct) : ""
  );

  const createMutation = useCreateRuleMutation();
  const updateMutation = useUpdateRuleMutation(existingRule?.id);

  const updateTerm = (list, setList, i, updated) => {
    const next = [...list]; next[i] = updated; setList(next);
  };
  const removeTerm = (list, setList, i) => setList(list.filter((_, j) => j !== i));

  const toNum = terms => terms.map(t => ({ ...t, value: isNaN(t.value) ? t.value : Number(t.value) }));

  const save = async () => {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    const buyCondition  = { logic: "and", terms: toNum(buyTerms) };
    const sellCondition = { logic: "and", terms: toNum(sellTerms) };
    if (takeProfitPct !== "") sellCondition.take_profit_pct = parseFloat(takeProfitPct);
    if (stopLossPct   !== "") sellCondition.stop_loss_pct   = parseFloat(stopLossPct);

    try {
      if (isEditing) {
        const result = await updateMutation.mutateAsync({ name: name.trim(), buyCondition, sellCondition });
        if (result.stopped_watchlists?.length > 0) {
          Alert.alert(
            "Rule Updated",
            `Rule saved. The following watchlists were stopped and need to be restarted:\n\n${result.stopped_watchlists.join("\n")}`,
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        } else {
          navigation.goBack();
        }
      } else {
        await createMutation.mutateAsync({ name: name.trim(), buyCondition, sellCondition });
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
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
          <TermCard key={i} term={t} index={i} side="buy"
            showRemove={buyTerms.length > 1}
            onChange={u => updateTerm(buyTerms, setBuyTerms, i, u)}
            onRemove={() => removeTerm(buyTerms, setBuyTerms, i)} />
        ))}
        <TouchableOpacity style={styles.addBtn}
          onPress={() => setBuyTerms([...buyTerms, { indicator: "MACD", params: {}, operator: "crosses_above", value: "MACD_SIGNAL" }])}>
          <Text style={styles.addBtnText}>+ Add Buy Condition</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Sell Conditions</Text>
        <Text style={styles.sectionHint}>Signal fires when ALL conditions are true</Text>
        {sellTerms.map((t, i) => (
          <TermCard key={i} term={t} index={i} side="sell"
            showRemove={sellTerms.length > 1}
            onChange={u => updateTerm(sellTerms, setSellTerms, i, u)}
            onRemove={() => removeTerm(sellTerms, setSellTerms, i)} />
        ))}
        <TouchableOpacity style={styles.addBtn}
          onPress={() => setSellTerms([...sellTerms, { indicator: "MACD", params: {}, operator: "crosses_below", value: "MACD_SIGNAL" }])}>
          <Text style={styles.addBtnText}>+ Add Sell Condition</Text>
        </TouchableOpacity>

        {/* Exit targets — rendered last so keyboard scrolls them into view */}
        <View style={styles.exitCard}>
          <Text style={styles.exitCardTitle}>Exit Targets</Text>
          <Text style={styles.sectionHint}>Auto-sell signal when price moves this % from entry</Text>
          <View style={styles.exitRow}>
            <View style={styles.exitField}>
              <Text style={styles.exitLabel}>Take Profit %</Text>
              <View style={styles.exitInputWrap}>
                <TextInput style={styles.exitInput} value={takeProfitPct} onChangeText={setTakeProfitPct}
                  placeholder="e.g. 10" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                <Text style={styles.exitUnit}>%</Text>
              </View>
            </View>
            <View style={styles.exitField}>
              <Text style={styles.exitLabel}>Stop Loss %</Text>
              <View style={styles.exitInputWrap}>
                <TextInput style={styles.exitInput} value={stopLossPct} onChangeText={setStopLossPct}
                  placeholder="e.g. 5" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                <Text style={styles.exitUnit}>%</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>{isEditing ? "Update Rule Set" : "Save Rule Set"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  inputLabel:  { ...typography.label, marginBottom: 6 },
  sectionLabel: { ...typography.label, marginTop: 20, marginBottom: 4 },
  sectionHint:  { ...typography.bodySmall, marginBottom: 12 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 14, color: colors.textPrimary, fontSize: 15, marginBottom: 12,
  },
  compareRow: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 14, marginBottom: 12,
  },
  compareLabel: { color: colors.textSecondary, fontFamily: "Inter_600SemiBold", fontSize: 14 },

  termCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, padding: 14, marginBottom: 12,
  },
  termHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sideBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  buyBadge:  { backgroundColor: colors.buy  + "22", borderWidth: 1, borderColor: colors.buy  },
  sellBadge: { backgroundColor: colors.sell + "22", borderWidth: 1, borderColor: colors.sell },
  sideBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: colors.textPrimary },
  removeBtn: { color: colors.danger, fontSize: 14, fontFamily: "Inter_600SemiBold" },

  addBtn: { padding: 14, alignItems: "center", marginBottom: 4 },
  addBtnText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },

  exitCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.sell + "55", padding: 14, marginTop: 8, marginBottom: 12,
  },
  exitCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.sell, marginBottom: 2 },
  exitRow:  { flexDirection: "row", gap: 12, marginTop: 12 },
  exitField: { flex: 1 },
  exitLabel: { ...typography.label, marginBottom: 6 },
  exitInputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, paddingHorizontal: 12,
  },
  exitInput: { flex: 1, paddingVertical: 12, color: colors.textPrimary, fontSize: 15 },
  exitUnit:  { color: colors.textSecondary, fontFamily: "Inter_700Bold", fontSize: 15 },

  saveBtn: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginTop: 12,
  },
  saveBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
