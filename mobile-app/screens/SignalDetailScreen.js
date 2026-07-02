import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSignalQuery, useSellSignalMutation } from "../api/queries";
import { colors, typography, layout } from "../theme";
import { getCompanyName } from "../data/companyNames";

function fmtPrice(v) {
  return v === null || v === undefined ? "—" : `$${v.toFixed(2)}`;
}

function fmtPl(abs, pct) {
  if (abs === null || abs === undefined || pct === null || pct === undefined) return null;
  const sign = abs >= 0 ? "+" : "";
  return `${sign}$${abs.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
}

function PriceRow({ label, value, plColor }) {
  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text style={[styles.priceValue, plColor ? { color: plColor } : null]}>{value}</Text>
    </View>
  );
}

export default function SignalDetailScreen({ route, navigation }) {
  const { signalId } = route.params;
  const { data: signal } = useSignalQuery(signalId);
  const sellMutation = useSellSignalMutation();

  useEffect(() => {
    navigation.setOptions({ title: signal?.symbol ?? "Signal" });
  }, [signal?.symbol]);

  if (!signal) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  }

  const isBuy = signal.side === "buy";
  const companyName = signal.company_name || getCompanyName(signal.symbol);
  const firedAt = new Date(signal.fired_at);
  const dateStr = firedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeStr = firedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const plText = fmtPl(signal.pl_abs, signal.pl_pct);
  const plColor = signal.pl_abs > 0 ? colors.buy : signal.pl_abs < 0 ? colors.sell : null;

  const handleSellNow = () => {
    Alert.alert(
      "Sell Now",
      `Trigger a sell alert for ${signal.symbol} at the current market price? This closes the position immediately, regardless of the rule's sell condition.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sell Now", style: "destructive", onPress: () => {
          sellMutation.mutate(signal.id, {
            onSuccess: (result) => {
              if (result.dispatched_channels === 0) {
                Alert.alert(
                  "Position Closed",
                  "The position was closed, but no alert channels are configured for this watchlist, so no alert was actually sent."
                );
              } else {
                Alert.alert("Sell Triggered", `Sell alert sent to ${result.dispatched_channels} channel${result.dispatched_channels !== 1 ? "s" : ""}.`);
              }
            },
            onError: (e) => Alert.alert("Sell failed", e.message),
          });
        }},
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <View style={[styles.badge, isBuy ? styles.buyBadge : styles.sellBadge]}>
            <Text style={styles.badgeText}>{isBuy ? "BUY" : "SELL"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.symbol}>{signal.symbol}</Text>
            {companyName ? <Text style={styles.companyName}>{companyName}</Text> : null}
          </View>
          {isBuy && (
            <View style={[styles.statusBadge, signal.is_open ? styles.statusOpen : styles.statusClosed]}>
              <Text style={styles.statusText}>{signal.is_open ? "OPEN" : "CLOSED"}</Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="git-branch-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{signal.rule_name || "No rule"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{dateStr} · {timeStr}</Text>
        </View>
        {signal.is_manual && (
          <View style={styles.metaRow}>
            <Ionicons name="hand-left-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>Manually triggered</Text>
          </View>
        )}

        <View style={styles.priceCard}>
          <PriceRow label="Entry Price" value={fmtPrice(signal.entry_price)} />
          {isBuy && signal.is_open ? (
            <PriceRow label="Current Price" value={fmtPrice(signal.current_price)} />
          ) : (
            <PriceRow label="Exit Price" value={fmtPrice(signal.exit_price)} />
          )}
          {plText && (
            <>
              <View style={styles.divider} />
              <PriceRow label={isBuy && signal.is_open ? "Unrealized P/L" : "P/L"} value={plText} plColor={plColor} />
            </>
          )}
        </View>
      </ScrollView>

      {isBuy && signal.is_open && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.sellBtn} onPress={handleSellNow} disabled={sellMutation.isPending}>
            <Text style={styles.sellBtnText}>{sellMutation.isPending ? "Selling..." : "Sell Now"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: layout.screenPadding, paddingBottom: 48 },

  headerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16,
  },
  badge: { width: 64, paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  buyBadge: { backgroundColor: colors.buy },
  sellBadge: { backgroundColor: colors.sell },
  badgeText: { color: "#ffffff", fontSize: 14, fontFamily: "Inter_800ExtraBold", letterSpacing: 0.5 },
  symbol: { fontSize: 20, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary },
  companyName: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusOpen: { backgroundColor: colors.buy + "22", borderWidth: 1, borderColor: colors.buy },
  statusClosed: { backgroundColor: colors.textMuted + "22", borderWidth: 1, borderColor: colors.textMuted },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold", color: colors.textPrimary },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  metaText: { fontSize: 13, color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },

  priceCard: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 12,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  priceLabel: { ...typography.label },
  priceValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },

  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  sellBtn: {
    backgroundColor: colors.sell, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius,
  },
  sellBtnText: { color: "#fff", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
