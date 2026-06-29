import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView, TextInput,
} from "react-native";
import { colors, typography, layout } from "../theme";

export default function Dropdown({ label, value, options, onChange, placeholder = "Select..." }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => { setOpen(true); setSearch(""); }}>
        <Text style={styles.triggerLabel}>{label}</Text>
        <View style={styles.triggerRow}>
          <Text style={selected ? styles.triggerValue : styles.triggerPlaceholder}>
            {selected ? selected.label : placeholder}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.search}
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.option, item.value === value && styles.optionSelected]}
                onPress={() => { onChange(item.value); setOpen(false); }}
              >
                <Text style={styles.optionLabel}>{item.label}</Text>
                {item.value === value && <Text style={styles.optionCheck}>✓</Text>}
              </TouchableOpacity>
            )}
            keyboardShouldPersistTaps="handled"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.inputBg,
    borderRadius: layout.inputRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 12,
  },
  triggerLabel: { ...typography.label, marginBottom: 4 },
  triggerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  triggerValue: { ...typography.body },
  triggerPlaceholder: { ...typography.body, color: colors.textMuted },
  chevron: { color: colors.textSecondary, fontSize: 16 },
  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.heading3 },
  modalClose: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  search: {
    margin: 12, padding: 12, backgroundColor: colors.inputBg,
    borderRadius: layout.inputRadius, color: colors.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: colors.border,
  },
  option: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.accentDim },
  optionLabel: { ...typography.body },
  optionCheck: { color: colors.accent, fontSize: 16, fontWeight: "700" },
});
