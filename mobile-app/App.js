import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { auth } from "./api/client";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";
import Logo from "./components/Logo";
import AuthScreen from "./screens/AuthScreen";
import WatchlistsScreen from "./screens/WatchlistsScreen";
import CriteriaBuilderScreen from "./screens/CriteriaBuilderScreen";
import WatchlistDetailScreen from "./screens/WatchlistDetailScreen";
import RuleBuilderScreen from "./screens/RuleBuilderScreen";
import AlertChannelsScreen from "./screens/AlertChannelsScreen";
import RuleDetailScreen from "./screens/RuleDetailScreen";
import SignalFeedScreen from "./screens/SignalFeedScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";
import HelpScreen from "./screens/HelpScreen";
import ManualWatchlistScreen from "./screens/ManualWatchlistScreen";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    primary: colors.accent,
    text: colors.textPrimary,
  },
};

const headerLogo = () => <Logo size={36} style={{ marginRight: 12 }} />;

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: "700" },
  headerBackTitle: "",
  headerBackTitleVisible: false,
  headerRight: headerLogo,
};

function WatchlistsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Watchlists" component={WatchlistsScreen} options={{ title: "Watchlists" }} />
      <Stack.Screen name="CriteriaBuilder" component={CriteriaBuilderScreen} options={{ title: "New Watchlist" }} />
      <Stack.Screen name="WatchlistDetail" component={WatchlistDetailScreen} options={{ title: "Watchlist" }} />
      <Stack.Screen name="RuleBuilder" component={RuleBuilderScreen} options={{ title: "New Rule" }} />
      <Stack.Screen name="RuleDetail" component={RuleDetailScreen} options={{ title: "Rule" }} />
      <Stack.Screen name="AlertChannels" component={AlertChannelsScreen} options={{ title: "Alert Channels" }} />
      <Stack.Screen name="ManualWatchlist" component={ManualWatchlistScreen} options={{ title: "Enter Symbols" }} />
    </Stack.Navigator>
  );
}

function AccountScreen({ onLogout, navigation }) {
  const logout = async () => {
    await auth.removeToken();
    onLogout();
  };

  return (
    <View style={styles.accountScreen}>
      <View style={styles.accountCard}>
        <Logo size={64} />
        <Text style={styles.accountTitle}>SignalFlow</Text>
        <Text style={styles.accountSubtitle}>Algorithmic stock alerts, simplified</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate("Help")} style={styles.helpButton}>
        <Text style={styles.helpButtonText}>Help & About</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={logout} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const AccountStack = createNativeStackNavigator();
function AccountStackScreen({ onLogout }) {
  return (
    <AccountStack.Navigator screenOptions={stackScreenOptions}>
      <AccountStack.Screen name="AccountMain" options={{ title: "Account" }}>
        {(props) => <AccountScreen {...props} onLogout={onLogout} />}
      </AccountStack.Screen>
      <AccountStack.Screen name="Help" component={HelpScreen} options={{ title: "Help & About" }} />
    </AccountStack.Navigator>
  );
}

function MainApp({ onLogout }) {
  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
        headerRight: headerLogo,
      }}
    >
      <Tabs.Screen
        name="WatchlistsTab"
        component={WatchlistsStack}
        options={{
          title: "Watchlists", headerShown: false, tabBarLabel: "Watchlists",
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="Signals" component={SignalFeedScreen} options={{
        title: "Signals",
        tabBarIcon: ({ color, size }) => <Ionicons name="flash" size={size} color={color} />,
      }} />
      <Tabs.Screen name="Analytics" component={AnalyticsScreen} options={{
        title: "Analytics",
        tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
      }} />
      <Tabs.Screen name="Account" options={{
        title: "Account", headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
      }}>
        {() => <AccountStackScreen onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    auth.getToken().then((token) => {
      setAuthenticated(!!token);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <MainApp onLogout={() => setAuthenticated(false)} />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg },
  accountScreen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  accountCard: {
    backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: 24, marginBottom: 24, alignItems: "center", gap: 12,
  },
  accountTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  accountSubtitle: { fontSize: 14, color: colors.textSecondary },
  helpButton: {
    borderWidth: 1, borderColor: colors.border,
    padding: 16, borderRadius: 10, alignItems: "center", marginBottom: 12,
  },
  helpButtonText: { color: colors.textPrimary, fontWeight: "700", fontSize: 16 },
  signOutButton: {
    backgroundColor: colors.danger + "22", borderWidth: 1, borderColor: colors.danger,
    padding: 16, borderRadius: 10, alignItems: "center",
  },
  signOutText: { color: colors.danger, fontWeight: "700", fontSize: 16 },
});
