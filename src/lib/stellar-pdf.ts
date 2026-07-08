import jsPDF from "jspdf";
import type { StellarDemoResponse } from "@/data/stellar-demo-data";

/* ─── Color palette (RGB) ────────────────────────────── */
const C = {
  bg:        [13, 17, 23] as const,
  card:      [22, 27, 34] as const,
  border:    [48, 54, 61] as const,
  fg:        [230, 237, 243] as const,
  muted:     [125, 133, 144] as const,
  primary:   [240, 192, 64] as const,
  secondary: [88, 166, 255] as const,
  success:   [63, 185, 80] as const,
  danger:    [248, 81, 73] as const,
  white:     [255, 255, 255] as const,
  black:     [0, 0, 0] as const,
};

type RGB = readonly [number, number, number];

function rgb(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function draw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

function truncHash(h: string, n = 8) {
  return h.length <= n * 2 + 3 ? h : `${h.slice(0, n)}...${h.slice(-n)}`;
}

/* ─── Page helpers ───────────────────────────────────── */

const PW = 210;   // A4 width mm
const PH = 297;   // A4 height mm
const ML = 15;    // margin left
const MR = 15;
const MT = 20;
const MB = 22;
const CW = PW - ML - MR; // content width

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  if (y + need > PH - MB) {
    addPageBg(doc);
    doc.addPage();
    drawPageBg(doc);
    return MT;
  }
  return y;
}

function drawPageBg(doc: jsPDF) {
  fill(doc, C.bg);
  doc.rect(0, 0, PW, PH, "F");
}

function addPageBg(doc: jsPDF) {
  // footer on current page before moving on
  drawFooter(doc);
}

function drawFooter(doc: jsPDF) {
  const pageNum = doc.getNumberOfPages();
  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.text(`HERA — Stellar Compliance Report`, ML, PH - 10);
  doc.text(`Page ${pageNum}`, PW - MR, PH - 10, { align: "right" });
  draw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, PH - 14, PW - MR, PH - 14);
}

/* ─── Section helpers ────────────────────────────────── */

function sectionTitle(doc: jsPDF, y: number, text: string, accent: RGB = C.secondary): number {
  y = ensureSpace(doc, y, 14);
  // accent bar
  fill(doc, accent);
  doc.rect(ML, y, 3, 8, "F");
  // title
  rgb(doc, C.fg);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), ML + 7, y + 6);
  doc.setFont("helvetica", "normal");
  // underline
  draw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y + 10, PW - MR, y + 10);
  return y + 14;
}

function label(doc: jsPDF, x: number, y: number, text: string) {
  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(text.toUpperCase(), x, y);
}

function value(doc: jsPDF, x: number, y: number, text: string, color: RGB = C.fg) {
  rgb(doc, color);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(text, x, y);
  doc.setFont("helvetica", "normal");
}

function badge(doc: jsPDF, x: number, y: number, text: string, bgColor: RGB, fgColor: RGB): number {
  doc.setFontSize(7);
  const tw = doc.getTextWidth(text) + 4;
  fill(doc, bgColor);
  doc.roundedRect(x, y - 3.5, tw, 5, 1.2, 1.2, "F");
  rgb(doc, fgColor);
  doc.text(text, x + 2, y);
  return tw + 2;
}

/* ─── Table helper ───────────────────────────────────── */

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
  const ROW_H = 6;
  const HDR_H = 7;

  y = ensureSpace(doc, y, HDR_H + ROW_H * Math.min(rows.length, 3) + 4);

  // header bg
  fill(doc, C.card);
  doc.rect(ML, y, CW, HDR_H, "F");
  draw(doc, C.border);
  doc.setLineWidth(0.2);
  doc.line(ML, y + HDR_H, PW - MR, y + HDR_H);

  // header text
  let cx = ML;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  for (const col of cols) {
    rgb(doc, C.muted);
    const tx = col.align === "right" ? cx + col.width - 2 : cx + 2;
    doc.text(col.label.toUpperCase(), tx, y + 5, { align: col.align === "right" ? "right" : "left" });
    cx += col.width;
  }
  doc.setFont("helvetica", "normal");

  y += HDR_H;

  // rows
  for (let r = 0; r < rows.length; r++) {
    y = ensureSpace(doc, y, ROW_H + 2);

    // alternating row bg
    if (r % 2 === 0) {
      fill(doc, [17, 22, 28]);
      doc.rect(ML, y, CW, ROW_H, "F");
    }

    cx = ML;
    doc.setFontSize(7);
    for (let c = 0; c < cols.length; c++) {
      const col = cols[c];
      const cellColor = rowColors?.[r]?.[c] ?? C.fg;
      rgb(doc, cellColor);
      const tx = col.align === "right" ? cx + col.width - 2 : cx + 2;
      const cellText = rows[r][c] ?? "";
      doc.text(cellText, tx, y + 4.2, { align: col.align === "right" ? "right" : "left" });
      cx += col.width;
    }

    // row border
    draw(doc, [30, 36, 42]);
    doc.setLineWidth(0.15);
    doc.line(ML, y + ROW_H, PW - MR, y + ROW_H);

    y += ROW_H;
  }

  return y + 3;
}

/* ─── KV pair grid ───────────────────────────────────── */

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
    if (col === 0 && i > 0) y += 0; // handled below
    const cx = ML + col * colW;
    const cy = y + row * 10;

    if (cy + 10 > PH - MB) {
      y = ensureSpace(doc, cy, 12);
    }

    label(doc, cx, cy, pairs[i].label);
    value(doc, cx, cy + 4.5, pairs[i].value, pairs[i].color);
  }
  const totalRows = Math.ceil(pairs.length / colCount);
  return y + totalRows * 10 + 2;
}

/* ═══════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════ */

export function generateStellarPdf(data: StellarDemoResponse) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const { report } = data;
  const { summary } = report;

  // ── Page 1 background ──
  drawPageBg(doc);

  // ── Header / Title Block ──
  let y = MT;

  // Top accent bar
  fill(doc, C.secondary);
  doc.rect(0, 0, PW, 3, "F");

  // Logo area
  fill(doc, C.card);
  doc.roundedRect(ML, y, CW, 38, 2, 2, "F");
  draw(doc, C.border);
  doc.roundedRect(ML, y, CW, 38, 2, 2, "S");

  // "HERA" brand
  rgb(doc, C.secondary);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("HERA", ML + 6, y + 12);

  // Subtitle
  rgb(doc, C.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("STELLAR COMPLIANCE AUDIT REPORT", ML + 6, y + 18);

  // Report meta (right side)
  rgb(doc, C.fg);
  doc.setFontSize(8);
  doc.text(`Version ${report.manifest_version}`, PW - MR - 6, y + 10, { align: "right" });
  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.text(`Generated: ${new Date(report.generated_at).toLocaleString()}`, PW - MR - 6, y + 15, { align: "right" });
  doc.text(`Case: ${data.case_id}`, PW - MR - 6, y + 20, { align: "right" });
  doc.text(`Mode: ${data.mode.toUpperCase()}`, PW - MR - 6, y + 25, { align: "right" });

  // Chain badge
  const chainBadgeX = ML + 6;
  fill(doc, C.secondary);
  doc.roundedRect(chainBadgeX, y + 24, 22, 6, 1.5, 1.5, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("STELLAR", chainBadgeX + 2.5, y + 28.2);

  fill(doc, [30, 36, 42]);
  doc.roundedRect(chainBadgeX + 24, y + 24, 22, 6, 1.5, 1.5, "F");
  rgb(doc, C.fg);
  doc.text("MAINNET", chainBadgeX + 26.5, y + 28.2);
  doc.setFont("helvetica", "normal");

  y += 44;

  // ── Executive Summary ──
  y = sectionTitle(doc, y, "Executive Summary");

  y = kvGrid(doc, y, [
    { label: "Audit Period Start", value: new Date(summary.audit_start).toLocaleString() },
    { label: "Audit Period End", value: new Date(summary.audit_end).toLocaleString() },
    { label: "Total Volume (USD)", value: `$${summary.total_volume_usd}`, color: C.secondary },
    { label: "Total Payments", value: summary.total_payments.toString() },
    { label: "Unique Accounts", value: summary.unique_accounts.toString() },
    { label: "KYC Coverage", value: summary.kyc_coverage, color: C.success },
    { label: "Unique Assets", value: summary.unique_assets.join(", ") },
    { label: "Sanctions Hits", value: summary.sanctions_hits.toString(), color: summary.sanctions_hits > 0 ? C.danger : C.success },
    { label: "SEP-8 Rejections", value: summary.sep8_rejections.toString(), color: summary.sep8_rejections > 0 ? C.danger : C.success },
  ]);

  // Event type breakdown mini bar
  y = ensureSpace(doc, y, 20);
  label(doc, ML, y, "Event Type Breakdown");
  y += 5;
  const evtEntries = Object.entries(summary.event_type_counts).filter(([, v]) => v > 0);
  const evtTotal = evtEntries.reduce((a, [, v]) => a + v, 0);
  let barX = ML;
  const BAR_W = CW;
  const BAR_H = 6;
  // background
  fill(doc, C.card);
  doc.roundedRect(ML, y, BAR_W, BAR_H, 1.5, 1.5, "F");
  // segments
  const barColors: Record<string, RGB> = {
    payment: C.secondary,
    path_payment: C.primary,
    fee: C.muted,
    create_account: C.primary,
    clawback: C.danger,
  };
  for (const [type, count] of evtEntries) {
    const segW = (count / evtTotal) * BAR_W;
    fill(doc, barColors[type] ?? C.muted);
    doc.rect(barX, y, segW, BAR_H, "F");
    // label inside if big enough
    if (segW > 20) {
      rgb(doc, C.white);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(`${type.toUpperCase()} (${count})`, barX + 2, y + 4.2);
      doc.setFont("helvetica", "normal");
    }
    barX += segW;
  }
  y += BAR_H + 6;

  // ── SEP Protocol Compliance ──
  y = sectionTitle(doc, y, "SEP Protocol Compliance");

  const sepInfo = [
    { sep: "SEP-10", status: "IMPLEMENTED", desc: "Web Authentication — cryptographic challenge-response for account ownership proof" },
    { sep: "SEP-12", status: "IMPLEMENTED", desc: "KYC API — customer data submission with multi-level verification" },
    { sep: "SEP-9", status: "IMPLEMENTED", desc: "Standard KYC/KYB field definitions for Anchor interoperability" },
    { sep: "SEP-8", status: "IMPLEMENTED", desc: "Regulated Assets — pre-settlement approval blocking non-compliant transactions" },
  ];

  for (const s of sepInfo) {
    y = ensureSpace(doc, y, 10);
    // sep badge
    fill(doc, C.secondary);
    doc.roundedRect(ML, y, 16, 5, 1.2, 1.2, "F");
    rgb(doc, C.white);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(s.sep, ML + 2, y + 3.6);

    // status
    fill(doc, [30, 60, 30]);
    doc.roundedRect(ML + 18, y, 24, 5, 1.2, 1.2, "F");
    rgb(doc, C.success);
    doc.setFontSize(6.5);
    doc.text(s.status, ML + 20, y + 3.6);

    // description
    doc.setFont("helvetica", "normal");
    rgb(doc, C.muted);
    doc.setFontSize(7);
    doc.text(s.desc, ML + 45, y + 3.6);

    y += 8;
  }

  y += 4;

  // ── SEP-10 Authentication Sessions ──
  y = sectionTitle(doc, y, "SEP-10 Authentication Sessions", C.secondary);

  const sep10Cols: TableCol[] = [
    { label: "Account", width: 40 },
    { label: "Memo", width: 20 },
    { label: "Home Domain", width: 35 },
    { label: "Client Domain", width: 35 },
    { label: "Signed At", width: 30 },
    { label: "Status", width: 20 },
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
    C.fg, C.muted, C.secondary, C.muted, C.muted,
    s.verified ? C.success : C.danger,
  ]);
  y = drawTable(doc, y, sep10Cols, sep10Rows, sep10Colors);

  // ── SEP-12 KYC Submissions ──
  y = sectionTitle(doc, y, "SEP-12 KYC Submissions (SEP-9 Fields)", C.primary);

  for (const sub of report.sep12_submissions) {
    y = ensureSpace(doc, y, 30);

    // customer header
    fill(doc, C.card);
    doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, "F");
    draw(doc, C.border);
    doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, "S");

    rgb(doc, C.fg);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(truncHash(sub.account, 8), ML + 4, y + 5.5);
    doc.setFont("helvetica", "normal");

    if (sub.memo) {
      rgb(doc, C.muted);
      doc.setFontSize(7);
      doc.text(`memo: ${sub.memo}`, ML + 55, y + 5.5);
    }

    // status badge
    const statusColor: RGB = sub.status === "approved" ? C.success : sub.status === "pending" ? C.primary : C.danger;
    const bw = badge(doc, PW - MR - 30, y + 3, sub.status.toUpperCase(), [statusColor[0], statusColor[1], statusColor[2]], C.white);

    // level badge
    badge(doc, PW - MR - 30 - bw - 4, y + 3, sub.kyc_level.toUpperCase(), C.card, C.muted);

    y += 11;

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
      C.fg,
      C.fg,
      f.status === "accepted" ? C.success :
      f.status === "pending" ? C.primary :
      f.status === "needs_info" ? C.primary : C.danger,
    ]);
    y = drawTable(doc, y, fieldCols, fieldRows, fieldColors);
    y += 2;
  }

  // ── SEP-8 Pre-Settlement Enforcement ──
  y = sectionTitle(doc, y, "SEP-8 Pre-Settlement Enforcement", C.danger);

  y = ensureSpace(doc, y, 8);
  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.text(
    "Non-compliant transactions are blocked before settlement, not flagged after the fact.",
    ML, y,
  );
  y += 6;

  for (const ap of report.sep8_approvals) {
    y = ensureSpace(doc, y, 22);

    const apColor: RGB = ap.status === "approved" ? C.success : ap.status === "rejected" ? C.danger : C.primary;

    // card bg
    fill(doc, C.card);
    doc.roundedRect(ML, y, CW, ap.reason ? 20 : 14, 1.5, 1.5, "F");

    // left accent
    fill(doc, apColor);
    doc.rect(ML, y, 2.5, ap.reason ? 20 : 14, "F");

    // status + hash
    badge(doc, ML + 6, y + 4, ap.status.toUpperCase(), apColor, C.white);
    rgb(doc, C.muted);
    doc.setFontSize(7);
    doc.text(truncHash(ap.tx_hash, 10), ML + 32, y + 4);
    rgb(doc, C.fg);
    doc.text(ap.regulated_asset, PW - MR - 6, y + 4, { align: "right" });

    // checks row
    const cy = y + 10;
    const checks = [
      { l: "Sanctions", v: ap.sanctions_check },
      { l: "Travel Rule", v: ap.travel_rule_check },
      { l: "Threshold", v: ap.amount_threshold_check },
    ];
    let cx = ML + 6;
    for (const ch of checks) {
      rgb(doc, ch.v ? C.success : C.danger);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.text(`${ch.l}: ${ch.v ? "PASS" : "FAIL"}`, cx, cy);
      doc.setFont("helvetica", "normal");
      cx += 35;
    }

    if (ap.reason) {
      rgb(doc, C.muted);
      doc.setFontSize(6.5);
      const reasonLines = doc.splitTextToSize(ap.reason, CW - 14);
      doc.text(reasonLines[0], ML + 6, cy + 6);
    }

    y += (ap.reason ? 20 : 14) + 4;
  }

  // ── Account Resolution ──
  y = sectionTitle(doc, y, "Muxed Account Resolution", [100, 150, 255]);

  y = ensureSpace(doc, y, 8);
  rgb(doc, C.muted);
  doc.setFontSize(7);
  const resDesc = "Hera resolves G... addresses, M... muxed accounts, and G+memo pairs to individual customer records.";
  doc.text(resDesc, ML, y);
  y += 6;

  // collect unique accounts
  const acctMap = new Map<string, StellarDemoResponse["report"]["events"][0]["source_account"]>();
  for (const ev of report.events) {
    if (!acctMap.has(ev.source_account.customer_id)) acctMap.set(ev.source_account.customer_id, ev.source_account);
    if (!acctMap.has(ev.destination_account.customer_id)) acctMap.set(ev.destination_account.customer_id, ev.destination_account);
  }

  const acctCols: TableCol[] = [
    { label: "Display", width: 35 },
    { label: "Form", width: 22 },
    { label: "G... Address", width: 40 },
    { label: "Muxed/Memo", width: 28 },
    { label: "KYC", width: 20 },
    { label: "Risk", width: 20 },
    { label: "Customer ID", width: CW - 165 },
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
    const formC: RGB = a.form === "M_muxed" ? [100, 150, 255] : a.form === "G_memo" ? C.primary : C.secondary;
    const kycC: RGB = a.kyc_status === "verified" ? C.success : a.kyc_status === "blocked" ? C.danger : C.primary;
    const riskC: RGB = a.risk_rating === "low" ? C.success : a.risk_rating === "critical" ? C.danger : a.risk_rating === "high" ? C.danger : C.primary;
    return [C.fg, formC, C.muted, C.fg, kycC, riskC, C.muted] as RGB[];
  });
  y = drawTable(doc, y, acctCols, acctRows, acctColors);

  // ── Transaction Timeline ──
  y = sectionTitle(doc, y, "Transaction Timeline");

  const txCols: TableCol[] = [
    { label: "Ledger", width: 22 },
    { label: "Time", width: 22 },
    { label: "Type", width: 24 },
    { label: "Asset", width: 14 },
    { label: "Amount", width: 22, align: "right" },
    { label: "From", width: 26 },
    { label: "To", width: 26 },
    { label: "SEP-8", width: 18 },
    { label: "Flags", width: CW - 174 },
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
    const typeC: RGB = e.event_type === "PAYMENT" ? C.secondary : e.event_type === "PATH_PAYMENT" ? C.primary : C.muted;
    const sep8C: RGB = !e.sep8_approval ? C.muted :
      e.sep8_approval.status === "approved" ? C.success :
      e.sep8_approval.status === "rejected" ? C.danger : C.primary;
    const flagC: RGB = e.compliance_flags.some(f => f.includes("REJECTED") || f.includes("SANCTIONS")) ? C.danger :
      e.compliance_flags.some(f => f.includes("REVISED") || f.includes("PARTIAL")) ? C.primary : C.success;
    return [C.fg, C.muted, typeC, C.fg, C.fg, C.muted, C.muted, sep8C, flagC] as RGB[];
  });
  y = drawTable(doc, y, txCols, txRows, txColors);

  // ── Travel Rule Data ──
  const trEvents = report.events.filter((e) => e.travel_rule);
  if (trEvents.length > 0) {
    y = sectionTitle(doc, y, "Travel Rule Compliance");
    const trCols: TableCol[] = [
      { label: "Tx Hash", width: 35 },
      { label: "Originator", width: 35 },
      { label: "Beneficiary", width: 35 },
      { label: "Orig. VASP", width: 35 },
      { label: "Benef. VASP", width: CW - 140 },
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

  // ── Cryptographic Signature ──
  y = sectionTitle(doc, y, "Cryptographic Signature", C.success);

  y = ensureSpace(doc, y, 30);

  fill(doc, [20, 35, 25]);
  doc.roundedRect(ML, y, CW, 24, 2, 2, "F");
  draw(doc, [50, 100, 60]);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, 24, 2, 2, "S");

  label(doc, ML + 5, y + 5, "Algorithm");
  value(doc, ML + 5, y + 9.5, report.signature.algorithm.toUpperCase(), C.success);

  label(doc, ML + 5, y + 14, "Public Key");
  value(doc, ML + 5, y + 18.5, truncHash(report.signature.public_key_hex, 20), C.fg);

  label(doc, ML + CW / 2, y + 5, "Signed At");
  value(doc, ML + CW / 2, y + 9.5, new Date(report.signature.signed_at).toLocaleString(), C.fg);

  label(doc, ML + CW / 2, y + 14, "Signature");
  value(doc, ML + CW / 2, y + 18.5, truncHash(report.signature.signature_hex, 20), C.fg);

  y += 28;

  // ── Disclaimer ──
  y = ensureSpace(doc, y, 16);
  draw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.line(ML, y, PW - MR, y);
  y += 4;
  rgb(doc, C.muted);
  doc.setFontSize(6);
  doc.text(
    "This report was generated by Hera Protocol compliance infrastructure using publicly available on-chain data from the Stellar network.",
    ML, y,
  );
  doc.text(
    "Account properties, SEP compliance data, and risk assessments are derived from live Horizon API and stellar.toml endpoints.",
    ML, y + 4,
  );

  // Final footer
  drawFooter(doc);

  // Add footers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p < totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc);
  }

  doc.save(`hera-stellar-${data.mode}-audit-report.pdf`);
}
