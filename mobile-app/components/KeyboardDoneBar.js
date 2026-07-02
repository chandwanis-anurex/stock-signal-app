import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Keyboard, StyleSheet, Platform } from "react-native";
import { colors } from "../theme";

// Global floating "Done" button that tracks the keyboard directly instead of
// relying on InputAccessoryView (unreliable under React Native's New
// Architecture / Fabric). Mount this once at the app root.
export default function KeyboardDoneBar() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const showSub = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardHeight === 0) return null;

  return (
    <View style={[styles.bar, { bottom: keyboardHeight }]} pointerEvents="box-none">
      <TouchableOpacity style={styles.doneBtn} onPress={() => Keyboard.dismiss()}>
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.cardAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "flex-end",
    zIndex: 1000,
    elevation: 1000,
  },
  doneBtn: { padding: 4 },
  doneText: { color: colors.accent, fontFamily: "Inter_700Bold", fontSize: 16 },
});
