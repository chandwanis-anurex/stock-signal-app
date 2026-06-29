import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

export default function ManualWatchlistScreen({ navigation }) {
  const [name, setName] = useState("");
  const [symbolsText, setSymbolsText] = useState("");
  const [saving, setSaving] = useState(false);

  const parsedSymbols = symbolsText
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const save = async () => {
    if (!name.trim()) { Alert.alert("Enter a watchlist name"); return; }
    if (parsedSymbols.length === 0) { Alert.alert("Enter at least one symbol"); return; }
    setSaving(true);
    try {
      await api.createWatchlistManual(name.trim(), parsedSymbols);
      navigation.popToTop();
    } catch (e) {
      Alert.alert("Failed to create watchlist", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Watchlist Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. My Tech Picks"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Symbols</Text>
        <TextInput
          style={[styles.input, styles.symbolsInput]}
          placeholder="AAPL, TSLA, MSFT, NVDA"
          placeholderTextColor={colors.textMuted}
          value={symbolsText}
          onChangeText={setSymbolsText}
          autoCapitalize="characters"
          multiline
        />
        <Text style={styles.hint}>Separate symbols with commas</Text>

        {parsedSymbols.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>{parsedSymbols.length} symbol{parsedSymbols.length !== 1 ? "s" : ""}</Text>
            <View style={styles.chips}>
              {parsedSymbols.map((s) => (
                <View key={s} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? "Creating..." : "Create Watchlist"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  label: { ...typography.label, marginBottom: 6, marginTop: 20 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 12, color: colors.textPrimary, fontSize: 15,
  },
  symbolsInput: { minHeight: 80, textAlignVertical: "top" },
  hint: { ...typography.bodySmall, marginTop: 6 },
  previewBox: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.cardRadius, padding: 14, marginTop: 20,
  },
  previewLabel: { ...typography.bodySmall, marginBottom: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginTop: 28, marginBottom: 40,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#000", fontWeight: "800", fontSize: 16 },
});
