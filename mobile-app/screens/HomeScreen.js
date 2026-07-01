import React, { useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Logo from "../components/Logo";
import { colors } from "../theme";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width - 40, 360);
const RADIUS = SIZE * 0.34;
const TILE_W = SIZE * 0.30;
const TILE_H = SIZE * 0.26;
const CX = SIZE / 2;
const CY = SIZE / 2;

const TILES = [
  {
    label: "Screen\nStocks",
    icon: "funnel",
    color: colors.accent,
    angle: -90, // top
    tab: "WatchlistsTab",
  },
  {
    label: "Define\nRules",
    icon: "git-branch",
    color: "#a78bfa",
    angle: 0, // right
    tab: "WatchlistsTab",
  },
  {
    label: "Execute\nTrades",
    icon: "flash",
    color: colors.buy,
    angle: 90, // bottom
    tab: "Signals",
  },
  {
    label: "Analyze\nPerformance",
    icon: "bar-chart",
    color: "#38bdf8",
    angle: 180, // left
    tab: "Analytics",
  },
];

// Arrow chevrons placed halfway between each pair of tiles (at 45° offsets)
const ARROWS = [
  { angle: -45, rotate: "45deg" },  // top → right
  { angle: 45,  rotate: "135deg" }, // right → bottom
  { angle: 135, rotate: "225deg" }, // bottom → left
  { angle: -135, rotate: "315deg" }, // left → top
];

function toRad(deg) { return (deg * Math.PI) / 180; }

export default function HomeScreen({ navigation }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 20000, useNativeDriver: true })
    ).start();
  }, []);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const navigate = (tab) => {
    navigation.navigate(tab);
  };

  return (
    <View style={styles.root}>
      {/* Title */}
      <Text style={styles.pageTitle}>Your Trading Dashboard</Text>
      <Text style={styles.pageSubtitle}>Tap any step to get started</Text>

      {/* Circle diagram */}
      <View style={[styles.diagram, { width: SIZE, height: SIZE }]}>

        {/* Rotating dashed orbit */}
        <Animated.View style={[styles.orbit, {
          width: RADIUS * 2 + TILE_W * 0.6,
          height: RADIUS * 2 + TILE_W * 0.6,
          borderRadius: RADIUS + TILE_W * 0.3,
          left: CX - RADIUS - TILE_W * 0.3,
          top: CY - RADIUS - TILE_W * 0.3,
          transform: [{ rotate: spinDeg }],
        }]} />

        {/* Arrow indicators between tiles */}
        {ARROWS.map((arr, i) => {
          const x = CX + RADIUS * 0.72 * Math.cos(toRad(arr.angle));
          const y = CY + RADIUS * 0.72 * Math.sin(toRad(arr.angle));
          return (
            <View key={i} style={[styles.arrowWrap, { left: x - 12, top: y - 12, transform: [{ rotate: arr.rotate }] }]}>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </View>
          );
        })}

        {/* Tiles */}
        {TILES.map((tile, i) => {
          const rad = toRad(tile.angle);
          const tx = CX + RADIUS * Math.cos(rad) - TILE_W / 2;
          const ty = CY + RADIUS * Math.sin(rad) - TILE_H / 2;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.tile, {
                left: tx, top: ty, width: TILE_W, height: TILE_H,
                borderColor: tile.color + "55",
                shadowColor: tile.color,
              }]}
              onPress={() => navigate(tile.tab)}
              activeOpacity={0.75}
            >
              <View style={[styles.tileIcon, { backgroundColor: tile.color + "22" }]}>
                <Ionicons name={tile.icon} size={20} color={tile.color} />
              </View>
              <Text style={[styles.tileLabel, { color: tile.color }]}>{tile.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Center */}
        <Animated.View style={[styles.center, { transform: [{ scale: pulse }] }]}>
          <Logo size={42} />
          <Text style={styles.centerName}>SignalFlow</Text>
        </Animated.View>
      </View>

      {/* Step legend */}
      <View style={styles.legend}>
        {TILES.map((tile, i) => (
          <TouchableOpacity key={i} style={styles.legendRow} onPress={() => navigate(tile.tab)}>
            <View style={[styles.legendDot, { backgroundColor: tile.color }]} />
            <Text style={styles.legendNum}>{i + 1}</Text>
            <Text style={styles.legendLabel}>{tile.label.replace("\n", " ")}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    paddingTop: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: "Inter_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 28,
  },

  diagram: { position: "relative" },

  orbit: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },

  arrowWrap: { position: "absolute" },

  tile: {
    position: "absolute",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    padding: 8,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 14,
  },

  center: {
    position: "absolute",
    left: CX - 54,
    top: CY - 54,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  centerName: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: colors.accent,
    letterSpacing: 0.5,
  },

  legend: {
    width: "100%",
    paddingHorizontal: 24,
    marginTop: 28,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendNum: {
    fontSize: 12,
    fontFamily: "Inter_800ExtraBold",
    color: colors.textMuted,
    width: 14,
  },
  legendLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: colors.textPrimary,
  },
});
