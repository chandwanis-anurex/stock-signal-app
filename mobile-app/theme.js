export const colors = {
  bg: "#0a0a0f",
  card: "#13131a",
  cardAlt: "#1a1a24",
  border: "#1e1e2e",
  accent: "#FF9F0A",
  accentDim: "#FF9F0A20",
  buy: "#00c805",
  sell: "#ff3b30",
  textPrimary: "#ffffff",
  textSecondary: "#8a8a9a",
  textMuted: "#4a4a5a",
  inputBg: "#1a1a24",
  danger: "#ff3b30",
};

export const fonts = {
  regular:   "Inter_400Regular",
  semiBold:  "Inter_600SemiBold",
  bold:      "Inter_700Bold",
  extraBold: "Inter_800ExtraBold",
};

const base = {
  heading1: { fontFamily: "Inter_800ExtraBold", fontSize: 30, color: colors.textPrimary, letterSpacing: -0.5 },
  heading2: { fontFamily: "Inter_700Bold", fontSize: 22, color: colors.textPrimary },
  heading3: { fontFamily: "Inter_700Bold", fontSize: 17, color: colors.textPrimary },
  body:      { fontFamily: "Inter_400Regular", fontSize: 16, color: colors.textPrimary },
  bodySmall: { fontFamily: "Inter_400Regular", fontSize: 14, color: colors.textSecondary },
  label:     { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 },
  mono:      { fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.textPrimary },
};

export const typography = base;

export const layout = {
  screenPadding: 16,
  cardRadius: 12,
  inputRadius: 8,
  buttonRadius: 10,
};
