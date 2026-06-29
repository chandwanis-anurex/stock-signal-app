import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import * as Notifications from "expo-notifications";
import { api } from "../api/client";

const CHANNELS = [
  { type: "sms", label: "WhatsApp", placeholder: "+17325265699" },
  { type: "email", label: "Email", placeholder: "you@example.com" },
  { type: "push", label: "Push notification (this device)", placeholder: "auto-filled from device token" },
  { type: "webhook", label: "Webhook (broker/automation URL)", placeholder: "https://your-broker-relay.example.com/hook" },
];

export default function AlertChannelsScreen({ route, navigation }) {
  const { watchlistId, ruleId, ruleName } = route.params;
  const [destinations, setDestinations] = useState({});
  const [enabled, setEnabled] = useState({});

  const registerForPush = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Push permission denied");
      return;
    }
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: "stock-signal-app",  // matches app.json slug — replace with EAS projectId when publishing
    })).data;
    setDestinations((d) => ({ ...d, push: token }));
    setEnabled((e) => ({ ...e, push: true }));
  };

  const toggle = (type) => {
    if (type === "push" && !destinations.push) {
      registerForPush();
      return;
    }
    setEnabled((e) => ({ ...e, [type]: !e[type] }));
  };

  const save = async () => {
    try {
      const jobs = CHANNELS.filter((c) => enabled[c.type] && destinations[c.type]).map((c) =>
        api.addAlertChannel(watchlistId, ruleId, c.type, destinations[c.type])
      );
      await Promise.all(jobs);
      Alert.alert("Saved", "Alert channels configured for this rule.");
      navigation.popToTop();
    } catch (e) {
      Alert.alert("Save failed", e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{ruleName}</Text>
      <Text style={styles.subtitle}>Choose where to send buy/sell alerts for this rule.</Text>

      {CHANNELS.map((c) => (
        <View key={c.type} style={styles.channelBlock}>
          <View style={styles.channelHeader}>
            <Text style={styles.channelLabel}>{c.label}</Text>
            <TouchableOpacity onPress={() => toggle(c.type)}>
              <Text style={enabled[c.type] ? styles.toggleOn : styles.toggleOff}>
                {enabled[c.type] ? "ON" : "OFF"}
              </Text>
            </TouchableOpacity>
          </View>
          {c.type !== "push" && enabled[c.type] && (
            <TextInput
              style={styles.input}
              placeholder={c.placeholder}
              value={destinations[c.type] || ""}
              onChangeText={(v) => setDestinations((d) => ({ ...d, [c.type]: v }))}
              autoCapitalize="none"
            />
          )}
          {c.type === "push" && enabled.push && (
            <Text style={styles.hint}>Device registered for push alerts.</Text>
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
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#777", marginBottom: 16 },
  channelBlock: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#eee", paddingBottom: 12 },
  channelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  channelLabel: { fontSize: 15, fontWeight: "600" },
  toggleOn: { color: "#1a9e4f", fontWeight: "700" },
  toggleOff: { color: "#999", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, marginTop: 8 },
  hint: { fontSize: 12, color: "#999", marginTop: 6 },
  saveButton: { backgroundColor: "#1a73e8", padding: 16, alignItems: "center", borderRadius: 8, marginVertical: 24 },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
