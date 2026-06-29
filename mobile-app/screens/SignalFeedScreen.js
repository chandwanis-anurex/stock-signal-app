import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { api } from "../api/client";

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

  useEffect(() => {
    load();
  }, [load]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.badge, item.side === "buy" ? styles.buyBadge : styles.sellBadge]}>
              <Text style={styles.badgeText}>{item.side.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.sub}>
                ${item.price_at_signal?.toFixed(2)} · {new Date(item.fired_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No signals fired yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  row: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginRight: 12 },
  buyBadge: { backgroundColor: "#e3f7e9" },
  sellBadge: { backgroundColor: "#fde8e8" },
  badgeText: { fontWeight: "700", fontSize: 12 },
  symbol: { fontWeight: "700", fontSize: 15 },
  sub: { color: "#888", fontSize: 12, marginTop: 2 },
  empty: { textAlign: "center", marginTop: 40, color: "#999" },
});
