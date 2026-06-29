import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { api } from "../api/client";

const INDICATORS = ["RSI", "SMA", "EMA", "MACD", "MACD_SIGNAL", "VOLUME", "VOLUME_SMA", "CLOSE"];
const OPERATORS = ["gt", "gte", "lt", "lte", "crosses_above", "crosses_below"];

function TermRow({ term, onChange }) {
  return (
    <View style={styles.termRow}>
      <TextInput
        style={styles.termField}
        value={term.indicator}
        onChangeText={(v) => onChange({ ...term, indicator: v })}
        placeholder="indicator"
      />
      <TextInput
        style={styles.termField}
        value={String(term.params?.period ?? "")}
        onChangeText={(v) => onChange({ ...term, params: { period: Number(v) || undefined } })}
        placeholder="period"
        keyboardType="numeric"
      />
      <TextInput
        style={styles.termField}
        value={term.operator}
        onChangeText={(v) => onChange({ ...term, operator: v })}
        placeholder="op"
      />
      <TextInput
        style={styles.termField}
        value={String(term.value)}
        onChangeText={(v) => onChange({ ...term, value: v })}
        placeholder="value"
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

  const save = async () => {
    if (!name.trim()) {
      Alert.alert("Name required");
      return;
    }
    try {
      const buyCondition = { logic: "and", terms: buyTerms.map((t) => ({ ...t, value: isNaN(t.value) ? t.value : Number(t.value) })) };
      const sellCondition = { logic: "and", terms: sellTerms.map((t) => ({ ...t, value: isNaN(t.value) ? t.value : Number(t.value) })) };
      const rule = await api.createRule(watchlistId, name, buyCondition, sellCondition);
      navigation.replace("AlertChannels", { watchlistId, ruleId: rule.id, ruleName: rule.name });
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Rule name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. RSI mean reversion" />

      <Text style={styles.sectionTitle}>BUY when all are true</Text>
      {buyTerms.map((t, i) => (
        <TermRow key={i} term={t} onChange={(updated) => updateTerm(buyTerms, setBuyTerms, i, updated)} />
      ))}
      <TouchableOpacity onPress={() => setBuyTerms([...buyTerms, { indicator: "MACD", operator: "crosses_above", value: "0" }])}>
        <Text style={styles.addLink}>+ Add buy condition</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>SELL when all are true</Text>
      {sellTerms.map((t, i) => (
        <TermRow key={i} term={t} onChange={(updated) => updateTerm(sellTerms, setSellTerms, i, updated)} />
      ))}
      <TouchableOpacity onPress={() => setSellTerms([...sellTerms, { indicator: "MACD", operator: "crosses_below", value: "0" }])}>
        <Text style={styles.addLink}>+ Add sell condition</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Indicators: {INDICATORS.join(", ")}. Operators: {OPERATORS.join(", ")}.</Text>

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Rule</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  label: { fontSize: 13, color: "#555", marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  termRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  termField: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8, fontSize: 12 },
  addLink: { color: "#1a73e8", fontWeight: "600", marginTop: 4 },
  hint: { fontSize: 11, color: "#999", marginTop: 16 },
  saveButton: { backgroundColor: "#1a73e8", padding: 16, alignItems: "center", borderRadius: 8, marginVertical: 24 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
