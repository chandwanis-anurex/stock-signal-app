import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("WatchlistDetail", { watchlistId: item.id, name: item.name })}
            onLongPress={() => confirmDelete(item)}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSub}>
              Last run: {item.last_run_at ? new Date(item.last_run_at).toLocaleString() : "never"}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No watchlists yet. Create one below.</Text>}
      />
      <TouchableOpacity style={styles.newButton} onPress={() => navigation.navigate("CriteriaBuilder")}>
        <Text style={styles.newButtonText}>+ New Watchlist</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSub: { fontSize: 13, color: "#777", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 40, color: "#999" },
  newButton: { backgroundColor: "#1a73e8", padding: 16, alignItems: "center" },
  newButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
