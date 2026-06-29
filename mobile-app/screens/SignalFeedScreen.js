import React, { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

export default function SignalFeedScreen() {
  const [signals, setSignals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listSignals();
      setSignals(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={signals}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => {
          const isBuy = item.side === "buy";
          const companyName = item.company_name || "";
          return (
            <View style={styles.card}>
              <View style={[styles.badge, isBuy ? styles.buyBadge : styles.sellBadge]}>
                <Text style={styles.badgeText}>{isBuy ? "BUY" : "SELL"}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                {companyName ? (
                  <Text style={styles.companyName}>{companyName}</Text>
                ) : null}
                {item.rule_name ? (
                  <Text style={styles.ruleName}>{item.rule_name}</Text>
                ) : null}
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.price}>${item.price_at_signal?.toFixed(2) ?? "—"}</Text>
                <Text style={styles.time}>{new Date(item.fired_at).toLocaleDateString()}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyTitle}>No signals yet</Text>
            <Text style={styles.emptySub}>Signals fire when your rules match stocks in your watchlists.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  badgeText: { color: "#ffffff", fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  cardBody: { flex: 1 },
  symbol: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  companyName: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  ruleName: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  cardRight: { alignItems: "flex-end" },
  price: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { ...typography.heading3, marginBottom: 8 },
  emptySub: { ...typography.bodySmall, textAlign: "center", lineHeight: 20 },
});
