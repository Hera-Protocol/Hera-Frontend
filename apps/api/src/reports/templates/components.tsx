import { Path, Svg, Text, View } from "@react-pdf/renderer";
import type { RiskBand } from "@hera/core";
import type { ReactNode } from "react";
import type { SnapshotHeader } from "../snapshot";
import { FONTS, INK, MUTED, RISK, RULE_LIGHT, s } from "./theme";

/** The Hera H mark, drawn as a vector from its 100×100 path. */
export const H_MARK_PATH =
  "M0 0H44.6V7.7H0zM55.3 0H100V7.7H55.3zM0 0H7.8V100H0zM0 92.3H44.6V100H0zM55.3 92.3H100V100H55.3zM92.2 0H100V100H92.2zM36.8 0H44.6V44.6H36.8zM36.8 36.8H63V44.6H36.8zM55.3 0H63V44.6H55.3zM55.3 18.4H81.5V26.1H55.3zM73.7 18.4H81.5V81.5H73.7zM36.8 55.4H63V63.1H36.8zM36.8 55.4H44.6V100H36.8zM55.3 55.4H63V100H55.3zM18.4 18.4H26.1V81.5H18.4zM18.4 73.8H44.6V81.5H18.4z";

export function HMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={H_MARK_PATH} fill={INK} />
    </Svg>
  );
}

const utc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;

export function ReportHeader({ header, scopeLabel }: { header: SnapshotHeader; scopeLabel: string }) {
  const meta: [string, string][] = [
    ["Organization", header.org.name],
    [scopeLabel, header.scope],
    ["Reference", header.reference],
    ["Generated", utc(header.generatedAt)],
    ["Requested by", header.requestedBy],
    ["Engine version", header.engineVersion],
  ];
  return (
    <View>
      <View style={[s.row, { alignItems: "center", marginBottom: 14 }]}>
        <HMark size={26} />
        <Text style={{ fontSize: 15, fontWeight: 700, marginLeft: 8, letterSpacing: -0.3 }}>hera</Text>
        <Text style={[s.small, { marginLeft: "auto" }]}>Compliance report</Text>
      </View>
      <Text style={s.h1}>{header.title}</Text>
      <View style={[s.box, { marginTop: 8, flexDirection: "row", flexWrap: "wrap", paddingBottom: 4 }]}>
        {meta.map(([label, value]) => (
          <View key={label} style={{ width: "33.33%", marginBottom: 6, paddingRight: 6 }}>
            <Text style={s.small}>{label}</Text>
            <Text style={label === "Reference" || label === "Engine version" ? [s.mono, { fontWeight: 500 }] : { fontWeight: 500 }}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const A4_HEIGHT = 841.89;
const FOOTER_BOTTOM = 24;

/**
 * Fixed footer on every page: reference, JSON hash, verify link, page x of y.
 * Two react-pdf quirks shape this: the dynamic "Page x of y" text must sit in its
 * own fixed View (inside a flex row it drops the whole footer), and it must be
 * anchored with `top`, because `bottom` is resolved against the full content
 * height on multi-page documents and lands off the page.
 */
export function ReportFooter({ header, jsonSha256 }: { header: SnapshotHeader; jsonSha256: string }) {
  return (
    <>
      <View fixed style={{ position: "absolute", left: 40, right: 40, bottom: FOOTER_BOTTOM, borderTopWidth: 2, borderTopColor: INK, paddingTop: 5 }}>
        <View style={s.row}>
          <Text style={[s.mono, { fontSize: 7, fontWeight: 500 }]}>{header.reference}</Text>
          <Text style={[s.mono, { fontSize: 7, color: MUTED, marginLeft: 8 }]}>JSON SHA-256 {jsonSha256}</Text>
        </View>
        <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>Verify: {header.verifyUrl}</Text>
      </View>
      <View fixed style={{ position: "absolute", right: 40, width: 120, top: A4_HEIGHT - FOOTER_BOTTOM - 12 }}>
        <Text style={{ fontSize: 7, textAlign: "right" }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  );
}

export function Section({ title, children, breakBefore }: { title: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <View break={breakBefore}>
      <Text style={s.h2} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function BandPill({ band }: { band: RiskBand }) {
  return (
    <Text style={{ color: RISK[band].fg, backgroundColor: RISK[band].tint, fontWeight: 700, fontSize: 8, paddingHorizontal: 4, paddingVertical: 1, textTransform: "uppercase" }}>
      {band}
    </Text>
  );
}

export interface Column {
  label: string;
  /** Relative width. */
  flex?: number;
  align?: "left" | "right" | "center";
  mono?: boolean;
}

export type Cell = string | number | { text: string; band?: RiskBand; bold?: boolean };

const cellText = (cell: Cell) => (typeof cell === "object" ? cell.text : String(cell));

export function Table({ columns, rows, empty = "None in this report." }: { columns: Column[]; rows: Cell[][]; empty?: string }) {
  if (rows.length === 0) return <Text style={[s.muted, { marginBottom: 6 }]}>{empty}</Text>;
  return (
    <View style={{ borderWidth: 2, borderColor: INK, borderRadius: 4, marginBottom: 6 }}>
      <View style={[s.row, { borderBottomWidth: 2, borderBottomColor: INK }]} fixed={false}>
        {columns.map((col) => (
          <Text key={col.label} style={{ flex: col.flex ?? 1, padding: 4, fontWeight: 700, fontSize: 8, textAlign: col.align ?? "left" }}>
            {col.label}
          </Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} wrap={false} style={[s.row, i > 0 ? { borderTopWidth: 0.75, borderTopColor: RULE_LIGHT } : {}]}>
          {row.map((cell, j) => {
            const col = columns[j]!;
            const band = typeof cell === "object" ? cell.band : undefined;
            const bold = typeof cell === "object" ? cell.bold : false;
            return (
              <Text
                key={j}
                style={{
                  flex: col.flex ?? 1,
                  padding: 4,
                  fontSize: col.mono ? 7.5 : 8.5,
                  fontFamily: col.mono ? FONTS.mono : FONTS.sans,
                  textAlign: col.align ?? "left",
                  fontWeight: bold ? 700 : 400,
                  ...(band ? { color: RISK[band].fg, backgroundColor: RISK[band].tint, fontWeight: 700 } : {}),
                }}
              >
                {cellText(cell)}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Label/value pairs in a ruled box. */
export function KeyValues({ rows, labelWidth = 120 }: { rows: [string, string, { mono?: boolean }?][]; labelWidth?: number }) {
  return (
    <View style={{ borderWidth: 2, borderColor: INK, borderRadius: 4, marginBottom: 6 }}>
      {rows.map(([label, value, opts], i) => (
        <View key={label + i} wrap={false} style={[s.row, i > 0 ? { borderTopWidth: 0.75, borderTopColor: RULE_LIGHT } : {}]}>
          <Text style={{ width: labelWidth, padding: 4, color: MUTED, fontSize: 8 }}>{label}</Text>
          <Text style={{ flex: 1, padding: 4, ...(opts?.mono ? { fontFamily: FONTS.mono, fontSize: 7.5 } : {}) }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Kpis({ items }: { items: { label: string; value: string; band?: RiskBand }[] }) {
  return (
    <View style={[s.row, { marginBottom: 4 }]}>
      {items.map((item, i) => (
        <View key={item.label} style={[s.box, { flex: 1, marginLeft: i === 0 ? 0 : 6, padding: 7, ...(item.band ? { backgroundColor: RISK[item.band].tint } : {}) }]}>
          <Text style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1, ...(item.band ? { color: RISK[item.band].fg } : {}) }}>{item.value}</Text>
          <Text style={[s.small, { marginTop: 2 }]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** `GABC…WXYZ` / `0x1234…abcd`, for narrow table cells. The JSON snapshot keeps the full value. */
export function short(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export const dateTime = utc;
