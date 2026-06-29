import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { auth } from "./api/client";
import AuthScreen from "./screens/AuthScreen";
import WatchlistsScreen from "./screens/WatchlistsScreen";
import CriteriaBuilderScreen from "./screens/CriteriaBuilderScreen";
import WatchlistDetailScreen from "./screens/WatchlistDetailScreen";
import RuleBuilderScreen from "./screens/RuleBuilderScreen";
import AlertChannelsScreen from "./screens/AlertChannelsScreen";
import SignalFeedScreen from "./screens/SignalFeedScreen";
import AnalyticsScreen from "./screens/AnalyticsScreen";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function WatchlistsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Watchlists" component={WatchlistsScreen} options={{ title: "Watchlists" }} />
      <Stack.Screen name="CriteriaBuilder" component={CriteriaBuilderScreen} options={{ title: "New Watchlist" }} />
      <Stack.Screen name="WatchlistDetail" component={WatchlistDetailScreen} options={{ title: "Watchlist" }} />
      <Stack.Screen name="RuleBuilder" component={RuleBuilderScreen} options={{ title: "New Rule" }} />
      <Stack.Screen name="AlertChannels" component={AlertChannelsScreen} options={{ title: "Alert Channels" }} />
    </Stack.Navigator>
  );
}

function MainApp({ onLogout }) {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="WatchlistsTab" component={WatchlistsStack} options={{ title: "Watchlists", headerShown: false }} />
      <Tabs.Screen name="Signals" component={SignalFeedScreen} />
      <Tabs.Screen name="Analytics" component={AnalyticsScreen} />
      <Tabs.Screen
        name="Account"
        options={{ title: "Account" }}
      >
        {() => <AccountScreen onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

function AccountScreen({ onLogout }) {
  const logout = async () => {
    await auth.removeToken();
    onLogout();
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
      <TouchableOpacity
        onPress={logout}
        style={{ backgroundColor: "#e53935", padding: 16, borderRadius: 8, paddingHorizontal: 32 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (!authenticated) {
    return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <NavigationContainer>
      <MainApp onLogout={() => setAuthenticated(false)} />
    </NavigationContainer>
  );
}
