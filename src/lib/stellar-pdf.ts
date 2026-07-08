import jsPDF from "jspdf";
import type { StellarDemoResponse } from "@/data/stellar-demo-data";

/* ─── Professional Audit Report Color Palette ─────────── */
const C = {
  white:     [255, 255, 255] as const,
  offWhite:  [250, 248, 244] as const,
  cream:     [245, 241, 232] as const,
  gold:      [200, 160, 40] as const,      // Hera primary — rich gold
  goldLight: [240, 210, 120] as const,      // Light gold for fills
  goldPale:  [252, 247, 230] as const,      // Very subtle gold tint
  dark:      [30, 28, 24] as const,         // Near-black for body text
  heading:   [20, 18, 14] as const,         // Headings
  body:      [50, 48, 44] as const,         // Body text
  muted:     [120, 115, 108] as const,      // Secondary text
  light:     [180, 175, 168] as const,      // Subtle text
  border:    [210, 205, 196] as const,      // Table borders
  borderL:   [230, 226, 220] as const,      // Light borders
  rowAlt:    [248, 246, 242] as const,      // Alternating row
  success:   [34, 120, 60] as const,        // Green — pass/verified
  successBg: [235, 248, 238] as const,
  danger:    [180, 40, 30] as const,        // Red — fail/rejected
  dangerBg:  [252, 237, 235] as const,
  info:      [40, 90, 160] as const,        // Blue — informational
  infoBg:    [232, 242, 252] as const,
  black:     [0, 0, 0] as const,
};

type RGB = readonly [number, number, number];

function rgb(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function draw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

function truncHash(h: string, n = 8) {
  return h.length <= n * 2 + 3 ? h : `${h.slice(0, n)}...${h.slice(-n)}`;
}

/* ─── Page constants ────────────────────────────────────── */

const PW = 210;   // A4 width mm
const PH = 297;   // A4 height mm
const ML = 20;    // margin left
const MR = 20;
const MT = 28;
const MB = 25;
const CW = PW - ML - MR; // content width

let currentSection = 0;

/* ─── Page helpers ──────────────────────────────────────── */

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > PH - MB) {
    drawFooter(doc);
    doc.addPage();
    drawPageBg(doc);
    return MT;
  }
  return y;
}

function drawPageBg(doc: jsPDF) {
  // Clean white background
  fill(doc, C.white);
  doc.rect(0, 0, PW, PH, "F");
  // Thin gold line at top
  fill(doc, C.gold);
  doc.rect(0, 0, PW, 1.5, "F");
}

function drawFooter(doc: jsPDF) {
  const pageNum = doc.getNumberOfPages();
  // Footer separator
  draw(doc, C.borderL);
  doc.setLineWidth(0.3);
  doc.line(ML, PH - 18, PW - MR, PH - 18);
  // Left: brand
  rgb(doc, C.gold);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("HERA PROTOCOL", ML, PH - 13);
  // Center: doc type
  rgb(doc, C.muted);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Stellar Compliance Audit Report", PW / 2, PH - 13, { align: "center" });
  // Right: page
  rgb(doc, C.body);
  doc.text(`${pageNum}`, PW - MR, PH - 13, { align: "right" });
  // Confidentiality notice
  rgb(doc, C.light);
  doc.setFontSize(5.5);
  doc.text("CONFIDENTIAL — For authorised recipients only", PW / 2, PH - 9, { align: "center" });
}

/* ─── Section heading helpers ───────────────────────────── */

function sectionHeading(doc: jsPDF, y: number, title: string): number {
  currentSection++;
  y = ensureSpace(doc, y, 18);
  // Section number + title
  rgb(doc, C.gold);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`${currentSection}.`, ML, y + 5);
  rgb(doc, C.heading);
  doc.text(title.toUpperCase(), ML + 8, y + 5);
  doc.setFont("helvetica", "normal");
  // Gold underline
  draw(doc, C.gold);
  doc.setLineWidth(0.6);
  doc.line(ML, y + 8, PW - MR, y + 8);
  // Thin border line below
  draw(doc, C.borderL);
  doc.setLineWidth(0.2);
  doc.line(ML, y + 9, PW - MR, y + 9);
  return y + 14;
}

function subHeading(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, 12);
  rgb(doc, C.dark);
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.text(title, ML, y + 4);
  doc.setFont("helvetica", "normal");
  draw(doc, C.borderL);
  doc.setLineWidth(0.15);
  doc.line(ML, y + 6.5, ML + 60, y + 6.5);
  return y + 10;
}

/* ─── Small helpers ─────────────────────────────────────── */

function label(doc: jsPDF, x: number, y: number, text: string) {
  rgb(doc, C.muted);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(text.toUpperCase(), x, y);
}

function fieldValue(doc: jsPDF, x: number, y: number, text: string, color: RGB = C.dark) {
  rgb(doc, color);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(text, x, y);
  doc.setFont("helvetica", "normal");
}

function statusBadge(doc: jsPDF, x: number, y: number, text: string, bg: RGB, fg: RGB): number {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  const tw = doc.getTextWidth(text) + 5;
  fill(doc, bg);
  doc.roundedRect(x, y - 3.2, tw, 5, 1.2, 1.2, "F");
  rgb(doc, fg);
  doc.text(text, x + 2.5, y);
  doc.setFont("helvetica", "normal");
  return tw + 2;
}

function bodyText(doc: jsPDF, x: number, y: number, text: string, maxW?: number): number {
  rgb(doc, C.body);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(text, maxW ?? CW);
  doc.text(lines, x, y);
  return y + lines.length * 3.5;
}

/* ─── Table helper ──────────────────────────────────────── */

interface TableCol {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

function drawTable(
  doc: jsPDF,
  y: number,
  cols: TableCol[],
  rows: string[][],
  rowColors?: (RGB | null)[][],
): number {
  const ROW_H = 6.5;
  const HDR_H = 7.5;

  y = ensureSpace(doc, y, HDR_H + ROW_H * Math.min(rows.length, 2) + 4);

  // Header background
  fill(doc, C.gold);
  doc.rect(ML, y, CW, HDR_H, "F");

  // Header text
  let cx = ML;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  for (const col of cols) {
    rgb(doc, C.white);
    const tx = col.align === "right" ? cx + col.width - 3 : cx + 3;
    doc.text(col.label.toUpperCase(), tx, y + 5, { align: col.align === "right" ? "right" : "left" });
    cx += col.width;
  }
  doc.setFont("helvetica", "normal");
  y += HDR_H;

  // Data rows
  for (let r = 0; r < rows.length; r++) {
    y = ensureSpace(doc, y, ROW_H + 2);

    // Alternating row bg
    if (r % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, ROW_H, "F");
    }

    cx = ML;
    doc.setFontSize(7);
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const cellColor = rowColors?.[r]?.[c] ?? C.body;
      rgb(doc, cellColor);
      const tx = col.align === "right" ? cx + col.width - 3 : cx + 3;
      const cellText = rows[r][c] ?? "";
      doc.text(cellText, tx, y + 4.5, { align: col.align === "right" ? "right" : "left" });
      cx += col.width;
    }

    // Row border
    draw(doc, C.borderL);
    doc.setLineWidth(0.1);
    doc.line(ML, y + ROW_H, PW - MR, y + ROW_H);

    y += ROW_H;
  }

  // Bottom border
  draw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);

  return y + 4;
}

/* ─── KV pair grid ──────────────────────────────────────── */

function kvGrid(
  doc: jsPDF,
  y: number,
  pairs: { label: string; value: string; color?: RGB }[],
  colCount = 3,
): number {
  const colW = CW / colCount;
  for (let i = 0; i < pairs.length; i++) {
    const col = i % colCount;
    const row = Math.floor(i / colCount);
    const cx = ML + col * colW;
    const cy = y + row * 12;

    if (cy + 12 > PH - MB) {
      y = ensureSpace(doc, cy, 14);
    }

    // Light card background for each cell
    fill(doc, C.offWhite);
    doc.roundedRect(cx, cy - 1, colW - 2, 11, 1, 1, "F");

    label(doc, cx + 3, cy + 2.5, pairs[i].label);
    fieldValue(doc, cx + 3, cy + 7.5, pairs[i].value, pairs[i].color ?? C.dark);
  }
  const totalRows = Math.ceil(pairs.length / colCount);
  return y + totalRows * 12 + 3;
}

/* ═══════════════════════════════════════════════════════════
   COVER PAGE
   ═══════════════════════════════════════════════════════════ */

function drawCoverPage(doc: jsPDF, data: StellarDemoResponse) {
  const report = data.report;

  // White background
  fill(doc, C.white);
  doc.rect(0, 0, PW, PH, "F");

  // Top gold band
  fill(doc, C.gold);
  doc.rect(0, 0, PW, 50, "F");

  // Company name in the gold band
  rgb(doc, C.white);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("HERA", ML, 25);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("PROTOCOL", ML + 46, 25);

  // Subtitle in gold band
  rgb(doc, [255, 255, 255, 0.8] as unknown as RGB);
  doc.setFontSize(8);
  doc.text("Blockchain Compliance Infrastructure", ML, 33);

  // Company number (right side)
  rgb(doc, [255, 245, 220] as unknown as RGB);
  doc.setFontSize(7);
  doc.text("Company No. 17324991", PW - MR, 20, { align: "right" });
  doc.text("London, United Kingdom", PW - MR, 25, { align: "right" });

  // Main title area
  let y = 80;

  // Decorative gold line
  draw(doc, C.gold);
  doc.setLineWidth(1);
  doc.line(ML, y, ML + 40, y);

  y += 12;

  rgb(doc, C.heading);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Stellar Network", ML, y);
  y += 10;
  doc.text("Compliance Audit Report", ML, y);

  y += 14;

  // Thin line
  draw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + 80, y);

  y += 10;

  // Report metadata
  const metaItems = [
    { l: "Report ID", v: data.case_id },
    { l: "Network", v: `${report.chain} — ${report.network}` },
    { l: "Mode", v: data.mode.charAt(0).toUpperCase() + data.mode.slice(1) },
    { l: "Generated", v: new Date(report.generated_at).toLocaleString() },
    { l: "Manifest Version", v: report.manifest_version },
    { l: "Total Events Analysed", v: report.total_events.toString() },
  ];

  for (const item of metaItems) {
    rgb(doc, C.muted);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(item.l.toUpperCase(), ML, y);
    rgb(doc, C.dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(item.v, ML + 50, y);
    doc.setFont("helvetica", "normal");
    y += 7;
  }

  // Audit Period box
  y += 8;
  fill(doc, C.goldPale);
  draw(doc, C.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 22, 2, 2, "FD");

  rgb(doc, C.gold);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("AUDIT PERIOD", ML + 5, y + 5.5);
  doc.setFont("helvetica", "normal");

  rgb(doc, C.dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(new Date(report.summary.audit_start).toLocaleString(), ML + 5, y + 12);
  rgb(doc, C.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("to", ML + 5 + doc.getTextWidth(new Date(report.summary.audit_start).toLocaleString()) + 3, y + 12);
  rgb(doc, C.dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(new Date(report.summary.audit_end).toLocaleString(), ML + 5, y + 18);
  doc.setFont("helvetica", "normal");

  // Bottom section — classification + signatures
  y = PH - 80;

  // Classification box
  fill(doc, C.cream);
  doc.roundedRect(ML, y, CW, 14, 1.5, 1.5, "F");
  rgb(doc, C.gold);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CLASSIFICATION: CONFIDENTIAL", ML + 5, y + 6);
  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("This report is intended for authorised compliance personnel only.", ML + 5, y + 11);

  // Bottom gold band
  fill(doc, C.gold);
  doc.rect(0, PH - 30, PW, 30, "F");
  rgb(doc, C.white);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Hera Protocol Limited", ML, PH - 20);
  doc.text("Generated using publicly available on-chain data from the Stellar Horizon API", ML, PH - 15);
  rgb(doc, [255, 245, 220] as unknown as RGB);
  doc.setFontSize(6.5);
  doc.text("heraprotocol.com", PW - MR, PH - 20, { align: "right" });
}

/* ═══════════════════════════════════════════════════════════
   TABLE OF CONTENTS
   ═══════════════════════════════════════════════════════════ */

function drawTocPage(doc: jsPDF) {
  doc.addPage();
  drawPageBg(doc);

  let y = MT;

  // TOC Title
  rgb(doc, C.heading);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("TABLE OF CONTENTS", ML, y + 5);
  draw(doc, C.gold);
  doc.setLineWidth(0.6);
  doc.line(ML, y + 9, ML + 60, y + 9);
  doc.setFont("helvetica", "normal");

  y += 20;

  const sections = [
    { num: "1", title: "Executive Summary", desc: "High-level metrics, volume, and risk overview" },
    { num: "2", title: "SEP Protocol Compliance", desc: "SEP-8, SEP-9, SEP-10, and SEP-12 implementation status" },
    { num: "3", title: "SEP-10 Authentication Sessions", desc: "Web authentication records and verification status" },
    { num: "4", title: "SEP-12 KYC Submissions", desc: "Customer due diligence records with SEP-9 field data" },
    { num: "5", title: "SEP-8 Pre-Settlement Enforcement", desc: "Regulated asset approval decisions and check results" },
    { num: "6", title: "Account Resolution", desc: "Muxed account, G+memo, and G-address resolution mapping" },
    { num: "7", title: "Transaction Timeline", desc: "Chronological ledger of all audited payment events" },
    { num: "8", title: "Travel Rule Compliance", desc: "FATF Travel Rule data for qualifying transactions" },
    { num: "9", title: "Cryptographic Attestation", desc: "Report integrity signature and verification data" },
  ];

  for (const s of sections) {
    // Section number
    rgb(doc, C.gold);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${s.num}.`, ML, y + 4);

    // Title
    rgb(doc, C.dark);
    doc.setFontSize(10);
    doc.text(s.title, ML + 10, y + 4);

    // Dot leader line
    draw(doc, C.borderL);
    doc.setLineWidth(0.1);
    const titleEnd = ML + 10 + doc.getTextWidth(s.title) + 3;
    // Dotted effect with dashes
    for (let dx = titleEnd; dx < PW - MR - 5; dx += 2) {
      doc.line(dx, y + 4, dx + 0.5, y + 4);
    }

    // Description on next line
    doc.setFont("helvetica", "normal");
    rgb(doc, C.muted);
    doc.setFontSize(7.5);
    doc.text(s.desc, ML + 10, y + 9);

    y += 16;
  }

  // Disclaimer at bottom
  y = PH - 50;
  draw(doc, C.borderL);
  doc.setLineWidth(0.2);
  doc.line(ML, y, PW - MR, y);
  y += 5;
  rgb(doc, C.muted);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.text("This report was generated by Hera Protocol compliance infrastructure using publicly available", ML, y);
  doc.text("on-chain data from the Stellar network. Account properties, SEP compliance data, and risk", ML, y + 4);
  doc.text("assessments are derived from live Horizon API and stellar.toml endpoints.", ML, y + 8);
  doc.setFont("helvetica", "normal");

  drawFooter(doc);
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════ */

export function generateStellarPdf(data: StellarDemoResponse) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { report } = data;
  const { summary } = report;
  currentSection = 0;

  // ═══ COVER PAGE ═══
  drawCoverPage(doc, data);

  // ═══ TABLE OF CONTENTS ═══
  drawTocPage(doc);

  // ═══ SECTION 1: EXECUTIVE SUMMARY ═══
  doc.addPage();
  drawPageBg(doc);
  let y = MT;

  y = sectionHeading(doc, y, "Executive Summary");

  y = kvGrid(doc, y, [
    { label: "Audit Period Start", value: new Date(summary.audit_start).toLocaleString() },
    { label: "Audit Period End", value: new Date(summary.audit_end).toLocaleString() },
    { label: "Total Volume (USD)", value: `$${summary.total_volume_usd}`, color: C.gold },
    { label: "Total Payments", value: summary.total_payments.toString() },
    { label: "Unique Accounts", value: summary.unique_accounts.toString() },
    { label: "KYC Coverage", value: summary.kyc_coverage, color: C.success },
    { label: "Unique Assets", value: summary.unique_assets.join(", ") },
    { label: "Sanctions Hits", value: summary.sanctions_hits.toString(), color: summary.sanctions_hits > 0 ? C.danger : C.success },
    { label: "SEP-8 Rejections", value: summary.sep8_rejections.toString(), color: summary.sep8_rejections > 0 ? C.danger : C.success },
  ]);

  // Risk Assessment Summary box
  y = ensureSpace(doc, y, 28);
  const riskLevel = summary.sanctions_hits > 0 ? "HIGH" : summary.sep8_rejections > 0 ? "MEDIUM" : "LOW";
  const riskColor = riskLevel === "HIGH" ? C.danger : riskLevel === "MEDIUM" ? C.gold : C.success;
  const riskBg = riskLevel === "HIGH" ? C.dangerBg : riskLevel === "MEDIUM" ? C.goldPale : C.successBg;

  fill(doc, riskBg);
  draw(doc, riskColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 20, 2, 2, "FD");

  // Left accent stripe
  fill(doc, riskColor);
  doc.rect(ML, y, 3, 20, "F");

  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("OVERALL RISK ASSESSMENT", ML + 8, y + 5);
  doc.setFont("helvetica", "normal");

  rgb(doc, riskColor);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(riskLevel, ML + 8, y + 14);
  doc.setFont("helvetica", "normal");

  rgb(doc, C.body);
  doc.setFontSize(7.5);
  const riskDesc = riskLevel === "LOW"
    ? "No sanctions matches or SEP-8 rejections identified during the audit period."
    : riskLevel === "MEDIUM"
    ? "SEP-8 rejections detected — review pre-settlement enforcement details in Section 5."
    : "Sanctions hits detected — immediate review required. See Sections 5 and 7.";
  doc.text(riskDesc, ML + 40, y + 10);

  y += 26;

  // Event Type Breakdown
  y = subHeading(doc, y, "Event Type Breakdown");
  y += 2;

  const evtEntries = Object.entries(summary.event_type_counts).filter(([, v]) => v > 0);
  const evtTotal = evtEntries.reduce((a, [, v]) => a + v, 0);

  const barColors: Record<string, RGB> = {
    payment: C.gold,
    path_payment: C.info,
    fee: C.light,
    create_account: C.muted,
    clawback: C.danger,
  };

  // Stacked bar
  let barX = ML;
  const BAR_W = CW;
  const BAR_H = 8;
  fill(doc, C.cream);
  doc.roundedRect(ML, y, BAR_W, BAR_H, 2, 2, "F");
  for (const [type, count] of evtEntries) {
    const segW = (count / evtTotal) * BAR_W;
    fill(doc, barColors[type] ?? C.muted);
    doc.rect(barX, y, segW, BAR_H, "F");
    if (segW > 22) {
      rgb(doc, C.white);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(`${type.replace("_", " ").toUpperCase()} (${count})`, barX + 3, y + 5.2);
      doc.setFont("helvetica", "normal");
    }
    barX += segW;
  }

  // Legend below bar
  y += BAR_H + 4;
  let legendX = ML;
  doc.setFontSize(6.5);
  for (const [type] of evtEntries) {
    fill(doc, barColors[type] ?? C.muted);
    doc.rect(legendX, y - 2.5, 3, 3, "F");
    rgb(doc, C.muted);
    doc.text(type.replace("_", " ").toUpperCase(), legendX + 4.5, y);
    legendX += doc.getTextWidth(type.replace("_", " ").toUpperCase()) + 8;
  }

  y += 8;

  // ═══ SECTION 2: SEP PROTOCOL COMPLIANCE ═══
  y = sectionHeading(doc, y, "SEP Protocol Compliance");

  const sepInfo = [
    { sep: "SEP-10", status: "IMPLEMENTED", desc: "Web Authentication — cryptographic challenge-response for account ownership proof" },
    { sep: "SEP-12", status: "IMPLEMENTED", desc: "KYC API — customer data submission with multi-level verification" },
    { sep: "SEP-9", status: "IMPLEMENTED", desc: "Standard KYC/KYB field definitions for Anchor interoperability" },
    { sep: "SEP-8", status: "IMPLEMENTED", desc: "Regulated Assets — pre-settlement approval blocking non-compliant transactions" },
  ];

  for (const s of sepInfo) {
    y = ensureSpace(doc, y, 14);

    // Card background
    fill(doc, C.offWhite);
    doc.roundedRect(ML, y, CW, 10, 1.5, 1.5, "F");

    // Left gold accent
    fill(doc, C.gold);
    doc.rect(ML, y, 2.5, 10, "F");

    // SEP label
    rgb(doc, C.gold);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(s.sep, ML + 6, y + 4);

    // Status badge
    statusBadge(doc, ML + 28, y + 4, s.status, C.successBg, C.success);

    // Description
    doc.setFont("helvetica", "normal");
    rgb(doc, C.body);
    doc.setFontSize(7);
    doc.text(s.desc, ML + 6, y + 8.5);

    y += 13;
  }

  y += 3;

  // ═══ SECTION 3: SEP-10 AUTHENTICATION ═══
  y = sectionHeading(doc, y, "SEP-10 Authentication Sessions");

  y = bodyText(doc, ML, y,
    "Web authentication sessions are verified using the SEP-10 challenge-response protocol. Each session confirms account ownership through cryptographic signatures tied to the account's home domain.",
  );
  y += 3;

  const sep10Cols: TableCol[] = [
    { label: "Account", width: 38 },
    { label: "Memo", width: 18 },
    { label: "Home Domain", width: 34 },
    { label: "Client Domain", width: 34 },
    { label: "Signed At", width: 28 },
    { label: "Status", width: CW - 152 },
  ];
  const sep10Rows = report.sep10_sessions.map((s) => [
    truncHash(s.account, 6),
    s.memo ? `${s.memo_type}:${s.memo}` : "—",
    s.home_domain,
    s.client_domain || "—",
    new Date(s.signed_at).toLocaleDateString(),
    s.verified ? "VERIFIED" : "FAILED",
  ]);
  const sep10Colors = report.sep10_sessions.map((s) => [
    C.dark, C.muted, C.gold, C.muted, C.muted,
    s.verified ? C.success : C.danger,
  ]);
  y = drawTable(doc, y, sep10Cols, sep10Rows, sep10Colors);

  // ═══ SECTION 4: SEP-12 KYC ═══
  y = sectionHeading(doc, y, "SEP-12 KYC Submissions");

  y = bodyText(doc, ML, y,
    "Customer due diligence records submitted via the SEP-12 KYC API. Each submission includes SEP-9 standard fields with individual verification status.",
  );
  y += 3;

  for (const sub of report.sep12_submissions) {
    y = ensureSpace(doc, y, 30);

    // Customer header card
    fill(doc, C.cream);
    doc.roundedRect(ML, y, CW, 9, 1.5, 1.5, "F");
    draw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, 9, 1.5, 1.5, "S");

    // Gold left accent
    fill(doc, C.gold);
    doc.rect(ML, y, 2.5, 9, "F");

    rgb(doc, C.dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(truncHash(sub.account, 8), ML + 6, y + 6);
    doc.setFont("helvetica", "normal");

    if (sub.memo) {
      rgb(doc, C.muted);
      doc.setFontSize(7);
      doc.text(`memo: ${sub.memo}`, ML + 55, y + 6);
    }

    // Status badge
    const statusColor = sub.status === "approved" ? C.success : sub.status === "pending" ? C.gold : C.danger;
    const statusBg2 = sub.status === "approved" ? C.successBg : sub.status === "pending" ? C.goldPale : C.dangerBg;
    const bw = statusBadge(doc, PW - MR - 30, y + 3.8, sub.status.toUpperCase(), statusBg2, statusColor);

    // Level badge
    statusBadge(doc, PW - MR - 30 - bw - 4, y + 3.8, sub.kyc_level.toUpperCase(), C.cream, C.muted);

    y += 12;

    // SEP-9 fields table
    const fieldCols: TableCol[] = [
      { label: "Field (SEP-9)", width: 40 },
      { label: "Value", width: 80 },
      { label: "Status", width: CW - 120 },
    ];
    const fieldRows = sub.fields_provided.map((f) => [
      f.field_name,
      f.value,
      f.status.toUpperCase(),
    ]);
    const fieldColors = sub.fields_provided.map((f) => [
      C.body,
      C.dark,
      f.status === "accepted" ? C.success :
      f.status === "pending" ? C.gold :
      f.status === "needs_info" ? C.gold : C.danger,
    ]);
    y = drawTable(doc, y, fieldCols, fieldRows, fieldColors);
    y += 2;
  }

  // ═══ SECTION 5: SEP-8 ENFORCEMENT ═══
  y = sectionHeading(doc, y, "SEP-8 Pre-Settlement Enforcement");

  y = bodyText(doc, ML, y,
    "Regulated asset transactions are subject to pre-settlement approval. Non-compliant transactions are blocked before settlement, not flagged after the fact. Each approval decision includes sanctions screening, travel rule verification, and threshold compliance checks.",
  );
  y += 3;

  for (const ap of report.sep8_approvals) {
    y = ensureSpace(doc, y, 28);

    const apColor = ap.status === "approved" ? C.success : ap.status === "rejected" ? C.danger : C.gold;
    const apBg = ap.status === "approved" ? C.successBg : ap.status === "rejected" ? C.dangerBg : C.goldPale;
    const cardH = ap.reason ? 24 : 18;

    // Card
    fill(doc, C.white);
    draw(doc, C.border);
    doc.setLineWidth(0.2);
    doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, "FD");

    // Left accent
    fill(doc, apColor);
    doc.rect(ML, y, 3, cardH, "F");

    // Status + hash + asset
    statusBadge(doc, ML + 7, y + 5, ap.status.toUpperCase(), apBg, apColor);
    rgb(doc, C.muted);
    doc.setFontSize(7);
    doc.text(truncHash(ap.tx_hash, 10), ML + 35, y + 5);
    rgb(doc, C.dark);
    doc.setFont("helvetica", "bold");
    doc.text(ap.regulated_asset, PW - MR - 5, y + 5, { align: "right" });
    doc.setFont("helvetica", "normal");

    // Compliance checks
    const cy = y + 12;
    const checks = [
      { l: "Sanctions", v: ap.sanctions_check },
      { l: "Travel Rule", v: ap.travel_rule_check },
      { l: "Threshold", v: ap.amount_threshold_check },
    ];
    let cx = ML + 7;
    for (const ch of checks) {
      const chColor = ch.v ? C.success : C.danger;
      const chIcon = ch.v ? "PASS" : "FAIL";
      statusBadge(doc, cx, cy, `${ch.l}: ${chIcon}`, ch.v ? C.successBg : C.dangerBg, chColor);
      cx += 40;
    }

    if (ap.reason) {
      rgb(doc, C.body);
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      const reasonLines = doc.splitTextToSize(ap.reason, CW - 16);
      doc.text(reasonLines[0], ML + 7, cy + 8);
      doc.setFont("helvetica", "normal");
    }

    y += cardH + 4;
  }

  // ═══ SECTION 6: ACCOUNT RESOLUTION ═══
  y = sectionHeading(doc, y, "Account Resolution");

  y = bodyText(doc, ML, y,
    "Hera resolves G-addresses, M-prefixed muxed accounts, and G+memo pairs to individual customer records. Each account is mapped to a customer ID with associated KYC status and risk rating.",
  );
  y += 3;

  // Collect unique accounts
  const acctMap = new Map<string, StellarDemoResponse["report"]["events"][0]["source_account"]>();
  for (const ev of report.events) {
    if (!acctMap.has(ev.source_account.customer_id)) acctMap.set(ev.source_account.customer_id, ev.source_account);
    if (!acctMap.has(ev.destination_account.customer_id)) acctMap.set(ev.destination_account.customer_id, ev.destination_account);
  }

  const acctCols: TableCol[] = [
    { label: "Display", width: 32 },
    { label: "Form", width: 22 },
    { label: "G-Address", width: 38 },
    { label: "Muxed / Memo", width: 26 },
    { label: "KYC", width: 20 },
    { label: "Risk", width: 18 },
    { label: "Customer ID", width: CW - 156 },
  ];
  const acctRows = Array.from(acctMap.values()).map((a) => [
    a.display,
    a.form === "G_address" ? "G..." : a.form === "M_muxed" ? "M... Muxed" : "G+Memo",
    truncHash(a.g_address, 6),
    a.form === "M_muxed" ? `ID:${a.muxed_id}` : a.form === "G_memo" ? `memo:${a.memo}` : "—",
    a.kyc_status.toUpperCase(),
    a.risk_rating.toUpperCase(),
    a.customer_id,
  ]);
  const acctColors = Array.from(acctMap.values()).map((a) => {
    const formC: RGB = a.form === "M_muxed" ? C.info : a.form === "G_memo" ? C.info : C.gold;
    const kycC: RGB = a.kyc_status === "verified" ? C.success : a.kyc_status === "blocked" ? C.danger : C.gold;
    const riskC: RGB = a.risk_rating === "low" ? C.success : a.risk_rating === "critical" ? C.danger : a.risk_rating === "high" ? C.danger : C.gold;
    return [C.dark, formC, C.muted, C.body, kycC, riskC, C.muted] as RGB[];
  });
  y = drawTable(doc, y, acctCols, acctRows, acctColors);

  // ═══ SECTION 7: TRANSACTION TIMELINE ═══
  y = sectionHeading(doc, y, "Transaction Timeline");

  const txCols: TableCol[] = [
    { label: "Ledger", width: 20 },
    { label: "Time", width: 20 },
    { label: "Type", width: 24 },
    { label: "Asset", width: 14 },
    { label: "Amount", width: 22, align: "right" },
    { label: "From", width: 26 },
    { label: "To", width: 26 },
    { label: "SEP-8", width: 18 },
    { label: "Flags", width: CW - 170 },
  ];
  const txRows = report.events.map((e) => [
    e.ledger.toLocaleString(),
    new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    e.event_type.replace("_", " "),
    e.asset.code,
    parseFloat(e.amount).toLocaleString(),
    e.source_account.display,
    e.destination_account.display,
    e.sep8_approval?.status.toUpperCase() ?? "N/A",
    e.compliance_flags.slice(0, 2).join(", ").replace(/_/g, " ") || "—",
  ]);
  const txColors = report.events.map((e) => {
    const typeC: RGB = e.event_type === "PAYMENT" ? C.gold : e.event_type === "PATH_PAYMENT" ? C.info : C.muted;
    const sep8C: RGB = !e.sep8_approval ? C.muted :
      e.sep8_approval.status === "approved" ? C.success :
      e.sep8_approval.status === "rejected" ? C.danger : C.gold;
    const flagC: RGB = e.compliance_flags.some(f => f.includes("REJECTED") || f.includes("SANCTIONS")) ? C.danger :
      e.compliance_flags.some(f => f.includes("REVISED") || f.includes("PARTIAL")) ? C.gold : C.success;
    return [C.body, C.muted, typeC, C.body, C.body, C.muted, C.muted, sep8C, flagC] as RGB[];
  });
  y = drawTable(doc, y, txCols, txRows, txColors);

  // ═══ SECTION 8: TRAVEL RULE ═══
  const trEvents = report.events.filter((e) => e.travel_rule);
  if (trEvents.length > 0) {
    y = sectionHeading(doc, y, "Travel Rule Compliance");

    y = bodyText(doc, ML, y,
      "FATF Travel Rule data is captured for qualifying transactions exceeding applicable thresholds. Originator and beneficiary VASP information is recorded for regulatory compliance.",
    );
    y += 3;

    const trCols: TableCol[] = [
      { label: "Tx Hash", width: 34 },
      { label: "Originator", width: 34 },
      { label: "Beneficiary", width: 34 },
      { label: "Orig. VASP", width: 34 },
      { label: "Benef. VASP", width: CW - 136 },
    ];
    const trRows = trEvents.map((e) => [
      truncHash(e.tx_hash, 6),
      e.travel_rule!.originator,
      e.travel_rule!.beneficiary,
      e.travel_rule!.originator_vasp,
      e.travel_rule!.beneficiary_vasp,
    ]);
    y = drawTable(doc, y, trCols, trRows);
  }

  // ═══ SECTION 9: CRYPTOGRAPHIC ATTESTATION ═══
  y = sectionHeading(doc, y, "Cryptographic Attestation");

  y = bodyText(doc, ML, y,
    "This report is cryptographically signed to ensure integrity and non-repudiation. The signature below can be used to verify that the report content has not been tampered with after generation.",
  );
  y += 3;

  y = ensureSpace(doc, y, 36);

  // Signature card
  fill(doc, C.offWhite);
  draw(doc, C.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 30, 2, 2, "FD");

  // Gold top stripe on card
  fill(doc, C.gold);
  doc.rect(ML, y, CW, 6, "F");
  rgb(doc, C.white);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("DIGITAL SIGNATURE", ML + 5, y + 4.2);
  doc.setFont("helvetica", "normal");

  const sigY = y + 10;

  label(doc, ML + 5, sigY, "Algorithm");
  fieldValue(doc, ML + 5, sigY + 4.5, report.signature.algorithm.toUpperCase(), C.dark);

  label(doc, ML + CW / 2, sigY, "Signed At");
  fieldValue(doc, ML + CW / 2, sigY + 4.5, new Date(report.signature.signed_at).toLocaleString(), C.dark);

  label(doc, ML + 5, sigY + 10, "Public Key");
  rgb(doc, C.body);
  doc.setFontSize(6.5);
  doc.text(truncHash(report.signature.public_key_hex, 24), ML + 5, sigY + 14);

  label(doc, ML + 5, sigY + 18, "Signature");
  rgb(doc, C.body);
  doc.setFontSize(6.5);
  doc.text(truncHash(report.signature.signature_hex, 24), ML + 5, sigY + 22);

  y += 36;

  // ═══ DISCLAIMER ═══
  y = ensureSpace(doc, y, 24);

  draw(doc, C.gold);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
  y += 5;

  rgb(doc, C.muted);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("DISCLAIMER", ML, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  doc.setFontSize(6);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This report was generated by Hera Protocol compliance infrastructure using publicly available on-chain data from the Stellar network.",
    ML, y,
  );
  doc.text(
    "Account properties, SEP compliance data, and risk assessments are derived from live Horizon API and stellar.toml endpoints.",
    ML, y + 3.5,
  );
  doc.text(
    "This document does not constitute legal or financial advice. Recipients should verify findings independently before taking regulatory action.",
    ML, y + 7,
  );
  doc.setFont("helvetica", "normal");

  // Final footer
  drawFooter(doc);

  // Add footers to all content pages (skip cover)
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p < totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc);
  }

  doc.save(`hera-stellar-${data.mode}-audit-report.pdf`);
}
