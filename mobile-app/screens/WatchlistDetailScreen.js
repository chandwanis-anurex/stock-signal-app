import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from "react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { colors, typography, layout } from "../theme";
import Dropdown from "../components/Dropdown";

const CHANNEL_TYPES = [
  { value: "webhook", label: "Webhook (TradersPost)" },
  { value: "email",   label: "Email" },
  { value: "sms",     label: "SMS / WhatsApp" },
  { value: "push",    label: "Push Notification" },
];

function RuleToggleButton({ ruleId, ruleName, ruleActive, onToggle, onEdit }) {
  if (!ruleId) {
    return (
      <TouchableOpacity style={[styles.ruleBtn, styles.ruleBtnGrey]} onPress={onEdit}>
        <Ionicons name="stop" size={18} color={colors.textMuted} />
        <Text style={[styles.ruleBtnText, { color: colors.textMuted }]}>No Rule Attached — Tap Edit to add one</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={[styles.ruleBtn, ruleActive ? styles.ruleBtnGreen : styles.ruleBtnRed]} onPress={onToggle}>
      <Ionicons name={ruleActive ? "pause-circle" : "play-circle"} size={22} color="#fff" />
      <View style={{ flex: 1 }}>
        <Text style={styles.ruleBtnLabel}>{ruleActive ? "RUNNING" : "STOPPED"}</Text>
        <Text style={styles.ruleBtnName} numberOfLines={1}>{ruleName}</Text>
      </View>
      <Text style={styles.ruleBtnToggle}>{ruleActive ? "Halt" : "Start"}</Text>
    </TouchableOpacity>
  );
}

export default function WatchlistDetailScreen({ route, navigation }) {
  const { watchlistId } = route.params;

  const [watchlist, setWatchlist]   = useState(null);
  const [symbols, setSymbols]       = useState([]);
  const [channels, setChannels]     = useState([]);
  const [rules, setRules]           = useState([]);
  const [editing, setEditing]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit-mode state
  const [editName, setEditName]   = useState("");
  const [editRuleId, setEditRuleId] = useState(null);
  const [newSymbol, setNewSymbol] = useState("");
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    try {
      const [wl, syms, chs, allRules] = await Promise.all([
        api.listWatchlists().then(list => list.find(w => w.id === watchlistId)),
        api.getWatchlistSymbols(watchlistId),
        api.listAlertChannels(watchlistId),
        api.listRules(),
      ]);
      setWatchlist(wl);
      setSymbols(syms);
      setChannels(chs);
      setRules(allRules);
      setEditName(wl?.name ?? "");
      setEditRuleId(wl?.rule_id ?? null);
      navigation.setOptions({ title: wl?.name ?? "Watchlist" });
    } catch (e) {
      console.warn(e);
    }
  }, [watchlistId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleToggle = () => {
    const msg = watchlist.rule_active
      ? `Stop alerts from "${watchlist.rule_name}" on this watchlist?`
      : `Start running "${watchlist.rule_name}" on this watchlist?`;
    Alert.alert(
      watchlist.rule_active ? "Halt Rule" : "Start Rule",
      msg,
      [
        { text: "Cancel", style: "cancel" },
        { text: watchlist.rule_active ? "Halt" : "Start", onPress: async () => {
          try {
            const res = await api.toggleWatchlistRule(watchlistId);
            setWatchlist(prev => ({ ...prev, rule_active: res.rule_active }));
          } catch (e) {
            Alert.alert("Error", e.message);
          }
        }},
      ]
    );
  };

  const handleRefreshScreener = () => {
    Alert.alert("Refresh Watchlist", "Re-run screener criteria and update symbols? Manually added symbols will be kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Refresh", onPress: async () => {
        try {
          await api.refreshWatchlist(watchlistId);
          const syms = await api.getWatchlistSymbols(watchlistId);
          setSymbols(syms);
          Alert.alert("Done", "Watchlist refreshed.");
        } catch (e) {
          Alert.alert("Error", e.message);
        }
      }},
    ]);
  };

  const handleSaveEdits = async () => {
    setSaving(true);
    try {
      const payload = { name: editName.trim() };
      if (editRuleId !== watchlist.rule_id) {
        payload.rule_id = editRuleId;
      }
      const updated = await api.updateWatchlist(watchlistId, payload);
      setWatchlist(prev => ({ ...prev, ...updated }));
      navigation.setOptions({ title: updated.name ?? editName.trim() });
      setEditing(false);
    } catch (e) {
      Alert.alert("Save failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSymbol = async () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    try {
      const result = await api.addWatchlistSymbol(watchlistId, sym);
      if (!result.already_exists) {
        setSymbols(prev => [...prev, { symbol: result.symbol, company_name: result.company_name, is_manual: true }]);
      }
      setNewSymbol("");
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const handleDeleteSymbol = async (symbol) => {
    try {
      await api.deleteWatchlistSymbol(watchlistId, symbol);
      setSymbols(prev => prev.filter(s => s.symbol !== symbol));
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  // Alert channels
  const handleAddChannel = () => {
    Alert.alert("Add Alert Channel", "Choose channel type:", [
      ...CHANNEL_TYPES.map(ct => ({
        text: ct.label,
        onPress: () => promptDestination(ct.value, ct.label),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const promptDestination = (channelType, label) => {
    const placeholders = {
      webhook: "https://webhooks.traderspost.io/...",
      email:   "your@email.com",
      sms:     "+1234567890",
      push:    "Device push token",
    };
    Alert.prompt(`Add ${label}`, placeholders[channelType], async (dest) => {
      if (!dest?.trim()) return;
      try {
        const ch = await api.addAlertChannel(watchlistId, channelType, dest.trim());
        setChannels(prev => [...prev, ch]);
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    }, "plain-text");
  };

  const handleDeleteChannel = (channelId) => {
    Alert.alert("Remove Channel", "Remove this alert channel?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await api.deleteAlertChannel(watchlistId, channelId);
          setChannels(prev => prev.filter(c => c.id !== channelId));
        } catch (e) {
          Alert.alert("Error", e.message);
        }
      }},
    ]);
  };

  const handleTestChannel = async (channelId) => {
    try {
      await api.testAlertChannel(watchlistId, channelId);
      Alert.alert("Test Sent", "Test alert dispatched.");
    } catch (e) {
      Alert.alert("Test failed", e.message);
    }
  };

  const ruleOptions = [
    { value: "__none__", label: "— No Rule —" },
    ...rules.map(r => ({ value: String(r.id), label: r.name })),
  ];

  const renderSwipeDelete = (symbol) => (
    <TouchableOpacity style={styles.swipeDelete} onPress={() => handleDeleteSymbol(symbol)}>
      <Ionicons name="trash" size={20} color="#fff" />
    </TouchableOpacity>
  );

  if (!watchlist) {
    return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rule status button */}
        <RuleToggleButton
          ruleId={watchlist.rule_id}
          ruleName={watchlist.rule_name}
          ruleActive={watchlist.rule_active}
          onToggle={handleToggle}
          onEdit={() => setEditing(true)}
        />

        {/* Screener refresh */}
        {watchlist.screener_criteria && (
          <TouchableOpacity style={styles.refreshRow} onPress={handleRefreshScreener}>
            <Ionicons name="refresh" size={14} color={colors.accent} />
            <Text style={styles.refreshText}>Screener Criteria — tap to refresh symbols</Text>
          </TouchableOpacity>
        )}

        {/* Edit toggle */}
        <TouchableOpacity style={styles.editToggleBtn} onPress={() => setEditing(e => !e)}>
          <Ionicons name={editing ? "checkmark" : "create-outline"} size={16} color={colors.accent} />
          <Text style={styles.editToggleText}>{editing ? "Cancel Edit" : "Edit Watchlist"}</Text>
        </TouchableOpacity>

        {/* Edit mode fields */}
        {editing && (
          <View style={styles.editSection}>
            <Text style={styles.sectionLabel}>Watchlist Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <Text style={styles.sectionLabel}>Assigned Rule</Text>
            <Dropdown
              label="Rule Set"
              value={editRuleId ? String(editRuleId) : "__none__"}
              options={ruleOptions}
              onChange={v => setEditRuleId(v === "__none__" ? null : Number(v))}
            />
          </View>
        )}

        {/* Symbols */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Symbols ({symbols.length})</Text>
        </View>

        {editing && (
          <View style={styles.addSymbolRow}>
            <TextInput
              style={styles.addSymbolInput}
              value={newSymbol}
              onChangeText={t => setNewSymbol(t.toUpperCase())}
              placeholder="Add symbol, e.g. TSLA"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleAddSymbol}
            />
            <TouchableOpacity style={styles.addSymbolBtn} onPress={handleAddSymbol}>
              <Ionicons name="add" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        )}

        {symbols.length === 0 ? (
          <Text style={styles.empty}>No symbols yet — refresh screener or add manually.</Text>
        ) : (
          symbols.map(item => editing ? (
            <Swipeable key={item.symbol} renderRightActions={() => renderSwipeDelete(item.symbol)} overshootRight={false}>
              <View style={styles.symbolRow}>
                <View>
                  <Text style={styles.symbolText}>{item.symbol}</Text>
                  {item.company_name ? <Text style={styles.symbolCompany}>{item.company_name}</Text> : null}
                </View>
                <View style={styles.symbolMeta}>
                  {item.is_manual && <Text style={styles.manualBadge}>manual</Text>}
                  <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
                </View>
              </View>
            </Swipeable>
          ) : (
            <View key={item.symbol} style={styles.symbolRow}>
              <View>
                <Text style={styles.symbolText}>{item.symbol}</Text>
                {item.company_name ? <Text style={styles.symbolCompany}>{item.company_name}</Text> : null}
              </View>
              {item.is_manual && <Text style={styles.manualBadge}>manual</Text>}
            </View>
          ))
        )}

        {/* Alert channels */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Alert Channels</Text>
          <TouchableOpacity onPress={handleAddChannel}>
            <Text style={styles.addLink}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {channels.length === 0 ? (
          <Text style={styles.empty}>No alert channels. Signals will appear in-app only.</Text>
        ) : (
          channels.map(ch => (
            <View key={ch.id} style={styles.channelRow}>
              <Ionicons
                name={ch.channel_type === "webhook" ? "link" : ch.channel_type === "email" ? "mail" : ch.channel_type === "sms" ? "chatbubble" : "notifications"}
                size={16} color={colors.accent}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.channelType}>{ch.channel_type}</Text>
                <Text style={styles.channelDest} numberOfLines={1}>{ch.destination}</Text>
              </View>
              <TouchableOpacity onPress={() => handleTestChannel(ch.id)} style={styles.testBtn}>
                <Text style={styles.testBtnText}>Test</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteChannel(ch.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.sell} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Save button (edit mode) */}
        {editing && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdits} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: layout.screenPadding },

  ruleBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 10,
  },
  ruleBtnGreen: { backgroundColor: colors.buy },
  ruleBtnRed:   { backgroundColor: colors.sell },
  ruleBtnGrey:  { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ruleBtnLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.7)", letterSpacing: 1 },
  ruleBtnName:  { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  ruleBtnText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  ruleBtnToggle:{ fontSize: 12, fontFamily: "Inter_800ExtraBold", color: "rgba(255,255,255,0.85)" },

  refreshRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  refreshText: { fontSize: 12, color: colors.accent, fontFamily: "Inter_600SemiBold" },

  editToggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.accent,
    padding: 12, borderRadius: 10, marginBottom: 16, justifyContent: "center",
  },
  editToggleText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 14 },

  editSection: { marginBottom: 8 },
  sectionLabel: { ...typography.label, marginTop: 12, marginBottom: 8 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 8 },
  addLink: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 14 },
  input: {
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 12, color: colors.textPrimary, fontSize: 15, marginBottom: 8,
  },

  addSymbolRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  addSymbolInput: {
    flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border,
    borderRadius: layout.inputRadius, padding: 12, color: colors.textPrimary, fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  addSymbolBtn: {
    backgroundColor: colors.accent, width: 46, alignItems: "center", justifyContent: "center",
    borderRadius: layout.inputRadius,
  },

  symbolRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.card, borderRadius: layout.cardRadius,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8,
  },
  symbolText:    { fontFamily: "Inter_700Bold", fontSize: 15, color: colors.textPrimary },
  symbolCompany: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  symbolMeta:    { flexDirection: "row", alignItems: "center", gap: 8 },
  manualBadge: {
    fontSize: 10, color: colors.accent, fontFamily: "Inter_700Bold",
    borderWidth: 1, borderColor: colors.accent + "66",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },

  swipeDelete: {
    backgroundColor: colors.sell, borderRadius: layout.cardRadius,
    marginBottom: 8, width: 64, alignItems: "center", justifyContent: "center",
  },

  channelRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.card, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  channelType: { fontSize: 12, fontFamily: "Inter_700Bold", color: colors.accent, textTransform: "uppercase" },
  channelDest: { fontSize: 13, color: colors.textSecondary },
  testBtn: {
    borderWidth: 1, borderColor: colors.accent,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  testBtnText: { fontSize: 12, color: colors.accent, fontFamily: "Inter_700Bold" },

  empty: { ...typography.bodySmall, marginBottom: 12 },

  saveBtn: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius, marginTop: 20,
  },
  saveBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
