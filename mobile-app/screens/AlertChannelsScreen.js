import React, { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

const CHANNELS = [
  { type: "sms", label: "WhatsApp", icon: "💬", placeholder: "+17325265699" },
  { type: "email", label: "Email", icon: "✉️", placeholder: "you@example.com" },
  { type: "push", label: "Push Notification", icon: "🔔", placeholder: "" },
  { type: "webhook", label: "Webhook", icon: "🔗", placeholder: "https://your-relay.example.com/hook" },
];

export default function AlertChannelsScreen({ route, navigation }) {
  const { watchlistId, ruleId, ruleName } = route.params;
  const [destinations, setDestinations] = useState({});
  const [enabled, setEnabled] = useState({});
  const [existingIds, setExistingIds] = useState({});

  useFocusEffect(useCallback(() => {
    api.listAlertChannels(watchlistId, ruleId).then((channels) => {
      const dest = {}, en = {}, ids = {};
      channels.forEach((c) => {
        dest[c.channel_type] = c.destination;
        en[c.channel_type] = c.active;
        ids[c.channel_type] = c.id;
      });
      setDestinations(dest);
      setEnabled(en);
      setExistingIds(ids);
    }).catch(console.warn);
  }, [watchlistId, ruleId]));

  const registerForPush = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Push permission denied"); return; }
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: "704b6240-b34b-43ee-a76e-2be8ddade1e9",
      })).data;
      setDestinations((d) => ({ ...d, push: token }));
      setEnabled((e) => ({ ...e, push: true }));
    } catch (e) {
      Alert.alert("Push setup failed", e.message);
    }
  };

  const toggle = (type) => {
    if (type === "push" && !destinations.push) { registerForPush(); return; }
    setEnabled((e) => ({ ...e, [type]: !e[type] }));
  };

  const save = async () => {
    try {
      const jobs = CHANNELS
        .filter((c) => enabled[c.type] && destinations[c.type] && !existingIds[c.type])
        .map((c) => api.addAlertChannel(watchlistId, ruleId, c.type, destinations[c.type]));
      await Promise.all(jobs);
      Alert.alert("Saved", "Alert channels configured.");
      navigation.popToTop();
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{ruleName}</Text>
      <Text style={styles.subtitle}>Choose where to receive alerts for this rule.</Text>

      {CHANNELS.map((c) => (
        <View key={c.type} style={styles.channelCard}>
          <View style={styles.channelHeader}>
            <View style={styles.channelLeft}>
              <Text style={styles.channelIcon}>{c.icon}</Text>
              <Text style={styles.channelLabel}>{c.label}</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, enabled[c.type] ? styles.toggleOn : styles.toggleOff]}
              onPress={() => toggle(c.type)}
            >
              <Text style={[styles.toggleText, enabled[c.type] ? styles.toggleTextOn : styles.toggleTextOff]}>
                {enabled[c.type] ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>
          {c.type !== "push" && enabled[c.type] && (
            <TextInput
              style={styles.input}
              placeholder={c.placeholder}
              placeholderTextColor={colors.textMuted}
              value={destinations[c.type] || ""}
              onChangeText={(v) => setDestinations((d) => ({ ...d, [c.type]: v }))}
              autoCapitalize="none"
            />
          )}
          {c.type === "push" && enabled.push && (
            <Text style={styles.pushHint}>Device registered for push alerts.</Text>
          )}
        </View>
      ))}

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Alert Channels</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },
  title: { ...typography.heading2, marginBottom: 4 },
  subtitle: { ...typography.bodySmall, marginBottom: 20 },
  channelCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12,
  },
  channelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  channelLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  channelIcon: { fontSize: 20 },
  channelLabel: { ...typography.heading3 },
  toggle: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  toggleOn: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  toggleOff: { backgroundColor: colors.border, borderColor: colors.border },
  toggleText: { fontSize: 12, fontWeight: "700" },
  toggleTextOn: { color: colors.accent },
  toggleTextOff: { color: colors.textSecondary },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 12, color: colors.textPrimary,
    fontSize: 14, marginTop: 12,
  },
  pushHint: { ...typography.bodySmall, marginTop: 10 },
  saveButton: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginVertical: 24,
  },
  saveButtonText: { color: "#000", fontWeight: "800", fontSize: 16 },
});
