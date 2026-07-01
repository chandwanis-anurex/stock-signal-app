import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from "@expo-google-fonts/inter";
import { NavigationContainer, DarkTheme, useNavigation } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "./api/client";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";
import Logo from "./components/Logo";

import AuthScreen            from "./screens/AuthScreen";
import HomeScreen            from "./screens/HomeScreen";
import ScreenerScreen        from "./screens/ScreenerScreen";
import WatchlistsScreen      from "./screens/WatchlistsScreen";
import WatchlistDetailScreen from "./screens/WatchlistDetailScreen";
import ManualWatchlistScreen from "./screens/ManualWatchlistScreen";
import RulesListScreen       from "./screens/RulesListScreen";
import RuleBuilderScreen     from "./screens/RuleBuilderScreen";
import SignalFeedScreen      from "./screens/SignalFeedScreen";
import AnalyticsScreen       from "./screens/AnalyticsScreen";
import HelpScreen            from "./screens/HelpScreen";
import OnboardingScreen      from "./screens/OnboardingScreen";

const Stack = createNativeStackNavigator();
const Tabs  = createBottomTabNavigator();

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

function HeaderLogo() {
  const navigation = useNavigation();
  return (
    <TouchableOpacity onPress={() => navigation.navigate("Home")} style={{ marginRight: 12 }}>
      <Logo size={36} />
    </TouchableOpacity>
  );
}
const headerLogo = () => <HeaderLogo />;

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontFamily: "Inter_700Bold" },
  headerBackTitle: "",
  headerBackTitleVisible: false,
  headerRight: headerLogo,
};

// ── Watchlists stack ────────────────────────────────────────────────────────
function WatchlistsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Watchlists"      component={WatchlistsScreen}      options={{ title: "Watchlists" }} />
      <Stack.Screen name="WatchlistDetail" component={WatchlistDetailScreen} options={{ title: "Watchlist" }} />
      <Stack.Screen name="ManualWatchlist" component={ManualWatchlistScreen} options={{ title: "Add Symbols" }} />
      <Stack.Screen name="Screener"        component={ScreenerScreen}        options={{ title: "Stock Screener" }} />
    </Stack.Navigator>
  );
}

// ── Rules stack ─────────────────────────────────────────────────────────────
function RulesStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="RulesList"   component={RulesListScreen}   options={{ title: "Rule Sets" }} />
      <Stack.Screen name="RuleBuilder" component={RuleBuilderScreen} options={({ route }) => ({
        title: route.params?.existingRule ? route.params.existingRule.name : "New Rule Set",
      })} />
    </Stack.Navigator>
  );
}

// ── Account stack ────────────────────────────────────────────────────────────
function AccountScreen({ onLogout, navigation }) {
  const logout = async () => { await auth.removeToken(); onLogout(); };
  return (
    <View style={styles.accountScreen}>
      <View style={styles.accountCard}>
        <Logo size={64} />
        <Text style={styles.accountTitle}>SignalFlow</Text>
        <Text style={styles.accountSubtitle}>Algorithmic stock alerts, simplified</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate("HowItWorks")} style={styles.helpButton}>
        <Text style={styles.helpButtonText}>How SignalFlow Works</Text>
      </TouchableOpacity>
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
        {props => <AccountScreen {...props} onLogout={onLogout} />}
      </AccountStack.Screen>
      <AccountStack.Screen name="Help" component={HelpScreen} options={{ title: "Help & About" }} />
      <AccountStack.Screen name="HowItWorks" options={{ title: "How It Works" }}>
        {props => <OnboardingScreen {...props} onDone={() => props.navigation.goBack()} />}
      </AccountStack.Screen>
    </AccountStack.Navigator>
  );
}

// ── Main tab navigator ───────────────────────────────────────────────────────
function MainApp({ onLogout }) {
  const tabOpts = (iconName) => ({
    tabBarIcon: ({ color, size }) => <Ionicons name={iconName} size={size} color={color} />,
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { fontFamily: "Inter_700Bold" },
    headerRight: headerLogo,
  });

  return (
    <Tabs.Navigator
      screenOptions={{
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{
        ...tabOpts("home"),
        title: "SignalFlow",
      }} />

      <Tabs.Screen name="WatchlistsTab" component={WatchlistsStack} options={{
        headerShown: false, tabBarLabel: "Watchlists",
        tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
      }} />

      <Tabs.Screen name="RulesTab" component={RulesStack} options={{
        headerShown: false, tabBarLabel: "Rules",
        tabBarIcon: ({ color, size }) => <Ionicons name="git-branch" size={size} color={color} />,
      }} />

      <Tabs.Screen name="Signals" component={SignalFeedScreen} options={{
        ...tabOpts("flash"), title: "Trade Signals",
      }} />

      <Tabs.Screen name="Analytics" component={AnalyticsScreen} options={{
        ...tabOpts("bar-chart"), title: "Analytics",
      }} />

      <Tabs.Screen name="Account" options={{
        headerShown: false,
        tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
      }}>
        {() => <AccountStackScreen onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [ready, setReady]               = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [onboarded, setOnboarded]       = useState(false);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });

  useEffect(() => {
    Promise.all([
      auth.getToken(),
      AsyncStorage.getItem("sf_onboarded"),
    ]).then(([token, ob]) => {
      setAuthenticated(!!token);
      setOnboarded(!!ob);
      setReady(true);
    });
  }, []);

  if (!ready || !fontsLoaded) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={colors.accent} /></View>;
  }

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  if (!onboarded) {
    return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <MainApp onLogout={() => { setAuthenticated(false); setOnboarded(false); }} />
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
  accountTitle:    { fontSize: 22, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary },
  accountSubtitle: { fontSize: 14, color: colors.textSecondary },
  helpButton: {
    borderWidth: 1, borderColor: colors.border,
    padding: 16, borderRadius: 10, alignItems: "center", marginBottom: 12,
  },
  helpButtonText: { color: colors.textPrimary, fontFamily: "Inter_700Bold", fontSize: 16 },
  signOutButton: {
    backgroundColor: colors.danger + "22", borderWidth: 1, borderColor: colors.danger,
    padding: 16, borderRadius: 10, alignItems: "center",
  },
  signOutText: { color: colors.danger, fontFamily: "Inter_700Bold", fontSize: 16 },
});
