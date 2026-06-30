import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, auth } from "../api/client";
import { colors, typography, layout } from "../theme";
import Logo from "../components/Logo";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "forgot" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
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

  const sendCode = async () => {
    if (!email.trim()) {
      Alert.alert("Enter your email first");
      return;
    }
    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      Alert.alert("Code sent", "Check your email for the 6-digit reset code.");
      setMode("reset");
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    if (!code.trim() || !newPassword.trim()) {
      Alert.alert("Missing fields", "Enter the code and your new password.");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(email.trim(), code.trim(), newPassword);
      Alert.alert("Password updated", "You can now sign in with your new password.");
      setMode("login");
      setCode("");
      setNewPassword("");
    } catch (e) {
      Alert.alert("Reset failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderLoginRegister = () => (
    <>
      <View style={styles.modeToggle}>
        <TouchableOpacity style={[styles.modeTab, mode === "login" && styles.modeTabActive]} onPress={() => setMode("login")}>
          <Text style={[styles.modeTabText, mode === "login" && styles.modeTabTextActive]}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeTab, mode === "register" && styles.modeTabActive]} onPress={() => setMode("register")}>
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
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={submit} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </Text>
      </TouchableOpacity>

      {mode === "login" && (
        <TouchableOpacity style={styles.forgotBtn} onPress={() => setMode("forgot")}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const renderForgot = () => (
    <>
      <Text style={styles.sectionTitle}>Reset Password</Text>
      <Text style={styles.sectionSubtitle}>Enter your email and we'll send a 6-digit code.</Text>

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

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={sendCode} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Sending..." : "Send Code"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.forgotBtn} onPress={() => setMode("login")}>
        <Text style={styles.forgotText}>Back to Sign In</Text>
      </TouchableOpacity>
    </>
  );

  const renderReset = () => (
    <>
      <Text style={styles.sectionTitle}>Enter New Password</Text>
      <Text style={styles.sectionSubtitle}>Check your email for the 6-digit code.</Text>

      <Text style={styles.inputLabel}>6-digit code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="123456"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={6}
      />

      <Text style={styles.inputLabel}>New Password</Text>
      <View style={styles.passwordRow}>
        <TextInput
          style={styles.passwordInput}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!showNewPassword}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNewPassword(v => !v)}>
          <Ionicons name={showNewPassword ? "eye-off" : "eye"} size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={doReset} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Updating..." : "Set New Password"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.forgotBtn} onPress={() => setMode("forgot")}>
        <Text style={styles.forgotText}>Resend code</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.logoArea}>
          <Logo size={80} />
          <Text style={styles.appName}>SignalFlow</Text>
          <Text style={styles.tagline}>Algorithmic stock alerts, simplified</Text>
        </View>

        <View style={styles.card}>
          {(mode === "login" || mode === "register") && renderLoginRegister()}
          {mode === "forgot" && renderForgot()}
          {mode === "reset" && renderReset()}
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
  appName: { fontSize: 32, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary, letterSpacing: -1 },
  tagline: { fontSize: 14, color: colors.textSecondary, marginTop: 6 },

  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 24,
  },

  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.textPrimary, marginBottom: 6 },
  sectionSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },

  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: layout.inputRadius,
    padding: 4,
    marginBottom: 24,
  },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 6 },
  modeTabActive: { backgroundColor: colors.accent },
  modeTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.textSecondary },
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

  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.inputRadius,
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: 14 },

  button: {
    backgroundColor: colors.accent,
    padding: 16,
    alignItems: "center",
    borderRadius: layout.buttonRadius,
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#000", fontFamily: "Inter_800ExtraBold", fontSize: 16 },

  forgotBtn: { alignItems: "center", marginTop: 16 },
  forgotText: { color: colors.accent, fontFamily: "Inter_600SemiBold", fontSize: 14 },

  footer: { textAlign: "center", color: colors.textMuted, fontSize: 12 },
});
