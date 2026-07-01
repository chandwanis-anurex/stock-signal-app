import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Logo from "../components/Logo";
import { colors } from "../theme";

const { width, height } = Dimensions.get("window");
const SIZE = Math.min(width - 32, 370);
const R = SIZE * 0.33;          // tile center radius
const TILE = SIZE * 0.34;       // tile width & height — large squares
const CX = SIZE / 2;
const CY = SIZE / 2;

const TILES = [
  { label: "Screen\nStocks",       icon: "funnel",      color: colors.accent,  angle: -90 },
  { label: "Define\nRules",        icon: "git-branch",  color: "#a78bfa",      angle: 0   },
  { label: "Execute\nTrades",      icon: "flash",       color: colors.buy,     angle: 90  },
  { label: "Analyze\nPerformance", icon: "bar-chart",   color: "#38bdf8",      angle: 180 },
];

// Curved arrows sit on the orbit ring between each pair of tiles
// angle = position on orbit, rotate = direction the chevron points (clockwise)
const ARROWS = [
  { angle: -45,  rotate: "45deg"  },
  { angle:  45,  rotate: "135deg" },
  { angle:  135, rotate: "225deg" },
  { angle: -135, rotate: "315deg" },
];

const NAV_TARGETS = ["WatchlistsTab", "RulesTab", "Signals", "Analytics"];

function toRad(d) { return (d * Math.PI) / 180; }

export default function HomeScreen({ navigation }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const spin  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.07, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1800, useNativeDriver: true }),
    ])).start();
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 22000, useNativeDriver: true })
    ).start();
  }, []);

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const orbitR  = R + TILE * 0.08;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>SignalFlow</Text>
      <Text style={styles.sub}>Tap a pillar to get started</Text>

      <View style={[styles.diagram, { width: SIZE, height: SIZE }]}>
        {/* Rotating dashed orbit ring */}
        <Animated.View style={[styles.orbit, {
          width: orbitR * 2, height: orbitR * 2,
          borderRadius: orbitR,
          left: CX - orbitR, top: CY - orbitR,
          transform: [{ rotate: spinDeg }],
        }]} />

        {/* Directional arrows between tiles */}
        {ARROWS.map((a, i) => {
          const x = CX + orbitR * Math.cos(toRad(a.angle));
          const y = CY + orbitR * Math.sin(toRad(a.angle));
          return (
            <View key={i} style={[styles.arrow, { left: x - 10, top: y - 10, transform: [{ rotate: a.rotate }] }]}>
              <Ionicons name="chevron-forward" size={18} color={colors.accent + "99"} />
            </View>
          );
        })}

        {/* Four pillar tiles */}
        {TILES.map((tile, i) => {
          const rad = toRad(tile.angle);
          const tx  = CX + R * Math.cos(rad) - TILE / 2;
          const ty  = CY + R * Math.sin(rad) - TILE / 2;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.tile, { left: tx, top: ty, width: TILE, height: TILE, borderColor: tile.color + "66", shadowColor: tile.color }]}
              onPress={() => navigation.navigate(NAV_TARGETS[i])}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: tile.color + "22" }]}>
                <Ionicons name={tile.icon} size={30} color={tile.color} />
              </View>
              <Text style={[styles.tileLabel, { color: tile.color }]}>{tile.label}</Text>
            </TouchableOpacity>
          );
        })}

        {/* Centre logo */}
        <Animated.View style={[styles.center, { transform: [{ scale: pulse }] }]}>
          <Logo size={44} />
          <Text style={styles.centerText}>SignalFlow</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },

  title: { fontSize: 26, fontFamily: "Inter_800ExtraBold", color: colors.textPrimary, letterSpacing: -1, marginBottom: 4 },
  sub:   { fontSize: 13, color: colors.textSecondary, marginBottom: 28 },

  diagram: { position: "relative" },

  orbit: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },

  arrow: { position: "absolute" },

  tile: {
    position: "absolute",
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    padding: 10,
  },
  iconWrap: {
    width: 52, height: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 16,
  },

  center: {
    position: "absolute",
    left: CX - 56, top: CY - 56,
    width: 112, height: 112,
    borderRadius: 56,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  centerText: { fontSize: 10, fontFamily: "Inter_700Bold", color: colors.accent, letterSpacing: 0.5 },
});
