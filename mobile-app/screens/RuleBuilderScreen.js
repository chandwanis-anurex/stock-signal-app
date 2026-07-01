import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

const NEW_RULE = "__new__";

export default function RuleBuilderScreen({ route, navigation }) {
  const { watchlistId, existingRule } = route.params;
  const isEditing = !!existingRule;

  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(NEW_RULE);

  const [name, setName] = useState(existingRule?.name ?? "");
  const [buyTerms, setBuyTerms] = useState(
    existingRule?.buy_condition?.terms ?? [{ indicator: "RSI", params: { period: 14 }, operator: "lt", value: "30" }]
  );
  const [sellTerms, setSellTerms] = useState(
    existingRule?.sell_condition?.terms ?? [{ indicator: "RSI", params: { period: 14 }, operator: "gt", value: "70" }]
  );
  const [takeProfitPct, setTakeProfitPct] = useState(
    existingRule?.sell_condition?.take_profit_pct != null ? String(existingRule.sell_condition.take_profit_pct) : ""
  );
  const [stopLossPct, setStopLossPct] = useState(
    existingRule?.sell_condition?.stop_loss_pct != null ? String(existingRule.sell_condition.stop_loss_pct) : ""
  );

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? existingRule.name : "New Rule" });
    if (!isEditing) {
      api.listAllRules().then((rules) => {
        setTemplates(rules);
      }).catch(() => {}).finally(() => setLoadingTemplates(false));
    } else {
      setLoadingTemplates(false);
    }
  }, []);

  const applyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    if (templateId === NEW_RULE) {
      setName("");
      setBuyTerms([{ indicator: "RSI", params: { period: 14 }, operator: "lt", value: "30" }]);
      setSellTerms([{ indicator: "RSI", params: { period: 14 }, operator: "gt", value: "70" }]);
      setTakeProfitPct("");
      setStopLossPct("");
      return;
    }
    const rule = templates.find((r) => String(r.id) === templateId);
    if (!rule) return;
    setName(rule.name);
    if (rule.buy_condition?.terms?.length) {
      setBuyTerms(rule.buy_condition.terms.map((t) => ({ ...t, value: String(t.value) })));
    }
    if (rule.sell_condition?.terms?.length) {
      setSellTerms(rule.sell_condition.terms.map((t) => ({ ...t, value: String(t.value) })));
    }
    setTakeProfitPct(rule.sell_condition?.take_profit_pct != null ? String(rule.sell_condition.take_profit_pct) : "");
    setStopLossPct(rule.sell_condition?.stop_loss_pct != null ? String(rule.sell_condition.stop_loss_pct) : "");
  };

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
      const sellCondition = { logic: "and", terms: toNum(sellTerms) };
      if (takeProfitPct !== "") sellCondition.take_profit_pct = parseFloat(takeProfitPct);
      if (stopLossPct !== "") sellCondition.stop_loss_pct = parseFloat(stopLossPct);
      const rule = await api.createRule(
        watchlistId, name,
        { logic: "and", terms: toNum(buyTerms) },
        sellCondition,
      );
      navigation.replace("AlertChannels", { watchlistId, ruleId: rule.id, ruleName: rule.name });
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  const templateOptions = [
    { value: NEW_RULE, label: "— Create new rule set —" },
    ...templates.map((r) => ({ value: String(r.id), label: r.name })),
  ];

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Template picker — only shown when creating a new rule */}
      {!isEditing && (
        <View style={styles.templateCard}>
          <View style={styles.templateHeader}>
            <Ionicons name="copy-outline" size={16} color={colors.accent} />
            <Text style={styles.templateTitle}>Start from an existing rule set</Text>
          </View>
          {loadingTemplates ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 8 }} />
          ) : templates.length === 0 ? (
            <Text style={styles.templateEmpty}>No existing rule sets yet — fill in the form below to create your first.</Text>
          ) : (
            <Dropdown
              label="Rule Set"
              value={selectedTemplate}
              options={templateOptions}
              onChange={applyTemplate}
            />
          )}
        </View>
      )}

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

      <View style={styles.exitCard}>
        <Text style={styles.exitCardTitle}>Exit Targets</Text>
        <Text style={styles.sectionHint}>Auto-sell when price moves this % from entry</Text>
        <View style={styles.exitRow}>
          <View style={styles.exitField}>
            <Text style={styles.exitLabel}>Take Profit %</Text>
            <View style={styles.exitInputWrapper}>
              <TextInput
                style={styles.exitInput}
                value={takeProfitPct}
                onChangeText={setTakeProfitPct}
                placeholder="e.g. 10"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.exitUnit}>%</Text>
            </View>
          </View>
          <View style={styles.exitField}>
            <Text style={styles.exitLabel}>Stop Loss %</Text>
            <View style={styles.exitInputWrapper}>
              <TextInput
                style={styles.exitInput}
                value={stopLossPct}
                onChangeText={setStopLossPct}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.exitUnit}>%</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Rule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },

  templateCard: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.accent + "44",
    padding: 14,
    marginBottom: 20,
  },
  templateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  templateTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.accent },
  templateEmpty: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  inputLabel: { ...typography.label, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 14, color: colors.textPrimary, fontSize: 17, marginBottom: 12,
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
  sideBadgeText: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.textPrimary },
  removeBtn: { color: colors.danger, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  addButton: { padding: 14, alignItems: "center", marginBottom: 4 },
  addButtonText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },
  exitCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.sell + "55", padding: 14, marginBottom: 12,
  },
  exitCardTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: colors.sell, marginBottom: 2 },
  exitRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  exitField: { flex: 1 },
  exitLabel: { ...typography.label, marginBottom: 6 },
  exitInputWrapper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, paddingHorizontal: 12,
  },
  exitInput: { flex: 1, paddingVertical: 12, color: colors.textPrimary, fontSize: 15 },
  exitUnit: { color: colors.textSecondary, fontFamily: "Inter_700Bold", fontSize: 15 },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginVertical: 24,
  },
  saveButtonText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
