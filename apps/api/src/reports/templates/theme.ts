import { existsSync } from "node:fs";
import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";
import type { RiskBand } from "@hera/core";
import { PACKAGE_ROOT } from "../../config/config";

/** Print-safe Hera: white page, ink text, 2px ink rules, colour reserved for risk. */
export const INK = "#17130F";
export const MUTED = "#5C5348";
export const RULE_LIGHT = "#D9D2C7";
export const RISK: Record<RiskBand, { fg: string; tint: string }> = {
  low: { fg: "#137A4A", tint: "#E6F3EC" },
  medium: { fg: "#9A5C00", tint: "#FBF0DC" },
  high: { fg: "#C2410C", tint: "#FDEBDF" },
  severe: { fg: "#B91C1C", tint: "#FBE4E4" },
};

const FONT_DIR = path.join(PACKAGE_ROOT, "assets", "fonts");
const font = (file: string) => path.join(FONT_DIR, file);

/** DM Sans / DM Mono (OFL, in assets/fonts) when present, Helvetica / Courier otherwise. */
export const FONTS = (() => {
  const files = ["DMSans-Regular.ttf", "DMSans-Medium.ttf", "DMSans-Bold.ttf", "DMMono-Regular.ttf", "DMMono-Medium.ttf"];
  if (!files.every((f) => existsSync(font(f)))) return { sans: "Helvetica", mono: "Courier", embedded: false };
  Font.register({
    family: "DM Sans",
    fonts: [
      { src: font("DMSans-Regular.ttf"), fontWeight: 400 },
      { src: font("DMSans-Medium.ttf"), fontWeight: 500 },
      { src: font("DMSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "DM Mono",
    fonts: [
      { src: font("DMMono-Regular.ttf"), fontWeight: 400 },
      { src: font("DMMono-Medium.ttf"), fontWeight: 500 },
    ],
  });
  return { sans: "DM Sans", mono: "DM Mono", embedded: true };
})();

// Addresses and hashes must never be split with a hyphen that isn't in the data.
Font.registerHyphenationCallback((word) => [word]);

export const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 78, paddingHorizontal: 40, fontFamily: FONTS.sans, fontSize: 9, color: INK, backgroundColor: "#FFFFFF", lineHeight: 1.35 },
  h1: { fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 },
  h2: { fontSize: 12, fontWeight: 700, lineHeight: 1.2, marginTop: 16, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 2, borderBottomColor: INK },
  h3: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 4 },
  p: { marginBottom: 5 },
  muted: { color: MUTED },
  small: { fontSize: 7.5, color: MUTED },
  mono: { fontFamily: FONTS.mono, fontSize: 8 },
  box: { borderWidth: 2, borderColor: INK, borderRadius: 4, padding: 10 },
  row: { flexDirection: "row" },
});
