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
          return (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.badge, isBuy ? styles.buyBadge : styles.sellBadge]}>
                  <Text style={[styles.badgeText, { color: isBuy ? colors.buy : colors.sell }]}>
                    {item.side.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                <Text style={styles.ruleName}>{item.rule_name || "—"}</Text>
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
  },
  cardLeft: { marginRight: 12 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1,
  },
  buyBadge: { backgroundColor: colors.buy + "18", borderColor: colors.buy },
  sellBadge: { backgroundColor: colors.sell + "18", borderColor: colors.sell },
  badgeText: { fontSize: 11, fontWeight: "800" },
  cardBody: { flex: 1 },
  symbol: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  ruleName: { ...typography.bodySmall, marginTop: 2 },
  cardRight: { alignItems: "flex-end" },
  price: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { ...typography.heading3, marginBottom: 8 },
  emptySub: { ...typography.bodySmall, textAlign: "center", lineHeight: 20 },
});
