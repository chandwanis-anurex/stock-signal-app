import React from "react";
import { Image, StyleSheet } from "react-native";

export default function Logo({ size = 48 }) {
  return (
    <Image
      source={require("../assets/icon.png")}
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
      resizeMode="cover"
    />
  );
}
