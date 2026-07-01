import React, { useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, RefreshControl,
} from "react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";

export default function RulesListScreen({ navigation }) {
  const [rules, setRules]         = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listRules();
      setRules(data);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const confirmDelete = (rule) => {
    const msg = rule.watchlist_count > 0
      ? `"${rule.name}" is used by ${rule.watchlist_count} watchlist(s). Deleting it will stop alerts on those watchlists and remove the rule assignment. Continue?`
      : `Delete rule "${rule.name}"?`;

    Alert.alert("Delete Rule", msg, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.deleteRule(rule.id);
          setRules(prev => prev.filter(r => r.id !== rule.id));
        } catch (e) {
          Alert.alert("Delete failed", e.message);
        }
      }},
    ]);
  };

  const renderRightActions = (rule) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => confirmDelete(rule)}>
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FlatList
        data={rules}
        keyExtractor={r => String(r.id)}
        style={styles.container}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("RuleBuilder", { existingRule: item })}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.ruleName}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaBadge}>
                    {item.buy_condition?.terms?.length || 0} buy condition{item.buy_condition?.terms?.length !== 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.metaBadge}>
                    {item.sell_condition?.terms?.length || 0} sell condition{item.sell_condition?.terms?.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                {item.watchlist_count > 0 && (
                  <Text style={styles.metaWatchlists}>
                    {item.active_count > 0 ? "🟢" : "🔴"} {item.watchlist_count} watchlist{item.watchlist_count !== 1 ? "s" : ""}
                    {item.active_count > 0 ? ` (${item.active_count} running)` : " (none running)"}
                  </Text>
                )}
              </View>
              <Ionicons name="create-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Swipeable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="git-branch-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No rule sets yet</Text>
            <Text style={styles.emptySub}>Create a rule set to define when buy and sell alerts should fire.</Text>
          </View>
        }
      />
      <View style={styles.footer}>
        <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate("RuleBuilder", {})}>
          <Text style={styles.newBtnText}>+ New Rule Set</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: layout.screenPadding, paddingBottom: 8 },

  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    padding: 16, marginBottom: 10,
  },
  cardLeft: { flex: 1 },
  ruleName: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.textPrimary, marginBottom: 6 },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  metaBadge: { fontSize: 11, color: colors.textMuted, fontFamily: "Inter_600SemiBold",
    backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  metaWatchlists: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  swipeDelete: {
    backgroundColor: colors.sell, borderRadius: layout.cardRadius,
    marginBottom: 10, width: 80, alignItems: "center", justifyContent: "center", gap: 4,
  },
  swipeDeleteText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },

  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 32, gap: 12 },
  emptyTitle: { ...typography.heading3 },
  emptySub: { ...typography.bodySmall, textAlign: "center", lineHeight: 20 },

  footer: { padding: 16 },
  newBtn: {
    backgroundColor: colors.accent, padding: 16,
    alignItems: "center", borderRadius: layout.buttonRadius,
  },
  newBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
