import React from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, layout } from "../theme";
import Logo from "../components/Logo";

const { width } = Dimensions.get("window");

const STEPS = [
  {
    number: "1",
    icon: "funnel",
    title: "Build Watchlists",
    subtitle: "Independent & Reusable",
    description:
      "Create a watchlist by setting screener criteria (Market Cap, Volume, RSI, MACD and more) or by typing symbols in manually. Each watchlist refreshes automatically on a schedule, and you can keep as many as you like — they're managed independently of rules, so you can build one now and attach a rule set whenever you're ready.",
    color: colors.accent,
    tags: ["Screener Criteria", "Manual Symbols", "Auto-Refresh", "Multiple Watchlists"],
  },
  {
    number: "2",
    icon: "git-branch",
    title: "Define Rules",
    subtitle: "Set Buy & Sell Conditions",
    description:
      "Create a rule set using technical indicators — RSI crosses below 30 for a buy, MACD crossover for a sell — then assign it to any watchlist to start generating signals. Add Take Profit % and Stop Loss % targets per rule.",
    color: "#a78bfa",
    tags: ["RSI", "Stochastic", "Williams %R", "MACD Crossover"],
  },
  {
    number: "3",
    icon: "notifications",
    title: "Get Alerts",
    subtitle: "Real-Time Notifications",
    description:
      "The moment a rule triggers on any symbol in your watchlist, SignalFlow fires an alert — via webhook (TradersPost), email, SMS or push notification.",
    color: colors.buy,
    tags: ["Webhook", "Email", "SMS", "Push"],
  },
  {
    number: "4",
    icon: "bar-chart",
    title: "Track Performance",
    subtitle: "Measure & Refine",
    description:
      "Monitor every signal's outcome with 1-day, 1-week and 1-month performance checkpoints. Use analytics to refine your rules and improve over time.",
    color: "#38bdf8",
    tags: ["Daily", "Weekly", "Monthly", "Win Rate"],
  },
];

export default function OnboardingScreen({ onDone }) {
  const handleStart = async () => {
    await AsyncStorage.setItem("sf_onboarded", "1");
    onDone();
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Logo size={52} />
          <Text style={styles.appName}>SignalFlow</Text>
          <Text style={styles.tagline}>How it works — four steps to automated stock alerts</Text>
        </View>

        {/* Steps */}
        {STEPS.map((step, i) => (
          <View key={i}>
            {/* Step card */}
            <View style={styles.stepCard}>
              {/* Left: number + icon */}
              <View style={styles.stepLeft}>
                <View style={[styles.numberBadge, { backgroundColor: step.color + "22", borderColor: step.color + "66" }]}>
                  <Text style={[styles.numberText, { color: step.color }]}>{step.number}</Text>
                </View>
                <View style={[styles.iconCircle, { backgroundColor: step.color + "18" }]}>
                  <Ionicons name={step.icon} size={26} color={step.color} />
                </View>
              </View>

              {/* Right: content */}
              <View style={styles.stepContent}>
                <Text style={[styles.stepSubtitle, { color: step.color }]}>{step.subtitle}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.description}</Text>
                <View style={styles.tagRow}>
                  {step.tags.map(t => (
                    <View key={t} style={[styles.tag, { borderColor: step.color + "44" }]}>
                      <Text style={[styles.tagText, { color: step.color }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Connector arrow between steps */}
            {i < STEPS.length - 1 && (
              <View style={styles.connector}>
                <View style={styles.connectorLine} />
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            )}
          </View>
        ))}

        {/* CTA */}
        <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <Text style={styles.hint}>You can revisit this guide anytime from the Account tab</Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20 },

  header: { alignItems: "center", paddingVertical: 32, gap: 10 },
  appName: { fontSize: 30, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },

  stepCard: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    flexDirection: "row",
    gap: 16,
  },

  stepLeft: { alignItems: "center", gap: 10, paddingTop: 2 },
  numberBadge: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  numberText: { fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  iconCircle: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },

  stepContent: { flex: 1 },
  stepSubtitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 },
  stepTitle: { fontSize: 18, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary, marginBottom: 8 },
  stepDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginBottom: 12 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  connector: { alignItems: "center", paddingVertical: 6 },
  connectorLine: { width: 1, height: 10, backgroundColor: colors.border, marginBottom: 2 },

  startBtn: {
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: layout.buttonRadius,
    marginTop: 28,
    marginBottom: 14,
  },
  startBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 17 },
  hint: { textAlign: "center", fontSize: 12, color: colors.textMuted },
});
