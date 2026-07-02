import React, { useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Animated, Alert } from "react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useSignalsQuery, useDeleteSignalMutation, useHaltAllWatchlistsMutation } from "../api/queries";
import { colors, typography, layout } from "../theme";
import { getCompanyName } from "../data/companyNames";

export default function SignalFeedScreen({ navigation }) {
  const { data: signals = [], refetch } = useSignalsQuery();
  const deleteMutation = useDeleteSignalMutation();
  const haltAllMutation = useHaltAllWatchlistsMutation();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const deleteSignal = (id) => {
    deleteMutation.mutate(id, { onError: (e) => console.warn(e) });
  };

  const renderRightActions = (id) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => deleteSignal(id)}>
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  const haltAll = () => {
    Alert.alert(
      "Halt All Trading Alerts",
      "This will stop ALL active rules on ALL watchlists. You will need to restart each watchlist individually. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Halt All", style: "destructive", onPress: () => {
          haltAllMutation.mutate(undefined, {
            onSuccess: (res) => Alert.alert("Done", `${res.halted} watchlist${res.halted !== 1 ? "s" : ""} halted. Go to Watchlists to restart them.`),
            onError: (e) => Alert.alert("Error", e.message),
          });
        }},
      ]
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <TouchableOpacity style={styles.haltBtn} onPress={haltAll}>
        <Ionicons name="stop-circle" size={18} color="#fff" />
        <Text style={styles.haltBtnText}>Halt All Trading Alerts</Text>
      </TouchableOpacity>
      <FlatList
        data={signals}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => {
          const isBuy = item.side === "buy";
          const companyName = item.company_name || getCompanyName(item.symbol);
          const firedAt = new Date(item.fired_at);
          const dateStr = firedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
          const timeStr = firedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const hasPl = item.pl_pct !== null && item.pl_pct !== undefined;
          const inProfit = hasPl && item.pl_pct >= 0;
          return (
            <Swipeable renderRightActions={() => renderRightActions(item.id)} overshootRight={false}>
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate("SignalDetail", { signalId: item.id })}
              >
                <View style={[styles.badge, isBuy ? styles.buyBadge : styles.sellBadge]}>
                  <Text style={styles.badgeText}>{isBuy ? "BUY" : "SELL"}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  {companyName ? <Text style={styles.companyName}>{companyName}</Text> : null}
                  {item.rule_name ? <Text style={styles.ruleName}>{item.rule_name}</Text> : null}
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.price}>${item.price_at_signal?.toFixed(2) ?? "—"}</Text>
                  <Text style={styles.time}>{dateStr}</Text>
                  <Text style={styles.time}>{timeStr}</Text>
                  {hasPl && (
                    <View style={[styles.plBand, inProfit ? styles.plBandProfit : styles.plBandLoss]}>
                      <Text style={styles.plBandText}>
                        {inProfit ? "+" : ""}{item.pl_pct.toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No signals yet</Text>
            <Text style={styles.emptySub}>
              Activate a rule on a watchlist to start receiving trade alerts here.
              {"\n\n"}Go to Watchlists → tap a watchlist → press Start to begin.
            </Text>
          </View>
        }
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  haltBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.sell, margin: 16, marginBottom: 8,
    padding: 14, borderRadius: layout.buttonRadius,
  },
  haltBtnText: { color: "#fff", fontFamily: "Inter_800ExtraBold", fontSize: 15 },
  list: { padding: layout.screenPadding },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    width: 64,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBadge: { backgroundColor: colors.buy },
  sellBadge: { backgroundColor: colors.sell },
  badgeText: { color: "#ffffff", fontSize: 14, fontFamily: "Inter_800ExtraBold", letterSpacing: 0.5 },
  cardBody: { flex: 1 },
  symbol: { fontSize: 17, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary },
  companyName: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  ruleName: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  cardRight: { alignItems: "flex-end" },
  price: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  plBand: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 5 },
  plBandProfit: { backgroundColor: colors.buy },
  plBandLoss: { backgroundColor: colors.sell },
  plBandText: { color: "#ffffff", fontSize: 12, fontFamily: "Inter_700Bold" },
  deleteAction: {
    backgroundColor: colors.sell, justifyContent: "center",
    alignItems: "center", width: 80, borderRadius: layout.cardRadius,
    marginBottom: 10,
  },
  deleteActionText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { ...typography.heading3, marginBottom: 8 },
  emptySub: { ...typography.bodySmall, textAlign: "center", lineHeight: 20 },
});
