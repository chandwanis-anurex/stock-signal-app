import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { api, auth } from "../api/client";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Both email and password are required");
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
        <Text style={styles.title}>Stock Signal App</Text>
        <Text style={styles.subtitle}>{mode === "login" ? "Sign in to your account" : "Create an account"}</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")}>
          <Text style={styles.toggle}>
            {mode === "login" ? "No account? Register" : "Already have an account? Sign in"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: { flexGrow: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center", marginBottom: 6, color: "#111" },
  subtitle: { fontSize: 14, color: "#777", textAlign: "center", marginBottom: 32 },
  label: { fontSize: 13, color: "#555", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 16 },
  button: { backgroundColor: "#1a73e8", padding: 16, alignItems: "center", borderRadius: 8, marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  toggle: { color: "#1a73e8", textAlign: "center", marginTop: 20, fontWeight: "600" },
});
