import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { api, auth } from "../api/client";
import { colors, typography, layout } from "../theme";
import Logo from "../components/Logo";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Both email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "login"
        ? await api.login(email.trim(), password)
        : await api.register(email.trim(), password);
      await auth.saveToken(result.token);
      onAuthenticated();
    } catch (e) {
      Alert.alert(mode === "login" ? "Login failed" : "Registration failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.logoArea}>
          <Logo size={80} />
          <Text style={styles.appName}>SignalFlow</Text>
          <Text style={styles.tagline}>Algorithmic stock alerts, simplified</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeTab, mode === "login" && styles.modeTabActive]}
              onPress={() => setMode("login")}
            >
              <Text style={[styles.modeTabText, mode === "login" && styles.modeTabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === "register" && styles.modeTabActive]}
              onPress={() => setMode("register")}
            >
              <Text style={[styles.modeTabText, mode === "register" && styles.modeTabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Market data powered by Alpaca</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },

  logoArea: { alignItems: "center", marginBottom: 40 },
  logoMark: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  logoIcon: { fontSize: 28, color: "#000", fontWeight: "900" },
  appName: { fontSize: 32, fontWeight: "800", color: colors.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },

  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
  },

  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: layout.inputRadius,
    padding: 4,
    marginBottom: 24,
  },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 6 },
  modeTabActive: { backgroundColor: colors.accent },
  modeTabText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  modeTabTextActive: { color: "#000" },

  inputLabel: { ...typography.label, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.inputRadius,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },

  button: {
    backgroundColor: colors.accent,
    padding: 16,
    alignItems: "center",
    borderRadius: layout.buttonRadius,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#000", fontWeight: "800", fontSize: 16 },

  footer: { textAlign: "center", color: colors.textMuted, fontSize: 12 },
});
