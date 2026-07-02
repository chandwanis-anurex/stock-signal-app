import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from "react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import {
  useWatchlistDetailQuery, useWatchlistSymbolsQuery, useWatchlistChannelsQuery, useRulesQuery,
  useUpdateWatchlistMutation, useToggleWatchlistRuleMutation, useRefreshWatchlistMutation,
  useAddWatchlistSymbolMutation, useDeleteWatchlistSymbolMutation,
  useAddAlertChannelMutation, useDeleteAlertChannelMutation, useTestAlertChannelMutation,
} from "../api/queries";
import { colors, typography, layout } from "../theme";
import Dropdown from "../components/Dropdown";

const CHANNEL_TYPES = [
  { value: "webhook", label: "Webhook (TradersPost)" },
  { value: "email",   label: "Email" },
  { value: "sms",     label: "SMS / WhatsApp" },
  { value: "push",    label: "Push Notification" },
];

const SIZING_TYPES = [
  { value: "dollars", label: "Dollar Amount ($)" },
  { value: "shares",  label: "Number of Shares" },
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

  const wlQuery       = useWatchlistDetailQuery(watchlistId);
  const symbolsQuery   = useWatchlistSymbolsQuery(watchlistId);
  const channelsQuery  = useWatchlistChannelsQuery(watchlistId);
  const rulesQuery     = useRulesQuery();

  const watchlist = wlQuery.data;
  const symbols   = symbolsQuery.data ?? [];
  const channels  = channelsQuery.data ?? [];
  const rules     = rulesQuery.data ?? [];

  const updateMutation       = useUpdateWatchlistMutation(watchlistId);
  const toggleMutation       = useToggleWatchlistRuleMutation(watchlistId);
  const refreshMutation      = useRefreshWatchlistMutation(watchlistId);
  const addSymbolMutation    = useAddWatchlistSymbolMutation(watchlistId);
  const deleteSymbolMutation = useDeleteWatchlistSymbolMutation(watchlistId);
  const addChannelMutation   = useAddAlertChannelMutation(watchlistId);
  const deleteChannelMutation = useDeleteAlertChannelMutation(watchlistId);
  const testChannelMutation  = useTestAlertChannelMutation(watchlistId);

  const [editing, setEditing]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Edit-mode state
  const [editName, setEditName]   = useState("");
  const [editRuleId, setEditRuleId] = useState(null);
  const [editSizingType, setEditSizingType] = useState("dollars");
  const [editSizingValue, setEditSizingValue] = useState("1000");
  const [newSymbol, setNewSymbol] = useState("");

  useEffect(() => {
    navigation.setOptions({ title: watchlist?.name ?? "Watchlist" });
  }, [watchlist?.name]);

  const startEditing = () => {
    setEditName(watchlist?.name ?? "");
    setEditRuleId(watchlist?.rule_id ?? null);
    setEditSizingType(watchlist?.position_sizing_type ?? "dollars");
    setEditSizingValue(String(watchlist?.position_sizing_value ?? 1000));
    setEditing(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([wlQuery.refetch(), symbolsQuery.refetch(), channelsQuery.refetch(), rulesQuery.refetch()]);
    setRefreshing(false);
  };

  const handleToggle = () => {
    const msg = watchlist.rule_active
      ? `Stop alerts from "${watchlist.rule_name}" on this watchlist?`
      : `Start running "${watchlist.rule_name}" on this watchlist?`;
    Alert.alert(
      watchlist.rule_active ? "Halt Rule" : "Start Rule",
      msg,
      [
        { text: "Cancel", style: "cancel" },
        { text: watchlist.rule_active ? "Halt" : "Start", onPress: () => {
          toggleMutation.mutate(undefined, { onError: (e) => Alert.alert("Error", e.message) });
        }},
      ]
    );
  };

  const handleRefreshScreener = () => {
    Alert.alert("Refresh Watchlist", "Re-run screener criteria and update symbols? Manually added symbols will be kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Refresh", onPress: () => {
        refreshMutation.mutate(undefined, {
          onSuccess: () => Alert.alert("Done", "Watchlist refreshed."),
          onError: (e) => Alert.alert("Error", e.message),
        });
      }},
    ]);
  };

  const handleSaveEdits = () => {
    const sizingValue = parseFloat(editSizingValue);
    if (!sizingValue || sizingValue <= 0) {
      Alert.alert("Invalid trade size", "Enter a positive number for the trade size.");
      return;
    }
    const payload = {
      name: editName.trim(),
      position_sizing_type: editSizingType,
      position_sizing_value: sizingValue,
    };
    if (editRuleId !== watchlist.rule_id) {
      payload.rule_id = editRuleId;
    }
    updateMutation.mutate(payload, {
      onSuccess: () => setEditing(false),
      onError: (e) => Alert.alert("Save failed", e.message),
    });
  };

  const handleAddSymbol = () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    addSymbolMutation.mutate(sym, {
      onSuccess: () => setNewSymbol(""),
      onError: (e) => Alert.alert("Error", e.message),
    });
  };

  const handleDeleteSymbol = (symbol) => {
    deleteSymbolMutation.mutate(symbol, { onError: (e) => Alert.alert("Error", e.message) });
  };

  // Alert channels
  const handleAddChannel = () => {
    Alert.alert("Add Alert Channel", "Choose channel type:", [
      ...CHANNEL_TYPES.map(ct => ({
        text: ct.label,
        onPress: () => ct.value === "push" ? registerPushChannel() : promptDestination(ct.value, ct.label),
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // Push needs a device token from Apple/Expo, not something a user can type
  // in — register automatically instead of prompting for one.
  const registerPushChannel = () => {
    Alert.alert(
      "Enable Push Notifications",
      "SignalFlow will ask for notification permission, then automatically register this device to receive alerts. No code or token to enter.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: doRegisterPush },
      ]
    );
  };

  const doRegisterPush = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Enable notifications for SignalFlow in your iPhone's Settings app to use push alerts.");
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId: "704b6240-b34b-43ee-a76e-2be8ddade1e9",
      })).data;
      await addChannelMutation.mutateAsync({ channelType: "push", destination: token });
      Alert.alert("Push Enabled", "This device will now receive push alerts for this watchlist.");
    } catch (e) {
      Alert.alert("Push setup failed", e.message);
    }
  };

  const promptDestination = (channelType, label) => {
    const placeholders = {
      webhook: "https://webhooks.traderspost.io/...",
      email:   "your@email.com",
      sms:     "+1234567890",
    };
    Alert.prompt(`Add ${label}`, placeholders[channelType], async (dest) => {
      if (!dest?.trim()) return;
      try {
        await addChannelMutation.mutateAsync({ channelType, destination: dest.trim() });
      } catch (e) {
        Alert.alert("Error", e.message);
      }
    }, "plain-text");
  };

  const handleDeleteChannel = (channelId) => {
    Alert.alert("Remove Channel", "Remove this alert channel?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        deleteChannelMutation.mutate(channelId, { onError: (e) => Alert.alert("Error", e.message) });
      }},
    ]);
  };

  const handleTestChannel = (channelId) => {
    testChannelMutation.mutate(channelId, {
      onSuccess: () => Alert.alert("Test Sent", "Test alert dispatched."),
      onError: (e) => Alert.alert("Test failed", e.message),
    });
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
    <GestureHandlerRootView style={styles.root}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rule status button */}
        <RuleToggleButton
          ruleId={watchlist.rule_id}
          ruleName={watchlist.rule_name}
          ruleActive={watchlist.rule_active}
          onToggle={handleToggle}
          onEdit={startEditing}
        />

        {/* Screener refresh */}
        {watchlist.screener_criteria && (
          <TouchableOpacity style={styles.refreshRow} onPress={handleRefreshScreener}>
            <Ionicons name="refresh" size={14} color={colors.accent} />
            <Text style={styles.refreshText}>Screener Criteria — tap to refresh symbols</Text>
          </TouchableOpacity>
        )}

        {/* Trade size summary */}
        <View style={styles.sizingRow}>
          <Ionicons name="cash-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.sizingText}>
            Buy size: {watchlist.position_sizing_type === "shares"
              ? `${watchlist.position_sizing_value} shares`
              : `$${watchlist.position_sizing_value} per trade`}
          </Text>
        </View>

        {/* Edit toggle */}
        <TouchableOpacity style={styles.editToggleBtn} onPress={() => editing ? setEditing(false) : startEditing()}>
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

            <Text style={styles.sectionLabel}>Trade Size (Buy Orders)</Text>
            <Text style={styles.sectionHint}>
              Sent with every buy signal's webhook so the trading platform knows how much to buy. Sell signals close the full position — no size needed.
            </Text>
            <Dropdown
              label="Sizing Method"
              value={editSizingType}
              options={SIZING_TYPES}
              onChange={setEditSizingType}
            />
            <TextInput
              style={styles.input}
              value={editSizingValue}
              onChangeText={setEditSizingValue}
              placeholder={editSizingType === "dollars" ? "e.g. 1000" : "e.g. 10"}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
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
                <Text style={styles.channelDest} numberOfLines={1}>
                  {ch.channel_type === "push" ? "This device" : ch.destination}
                </Text>
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
      </ScrollView>

      {/* Fixed footer so Save doesn't require scrolling past a long symbols list */}
      {editing && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdits} disabled={updateMutation.isPending}>
            <Text style={styles.saveBtnText}>{updateMutation.isPending ? "Saving..." : "Save Changes"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: layout.screenPadding, paddingBottom: 48 },

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
  sizingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sizingText: { fontSize: 12, color: colors.textSecondary, fontFamily: "Inter_600SemiBold" },

  editToggleBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.accent,
    padding: 12, borderRadius: 10, marginBottom: 16, justifyContent: "center",
  },
  editToggleText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 14 },

  editSection: { marginBottom: 8 },
  sectionLabel: { ...typography.label, marginTop: 12, marginBottom: 8 },
  sectionHint: { ...typography.bodySmall, marginBottom: 8 },
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

  footer: {
    padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg,
  },
  saveBtn: {
    backgroundColor: colors.accent, padding: 16, alignItems: "center",
    borderRadius: layout.buttonRadius,
  },
  saveBtnText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },
});
