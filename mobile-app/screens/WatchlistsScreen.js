import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

const MAX = 25;

function StatusIcon({ ruleId, ruleActive }) {
  if (!ruleId) {
    return <Ionicons name="stop" size={22} color={colors.textMuted} />;
  }
  if (ruleActive) {
    return <Ionicons name="play-circle" size={24} color={colors.buy} />;
  }
  return <Ionicons name="stop-circle" size={24} color={colors.sell} />;
}

export default function WatchlistsScreen({ navigation }) {
  const [watchlists, setWatchlists] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setWatchlists(await api.listWatchlists());
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const confirmDelete = (item) => {
    Alert.alert(
      "Delete Watchlist",
      `Delete "${item.name}"? This also removes its symbols and alert settings.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.deleteWatchlist(item.id);
            setWatchlists(prev => prev.filter(w => w.id !== item.id));
          } catch (e) {
            Alert.alert("Delete failed", e.message);
          }
        }},
      ]
    );
  };

  const addManual = () => {
    if (watchlists.length >= MAX) {
      Alert.alert("Limit reached", `You can have at most ${MAX} watchlists.`);
      return;
    }
    navigation.navigate("ManualWatchlist");
  };

  const openScreener = () => {
    if (watchlists.length >= MAX) {
      Alert.alert("Limit reached", `You can have at most ${MAX} watchlists.`);
      return;
    }
    navigation.navigate("Screener");
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={watchlists}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("WatchlistDetail", { watchlistId: item.id })}
            onLongPress={() => confirmDelete(item)}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.rule_name
                ? <Text style={styles.cardRule}>{item.rule_name}</Text>
                : <Text style={styles.cardNoRule}>No rule attached</Text>
              }
              <Text style={styles.cardSub}>
                Last run: {item.last_run_at ? new Date(item.last_run_at).toLocaleDateString() : "never"}
              </Text>
            </View>
            <StatusIcon ruleId={item.rule_id} ruleActive={item.rule_active} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={52} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No watchlists yet</Text>
            <Text style={styles.emptySub}>
              Use the Stock Screener to build a watchlist from criteria, or add symbols manually.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openScreener}>
              <Text style={styles.emptyBtnText}>Open Stock Screener</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Status legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Ionicons name="play-circle" size={14} color={colors.buy} />
          <Text style={styles.legendText}>Running</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="stop-circle" size={14} color={colors.sell} />
          <Text style={styles.legendText}>Stopped</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="stop" size={14} color={colors.textMuted} />
          <Text style={styles.legendText}>No rule</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.footerBtn, styles.screenerBtn]} onPress={openScreener}>
          <Ionicons name="funnel" size={16} color={colors.accent} />
          <Text style={styles.screenerBtnText}>Screener</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.footerBtn, styles.manualBtn]} onPress={addManual}>
          <Text style={styles.manualBtnText}>+ Add Watchlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: layout.screenPadding, paddingBottom: 8 },

  card: {
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
  },
  cardBody: { flex: 1 },
  cardTitle:  { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.textPrimary, marginBottom: 2 },
  cardRule:   { fontSize: 12, color: colors.accent,       fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cardNoRule: { fontSize: 12, color: colors.textMuted,    fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cardSub:    { fontSize: 11, color: colors.textMuted },

  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { ...typography.heading3 },
  emptySub: { ...typography.bodySmall, textAlign: "center", lineHeight: 20 },
  emptyBtn: { borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  emptyBtnText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 14 },

  legend: {
    flexDirection: "row", justifyContent: "center", gap: 20,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendText: { fontSize: 11, color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },

  footer: { flexDirection: "row", padding: 16, gap: 10 },
  footerBtn: { flex: 1, padding: 15, alignItems: "center", borderRadius: layout.buttonRadius },
  screenerBtn: { borderWidth: 1, borderColor: colors.accent, flexDirection: "row", gap: 6, justifyContent: "center" },
  screenerBtnText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 15 },
  manualBtn: { backgroundColor: colors.accent },
  manualBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 15 },
});
