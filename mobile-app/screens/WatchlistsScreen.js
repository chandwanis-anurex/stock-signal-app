import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

export default function WatchlistsScreen({ navigation }) {
  const [watchlists, setWatchlists] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listWatchlists();
      setWatchlists(data);
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

  const confirmDelete = (item) => {
    Alert.alert(
      "Delete Watchlist",
      `Delete "${item.name}"? This will also remove its rules and signals.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteWatchlist(item.id);
              setWatchlists((prev) => prev.filter((w) => w.id !== item.id));
            } catch (e) {
              Alert.alert("Delete failed", e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={watchlists}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("WatchlistDetail", { watchlistId: item.id, name: item.name })}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardArrow}>›</Text>
            </View>
            <Text style={styles.cardSub}>
              Last run: {item.last_run_at ? new Date(item.last_run_at).toLocaleString() : "never"}
            </Text>
            <Text style={styles.cardHint}>Long-press to delete</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No watchlists yet</Text>
            <Text style={styles.emptySub}>Tap below to create your first screener-based watchlist.</Text>
          </View>
        }
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.newButton, styles.newButtonHalf]}
          onPress={() => Alert.alert(
            "Create Watchlist",
            "How do you want to add symbols?",
            [
              { text: "Use Screener", onPress: () => navigation.navigate("CriteriaBuilder") },
              { text: "Enter Symbols", onPress: () => navigation.navigate("ManualWatchlist") },
              { text: "Cancel", style: "cancel" },
            ]
          )}
        >
          <Text style={styles.newButtonText}>+ New Watchlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: layout.screenPadding, paddingBottom: 8 },

  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { ...typography.heading3 },
  cardArrow: { fontSize: 22, color: colors.textSecondary },
  cardSub: { ...typography.bodySmall, marginTop: 6 },
  cardHint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },

  emptyState: { alignItems: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyTitle: { ...typography.heading3, marginBottom: 8 },
  emptySub: { ...typography.bodySmall, textAlign: "center", lineHeight: 20 },

  buttonRow: { flexDirection: "row", margin: 16, gap: 10 },
  newButton: {
    backgroundColor: colors.accent,
    padding: 16,
    alignItems: "center",
    borderRadius: layout.buttonRadius,
    flex: 1,
  },
  newButtonHalf: { flex: 1 },
  newButtonText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
