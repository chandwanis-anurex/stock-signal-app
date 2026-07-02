import React from "react";
import { View, Text, ScrollView, StyleSheet, Linking, TouchableOpacity } from "react-native";
import Constants from "expo-constants";
import Logo from "../components/Logo";
import { colors, typography, layout } from "../theme";

const version = Constants.expoConfig?.version ?? "1.0.0";
const buildProfile = Constants.expoConfig?.extra?.eas?.projectId ? "preview" : "development";

const SECTIONS = [
  {
    title: "Watchlists",
    icon: "📋",
    steps: [
      "Tap Watchlists → New Watchlist",
      "Build screener criteria (RSI, Market Cap, Volume, etc.) or add symbols manually",
      "Preview match count before saving",
      "Watchlist auto-refreshes on a schedule",
      "Keep as many watchlists as you like — each one is independent",
    ],
  },
  {
    title: "Rules",
    icon: "⚡",
    steps: [
      "Tap Rules → New Rule Set",
      "Define BUY conditions (e.g. RSI < 30)",
      "Define SELL conditions (e.g. RSI > 70)",
      "Optionally add Take Profit % / Stop Loss % targets",
      "Rule sets are independent — build once, reuse on any watchlist",
    ],
  },
  {
    title: "Linking & Signals",
    icon: "🔗",
    steps: [
      "Open a watchlist → Edit Watchlist → Assigned Rule",
      "Choose a rule set to attach to that watchlist",
      "Start the rule to begin evaluating signals",
      "Signals fire when all conditions are true — view them in the Signals tab",
    ],
  },
  {
    title: "Alert Channels",
    icon: "🔔",
    steps: [
      "Open a watchlist → Alert Channels section → + Add",
      "Choose Email, SMS/WhatsApp, Webhook or Push Notification",
      "Push registers this device automatically — no token to enter",
      "Alerts are sent automatically when signals fire",
    ],
  },
  {
    title: "Trade Size (Webhook Orders)",
    icon: "💵",
    steps: [
      "Open a watchlist → Edit Watchlist → Trade Size (Buy Orders)",
      "Default: Dollar Amount, $1,000 per trade",
      "Switch to Number of Shares if you'd rather size by share count",
      "Applies to BUY signals only — sent as \"quantity\" in the webhook JSON so your trading platform knows how much to buy",
      "SELL signals don't need a size — they close the full existing position",
    ],
  },
  {
    title: "Analytics",
    icon: "📊",
    steps: [
      "Go to the Analytics tab",
      "Select any rule to see its performance",
      "Total signals, win rate and avg return shown",
      "Win rate data populates as signals close",
    ],
  },
];

export default function HelpScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.aboutCard}>
        <Logo size={72} />
        <Text style={styles.appName}>SignalFlow</Text>
        <Text style={styles.tagline}>Algorithmic stock alerts, simplified</Text>
        <View style={styles.versionRow}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version {version}</Text>
          </View>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>{buildProfile}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionHeader}>How to use SignalFlow</Text>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>{s.icon}</Text>
            <Text style={styles.cardTitle}>{s.title}</Text>
          </View>
          {s.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>ℹ️</Text>
          <Text style={styles.cardTitle}>Technical Info</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>App Name</Text>
          <Text style={styles.infoValue}>SignalFlow</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>{version}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Build</Text>
          <Text style={styles.infoValue}>{buildProfile}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Market Data</Text>
          <Text style={styles.infoValue}>Alpaca Paper Trading</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Screener</Text>
          <Text style={styles.infoValue}>TradingView</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Alerts</Text>
          <Text style={styles.infoValue}>SendGrid + Twilio</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: layout.screenPadding, paddingBottom: 40 },

  aboutCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    padding: 24, alignItems: "center", marginBottom: 24, gap: 8,
  },
  appName: { fontSize: 24, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary, marginTop: 4 },
  tagline: { ...typography.bodySmall, textAlign: "center" },
  versionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  versionBadge: {
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4,
  },
  versionText: { color: colors.accent, fontSize: 12, fontFamily: "Inter_700Bold" },

  sectionHeader: { ...typography.label, marginBottom: 12 },

  card: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  cardIcon: { fontSize: 20 },
  cardTitle: { ...typography.heading3 },

  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.accent,
    textAlign: "center", lineHeight: 22, fontSize: 11, fontFamily: "Inter_700Bold", color: colors.accent,
  },
  stepText: { ...typography.bodySmall, flex: 1, lineHeight: 20 },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.bodySmall },
  infoValue: { ...typography.body, fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
