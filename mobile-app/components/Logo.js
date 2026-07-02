import React from "react";
import { Image } from "react-native";

export default function Logo({ size = 48, style }) {
  return (
    <Image
      source={require("../assets/icon.png")}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      resizeMode="cover"
    />
  );
}
