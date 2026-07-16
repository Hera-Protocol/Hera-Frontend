import jsPDF from "jspdf";
import type { StellarDemoResponse, StellarDemoEvent } from "@/data/stellar-demo-data";

/* ─── Color Palette (matches Wenjing's TFR template) ─── */
const C = {
  white:      [255, 255, 255] as const,
  navy:       [26, 35, 64] as const,
  bodyText:   [50, 50, 55] as const,
  heading:    [26, 35, 64] as const,
  muted:      [120, 120, 130] as const,
  border:     [200, 200, 210] as const,
  borderL:    [220, 222, 230] as const,
  rowAlt:     [245, 246, 250] as const,
  sectionBg:  [26, 35, 64] as const,
  // Status badge colors
  complete:   [34, 120, 60] as const,     // Green
  completeBg: [220, 240, 225] as const,
  partial:    [200, 130, 30] as const,    // Orange
  partialBg:  [252, 243, 225] as const,
  missing:    [180, 40, 30] as const,     // Red
  missingBg:  [250, 230, 228] as const,
  clear:      [40, 100, 160] as const,    // Blue
  clearBg:    [225, 238, 252] as const,
  hit:        [180, 40, 30] as const,
  hitBg:      [250, 230, 228] as const,
  pass:       [34, 120, 60] as const,
  passBg:     [220, 240, 225] as const,
  review:     [200, 130, 30] as const,
  reviewBg:   [252, 243, 225] as const,
  blocked:    [180, 40, 30] as const,
  blockedBg:  [250, 230, 228] as const,
  // Data source
  dsLabel:    [180, 40, 30] as const,
  dsBg:       [245, 242, 238] as const,
  dsText:     [90, 90, 100] as const,
};

type RGB = readonly [number, number, number];
function rgb(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function draw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

const PW = 210;
const PH = 297;
const ML = 18;
const MR = 18;
const MT = 30;
const MB = 28;
const CW = PW - ML - MR;

function truncAddr(a: string, n = 6) {
  return a.length <= n * 2 + 3 ? a : `${a.slice(0, n)}...${a.slice(-4)}`;
}

/* ─── Header / Footer ─── */

function drawHeader(doc: jsPDF, pageNum: number) {
  fill(doc, C.navy);
  doc.rect(0, 0, PW, 14, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("HERA PROTOCOL  |  CONFIDENTIAL COMPLIANCE REPORT", ML, 9);
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${pageNum}`, PW - MR, 9, { align: "right" });
}

function drawFooterBar(doc: jsPDF) {
  const footY = PH - 16;
  fill(doc, C.navy);
  doc.rect(0, footY, PW, 16, "F");
  rgb(doc, [180, 185, 200] as unknown as RGB);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text(
    "\u00A9 2026 Hera Protocol  |  contact@heralayer.com  |  heralayer.com  |  CONFIDENTIAL \u2014 For Authorized Recipients Only",
    PW / 2, footY + 9, { align: "center" },
  );
}

function ensureSpace(doc: jsPDF, y: number, need: number, pc: { n: number }): number {
  if (y + need > PH - MB) {
    doc.addPage();
    pc.n++;
    drawHeader(doc, pc.n);
    drawFooterBar(doc);
    return MT;
  }
  return y;
}

function sectionBox(doc: jsPDF, y: number, title: string, pc: { n: number }): number {
  y = ensureSpace(doc, y, 14, pc);
  fill(doc, C.sectionBg);
  doc.rect(ML, y, CW, 10, "F");
  rgb(doc, C.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, ML + 5, y + 7);
  doc.setFont("helvetica", "normal");
  return y + 14;
}

function dataSourceBox(doc: jsPDF, y: number, text: string, pc: { n: number }): number {
  y = ensureSpace(doc, y, 20, pc);
  const lines = doc.splitTextToSize(text, CW - 36);
  const boxH = Math.max(14, lines.length * 3.5 + 8);
  fill(doc, C.dsBg);
  doc.rect(ML, y, CW, boxH, "F");
  fill(doc, C.dsLabel);
  doc.rect(ML + 3, y + 3, 26, 7, "F");
  rgb(doc, C.white);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("DATA SOURCE", ML + 5, y + 8);
  doc.setFont("helvetica", "normal");
  rgb(doc, C.dsText);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text(lines, ML + 33, y + 7.5);
  doc.setFont("helvetica", "normal");
  return y + boxH + 4;
}

function colorBadge(doc: jsPDF, x: number, y: number, text: string, bg: RGB, fg: RGB, minW = 20): number {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  const w = Math.max(doc.getTextWidth(text) + 6, minW);
  fill(doc, bg);
  doc.roundedRect(x, y - 3.5, w, 6, 1.5, 1.5, "F");
  rgb(doc, fg);
  doc.text(text, x + w / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  return w;
}

function metaTable(doc: jsPDF, y: number, rows: [string, string][]): number {
  for (const [label, value] of rows) {
    fill(doc, C.rowAlt);
    doc.rect(ML + 10, y, 50, 8, "F");
    draw(doc, C.borderL);
    doc.setLineWidth(0.2);
    doc.rect(ML + 10, y, 50, 8, "S");
    rgb(doc, C.muted);
    doc.setFontSize(8);
    doc.text(label, ML + 14, y + 5.5);

    fill(doc, C.white);
    doc.rect(ML + 60, y, CW - 60, 8, "F");
    draw(doc, C.borderL);
    doc.rect(ML + 60, y, CW - 60, 8, "S");
    rgb(doc, C.heading);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(value, ML + 64, y + 5.5);
    doc.setFont("helvetica", "normal");
    y += 8;
  }
  return y + 4;
}

/* ─── Classify each event for TFR ─── */

interface TfrClassified {
  event: StellarDemoEvent;
  fields: "COMPLETE" | "PARTIAL" | "MISSING";
  sanctions: "CLEAR" | "HIT";
  result: "PASS" | "REVIEW" | "BLOCKED";
}

function classifyEvents(events: StellarDemoEvent[]): TfrClassified[] {
  return events
    .filter(e => e.event_type !== "FEE")
    .map(e => {
      let fields: TfrClassified["fields"] = "COMPLETE";
      let sanctions: TfrClassified["sanctions"] = "CLEAR";
      let result: TfrClassified["result"] = "PASS";

      if (e.compliance_flags.includes("SANCTIONS_HIT")) {
        fields = "MISSING";
        sanctions = "HIT";
        result = "BLOCKED";
      } else if (e.compliance_flags.some(f => f.includes("PARTIAL"))) {
        fields = "PARTIAL";
        result = "REVIEW";
      } else if (!e.travel_rule) {
        fields = "MISSING";
        result = "REVIEW";
      }

      return { event: e, fields, sanctions, result };
    });
}

/* ═══════════════════════════════════════════════════════
   COVER PAGE
   ═══════════════════════════════════════════════════════ */

function drawCoverPage(doc: jsPDF, data: StellarDemoResponse, reportId: string): { n: number } {
  const pc = { n: 1 };
  drawHeader(doc, 1);
  drawFooterBar(doc);

  let y = 36;

  // Logo
  fill(doc, C.navy);
  doc.roundedRect(PW / 2 - 16, y, 32, 32, 3, 3, "F");
  rgb(doc, C.white);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("H", PW / 2, y + 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 40;

  // Title
  rgb(doc, C.navy);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("HERA PROTOCOL", PW / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.text("TRAVEL RULE (TFR) TRANSACTION COMPLIANCE REPORT", PW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 5;
  rgb(doc, C.muted);
  doc.setFontSize(8);
  doc.text("Regulation (EU) 2023/1113  \u2022  EBA Travel Rule Guidelines  \u2022  MiCA-aligned recordkeeping", PW / 2, y, { align: "center" });

  y += 14;

  const { summary } = data.report;
  const now = new Date();

  y = metaTable(doc, y, [
    ["Report ID", reportId],
    ["Report Type", "Transaction-level Travel Rule compliance record"],
    ["Prepared by", "Hera Protocol Compliance Engine"],
    ["Reporting Entity (CASP)", "Demo CASP Entity  \u2022  LEI: N/A"],
    ["CASP Role in Period", "Originator CASP / Beneficiary CASP"],
    ["Reporting Period", `${new Date(summary.audit_start).toLocaleDateString("en-GB")} \u2013 ${new Date(summary.audit_end).toLocaleDateString("en-GB")}`],
    ["Networks Covered", data.report.chain],
    ["Date Issued", `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC`],
    ["Confidentiality", "CONFIDENTIAL \u2014 Regulator / Authorised Recipient Use"],
    ["Prepared For", "Internal audit file"],
  ]);

  y += 4;
  y = dataSourceBox(doc, y,
    "This is a technical compliance record. Originator/beneficiary identity data is supplied by the reporting CASP from its own KYC systems; on-chain transfer facts are independently verified by Hera against public ledger data; sanctions results derive from official published lists. Field-level provenance is marked throughout.",
    pc,
  );

  return pc;
}

/* ═══════════════════════════════════════════════════════
   SECTION 1: REGULATORY BASIS & SCOPE
   ═══════════════════════════════════════════════════════ */

function drawRegulatoryBasis(doc: jsPDF, pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "1. REGULATORY BASIS & SCOPE", pc);

  // Intro paragraph
  rgb(doc, C.bodyText);
  doc.setFontSize(8);
  const intro = doc.splitTextToSize(
    "This report evidences the reporting entity\u2019s compliance with the information obligations for transfers of crypto-assets under Regulation (EU) 2023/1113 (the recast Transfer of Funds Regulation, \u201CTFR\u201D), as elaborated by the EBA Travel Rule Guidelines, and supports the recordkeeping duties applicable to authorised CASPs under the MiCA framework. Each transfer in the reporting period is assessed for the presence, completeness and consistency of the originator and beneficiary information required to travel with the transfer.",
    CW - 4,
  );
  doc.text(intro, ML + 2, y);
  y += intro.length * 3.5 + 4;

  // Key rule callout
  y = ensureSpace(doc, y, 16, pc);
  fill(doc, C.rowAlt);
  draw(doc, C.borderL);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, 14, "FD");
  rgb(doc, C.heading);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Key applied rule: ", ML + 4, y + 5);
  doc.setFont("helvetica", "normal");
  rgb(doc, C.bodyText);
  const ruleText = doc.splitTextToSize(
    "The EU TFR applies a zero monetary threshold to crypto-asset transfers \u2014 the originator/beneficiary information requirement is triggered for every transfer regardless of value. A separate EUR 1,000 threshold applies only to the additional ownership-verification step for transfers to or from a self-hosted address.",
    CW - 12,
  );
  doc.text(ruleText, ML + 4, y + 9);
  y += 18;

  // Required Information Fields table (Art. 14-16)
  rgb(doc, C.heading);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Required Information Fields Assessed (Art. 14\u201316)", ML, y + 4);
  doc.setFont("helvetica", "normal");
  y += 10;

  const fields: [string, string, string][] = [
    ["Originator", "Full name (natural or legal person)", "Art. 14(1)(a)"],
    ["Originator", "Distributed-ledger address / crypto-asset account number", "Art. 14(1)(b)"],
    ["Originator", "One of: residential address / official personal document no. / customer ID / date & place of birth", "Art. 14(1)(c)"],
    ["Beneficiary", "Full name (natural or legal person)", "Art. 14(2)(a)"],
    ["Beneficiary", "Distributed-ledger address / crypto-asset account number", "Art. 14(2)(b)"],
    ["Self-hosted", "Ownership/control verification where transfer > EUR 1,000", "Art. 19b / EBA GL"],
  ];

  // Table header
  const fCols = [28, 110, 36];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Party", ML + 4, y + 5.5);
  doc.text("Mandatory field", ML + fCols[0] + 4, y + 5.5);
  doc.text("Basis", ML + fCols[0] + fCols[1] + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  y += 8;

  for (let i = 0; i < fields.length; i++) {
    const rowH = 9;
    y = ensureSpace(doc, y, rowH + 2, pc);
    if (i % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, rowH, "F");
    }
    draw(doc, C.borderL);
    doc.setLineWidth(0.15);
    doc.line(ML, y + rowH, ML + CW, y + rowH);

    rgb(doc, C.heading);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(fields[i][0], ML + 4, y + 6);
    doc.setFont("helvetica", "normal");

    rgb(doc, C.bodyText);
    doc.setFontSize(7);
    const fieldLines = doc.splitTextToSize(fields[i][1], fCols[1] - 8);
    doc.text(fieldLines[0], ML + fCols[0] + 4, y + 6);

    rgb(doc, C.muted);
    doc.text(fields[i][2], ML + fCols[0] + fCols[1] + 4, y + 6);

    y += rowH;
  }

  y += 6;
  y = dataSourceBox(doc, y,
    "Field definitions: Regulation (EU) 2023/1113, Articles 14\u201316, and EBA Guidelines EBA/GL/2024/11. Reproduced as the assessment standard; not client data.",
    pc,
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION 2: REPORTING-PERIOD SUMMARY
   ═══════════════════════════════════════════════════════ */

function drawPeriodSummary(doc: jsPDF, data: StellarDemoResponse, classified: TfrClassified[], pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "2. REPORTING-PERIOD SUMMARY", pc);

  const total = classified.length;
  const passCount = classified.filter(c => c.result === "PASS").length;
  const partialCount = classified.filter(c => c.fields === "PARTIAL").length;
  const failCount = classified.filter(c => c.result === "BLOCKED" || (c.fields === "MISSING" && c.result !== "BLOCKED")).length;
  const sanctionsCount = classified.filter(c => c.sanctions === "HIT").length;
  const selfHosted = classified.filter(c => c.event.compliance_flags.includes("EDD_REQUIRED")).length;

  // Top metric cards
  const topMetrics = [
    { label: "TRANSFERS IN SCOPE", value: total.toString() },
    { label: "FULLY COMPLIANT", value: `${passCount} (${Math.round((passCount / Math.max(total, 1)) * 100)}%)` },
    { label: "MISSING / INCOMPLETE", value: `${total - passCount} (${Math.round(((total - passCount) / Math.max(total, 1)) * 100)}%)` },
    { label: "SANCTIONS HITS", value: sanctionsCount.toString() },
  ];

  const cardW = CW / 4;
  fill(doc, C.rowAlt);
  doc.rect(ML, y, CW, 16, "F");
  draw(doc, C.borderL);
  doc.setLineWidth(0.2);
  doc.rect(ML, y, CW, 16, "S");

  for (let i = 0; i < topMetrics.length; i++) {
    const cx = ML + i * cardW;
    if (i > 0) {
      draw(doc, C.borderL);
      doc.line(cx, y + 2, cx, y + 14);
    }
    rgb(doc, C.muted);
    doc.setFontSize(6.5);
    doc.text(topMetrics[i].label, cx + cardW / 2, y + 5.5, { align: "center" });
    rgb(doc, C.navy);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(topMetrics[i].value, cx + cardW / 2, y + 13, { align: "center" });
    doc.setFont("helvetica", "normal");
  }
  y += 22;

  // Outcome Breakdown table
  rgb(doc, C.heading);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Outcome Breakdown", ML, y + 4);
  doc.setFont("helvetica", "normal");
  y += 10;

  const outcomes = [
    { outcome: "PASS \u2014 all required fields present & consistent", count: passCount, share: `${Math.round((passCount / Math.max(total, 1)) * 100)}%`, handling: "Executed / recorded" },
    { outcome: "PARTIAL \u2014 non-critical field missing", count: partialCount, share: `${Math.round((partialCount / Math.max(total, 1)) * 100)}%`, handling: "Risk-based: monitor / request info" },
    { outcome: "FAIL \u2014 critical field missing or invalid", count: failCount - sanctionsCount, share: `${Math.round(((failCount - sanctionsCount) / Math.max(total, 1)) * 100)}%`, handling: "Reject / return / suspend" },
    { outcome: "SANCTIONS HIT \u2014 originator/beneficiary match", count: sanctionsCount, share: `${Math.round((sanctionsCount / Math.max(total, 1)) * 100)}%`, handling: "Blocked; report to FIU" },
    { outcome: "SELF-HOSTED > EUR 1,000 \u2014 verification required", count: selfHosted, share: `${Math.round((selfHosted / Math.max(total, 1)) * 100)}%`, handling: "Ownership check applied" },
  ];

  const oCols = [72, 18, 18, 66];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Compliance outcome", ML + 4, y + 5.5);
  doc.text("Count", ML + oCols[0] + 4, y + 5.5);
  doc.text("Share", ML + oCols[0] + oCols[1] + 4, y + 5.5);
  doc.text("Regulatory handling", ML + oCols[0] + oCols[1] + oCols[2] + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  y += 8;

  for (let i = 0; i < outcomes.length; i++) {
    const row = outcomes[i];
    if (i % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, 8, "F");
    }
    draw(doc, C.borderL);
    doc.setLineWidth(0.15);
    doc.line(ML, y + 8, ML + CW, y + 8);

    rgb(doc, C.heading);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(row.outcome, ML + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    rgb(doc, C.bodyText);
    doc.text(row.count.toString(), ML + oCols[0] + 4, y + 5.5);
    doc.text(row.share, ML + oCols[0] + oCols[1] + 4, y + 5.5);
    rgb(doc, C.muted);
    doc.setFontSize(6.5);
    doc.text(row.handling, ML + oCols[0] + oCols[1] + oCols[2] + 4, y + 5.5);
    y += 8;
  }

  y += 6;
  y = dataSourceBox(doc, y,
    "Counts computed by the Hera rules engine over the reporting entity\u2019s transfer set. Percentages are of transfers in scope.",
    pc,
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION 3: TRANSACTION-LEVEL TRAVEL RULE REGISTER
   ═══════════════════════════════════════════════════════ */

function drawTransactionRegister(doc: jsPDF, data: StellarDemoResponse, classified: TfrClassified[], pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "3. TRANSACTION-LEVEL TRAVEL RULE REGISTER", pc);

  // Intro
  rgb(doc, C.bodyText);
  doc.setFontSize(8);
  const intro = doc.splitTextToSize(
    "The authoritative record. Each transfer is listed with its Travel Rule field-completeness result, counterparty-CASP identification, sanctions-screening outcome and final handling decision. Identity values themselves are held in the reporting entity\u2019s systems and referenced here by KYC record ID to minimise personal-data exposure (GDPR data-minimisation).",
    CW - 4,
  );
  doc.text(intro, ML + 2, y);
  y += intro.length * 3.5 + 6;

  // Table columns matching template exactly
  const tCols = [10, 22, 22, 28, 30, 22, 22, 18];

  // Header
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 9, "F");
  rgb(doc, C.white);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  const headers = ["#", "Date /\nLedger", "Asset /\nAmount", "Originator\n(KYC ref)", "Beneficiary\n(addr / CASP)", "Fields", "Sanctions", "Result"];
  let hx = ML;
  for (let i = 0; i < headers.length; i++) {
    const lines = headers[i].split("\n");
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], hx + 2, y + 4 + li * 3);
    }
    hx += tCols[i];
  }
  doc.setFont("helvetica", "normal");
  y += 9;

  // Data rows
  for (let i = 0; i < classified.length; i++) {
    const c = classified[i];
    const e = c.event;
    const rowH = 10;
    y = ensureSpace(doc, y, rowH + 2, pc);

    if (i % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, rowH, "F");
    }
    draw(doc, C.borderL);
    doc.setLineWidth(0.1);
    doc.line(ML, y + rowH, ML + CW, y + rowH);

    let cx = ML;
    doc.setFontSize(6.5);

    // #
    rgb(doc, C.bodyText);
    doc.text((i + 1).toString(), cx + 2, y + 5);
    cx += tCols[0];

    // Date / Ledger
    rgb(doc, C.bodyText);
    doc.setFontSize(6);
    doc.text(new Date(e.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }), cx + 2, y + 4);
    rgb(doc, C.muted);
    doc.text(`#${e.ledger}`, cx + 2, y + 7.5);
    cx += tCols[1];

    // Asset / Amount
    rgb(doc, C.heading);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(e.asset.code, cx + 2, y + 4);
    doc.setFont("helvetica", "normal");
    rgb(doc, C.bodyText);
    doc.setFontSize(6);
    doc.text(parseFloat(e.amount).toLocaleString(), cx + 2, y + 7.5);
    cx += tCols[2];

    // Originator (KYC ref)
    rgb(doc, C.bodyText);
    doc.setFontSize(6);
    doc.text(e.source_account.customer_id.slice(0, 12), cx + 2, y + 4);
    rgb(doc, C.muted);
    doc.text("name on file", cx + 2, y + 7.5);
    cx += tCols[3];

    // Beneficiary (addr / CASP)
    rgb(doc, C.bodyText);
    doc.setFontSize(6);
    doc.text(truncAddr(e.destination_account.g_address, 5), cx + 2, y + 4);
    rgb(doc, C.muted);
    const vasp = e.travel_rule?.beneficiary_vasp ?? "unknown";
    doc.text(vasp.length > 16 ? vasp.slice(0, 14) + "..." : vasp, cx + 2, y + 7.5);
    cx += tCols[4];

    // Fields badge (color-coded)
    const fieldsBg = c.fields === "COMPLETE" ? C.completeBg : c.fields === "PARTIAL" ? C.partialBg : C.missingBg;
    const fieldsFg = c.fields === "COMPLETE" ? C.complete : c.fields === "PARTIAL" ? C.partial : C.missing;
    colorBadge(doc, cx + 1, y + 5.5, c.fields, fieldsBg, fieldsFg, 18);
    cx += tCols[5];

    // Sanctions badge
    const sanctBg = c.sanctions === "CLEAR" ? C.clearBg : C.hitBg;
    const sanctFg = c.sanctions === "CLEAR" ? C.clear : C.hit;
    colorBadge(doc, cx + 1, y + 5.5, c.sanctions, sanctBg, sanctFg, 16);
    cx += tCols[6];

    // Result badge
    const resBg = c.result === "PASS" ? C.passBg : c.result === "REVIEW" ? C.reviewBg : C.blockedBg;
    const resFg = c.result === "PASS" ? C.pass : c.result === "REVIEW" ? C.review : C.blocked;
    colorBadge(doc, cx + 1, y + 5.5, c.result, resBg, resFg, 16);

    y += rowH;
  }

  y += 4;

  // Note about full register
  rgb(doc, C.muted);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Full register continues for all transfers in the reporting period. A machine-readable export (JSON/CSV, aligned to ESMA structured-reporting format) accompanies this document.",
    ML + 2, y,
  );
  doc.setFont("helvetica", "normal");
  y += 8;

  y = dataSourceBox(doc, y,
    "Transfer facts (date, ledger, asset, amount, addresses): verified by Hera against public on-chain data. Identity references & field completeness: reporting entity KYC systems, evaluated by Hera engine. Sanctions column: official OFAC / EU / UN lists + Scorechain address screening (21+ chains incl. Stellar).",
    pc,
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION 4: MISSING-INFORMATION & COUNTERPARTY HANDLING
   ═══════════════════════════════════════════════════════ */

function drawMissingInfo(doc: jsPDF, classified: TfrClassified[], pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "4. MISSING-INFORMATION & COUNTERPARTY HANDLING", pc);

  rgb(doc, C.bodyText);
  doc.setFontSize(8);
  const intro = doc.splitTextToSize(
    "Under Art. 17 and the EBA Guidelines, a beneficiary/originator CASP must operate risk-based procedures to detect missing or incomplete information and decide whether to execute, reject, return or suspend the transfer, and must escalate repeated failures by a counterparty. This section records each such event and the action taken.",
    CW - 4,
  );
  doc.text(intro, ML + 2, y);
  y += intro.length * 3.5 + 6;

  // Filter non-pass events
  const issues = classified.filter(c => c.result !== "PASS");

  const iCols = [22, 52, 42, 58];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Transfer #", ML + 3, y + 5.5);
  doc.text("Missing / issue", ML + iCols[0] + 3, y + 5.5);
  doc.text("Risk-based action", ML + iCols[0] + iCols[1] + 3, y + 5.5);
  doc.text("Counterparty follow-up", ML + iCols[0] + iCols[1] + iCols[2] + 3, y + 5.5);
  doc.setFont("helvetica", "normal");
  y += 8;

  if (issues.length === 0) {
    fill(doc, C.rowAlt);
    doc.rect(ML, y, CW, 8, "F");
    rgb(doc, C.muted);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.text("No missing-information events in this reporting period.", ML + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    y += 12;
  } else {
    for (let i = 0; i < issues.length; i++) {
      const c = issues[i];
      const e = c.event;
      const rowIdx = classified.indexOf(c) + 1;
      const rowH = 10;
      y = ensureSpace(doc, y, rowH + 2, pc);

      if (i % 2 === 0) {
        fill(doc, C.rowAlt);
        doc.rect(ML, y, CW, rowH, "F");
      }
      draw(doc, C.borderL);
      doc.setLineWidth(0.15);
      doc.line(ML, y + rowH, ML + CW, y + rowH);

      rgb(doc, C.bodyText);
      doc.setFontSize(7);
      doc.text(`#${rowIdx}`, ML + 3, y + 6.5);

      // Determine issue description
      let issue = "";
      let action = "";
      let followup = "";

      if (c.sanctions === "HIT") {
        issue = "Sanctions match on source address";
        action = "Blocked pre-settlement";
        followup = "Reported to competent authority";
      } else if (c.fields === "PARTIAL") {
        issue = "Beneficiary VASP info incomplete";
        action = "Suspended pending info";
        followup = `Info request sent ${new Date(e.timestamp).toLocaleDateString("en-GB")}`;
      } else if (c.fields === "MISSING" && e.compliance_flags.includes("EDD_REQUIRED")) {
        issue = "Self-hosted > \u20AC1,000, no ownership proof";
        action = "Held; ownership check required";
        followup = "Customer attestation pending";
      } else {
        issue = "Travel Rule data missing";
        action = "Risk-based: monitor";
        followup = "Under review";
      }

      rgb(doc, C.heading);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const issueLines = doc.splitTextToSize(issue, iCols[1] - 6);
      doc.text(issueLines[0], ML + iCols[0] + 3, y + 6.5);
      doc.setFont("helvetica", "normal");

      rgb(doc, C.bodyText);
      doc.text(action, ML + iCols[0] + iCols[1] + 3, y + 6.5);
      rgb(doc, C.muted);
      const fuLines = doc.splitTextToSize(followup, iCols[3] - 6);
      doc.text(fuLines[0], ML + iCols[0] + iCols[1] + iCols[2] + 3, y + 6.5);

      y += rowH;
    }
  }

  y += 6;
  y = dataSourceBox(doc, y,
    "Actions recorded by the reporting entity and logged by the Hera engine. Hera does not itself execute, reject or suspend transfers; it evidences the decision the CASP applied.",
    pc,
  );

  // Section 5: Recordkeeping & Data-Protection Attestation
  y += 4;
  y = sectionBox(doc, y, "5. RECORDKEEPING & DATA-PROTECTION ATTESTATION", pc);

  const attestations: [string, string, string][] = [
    ["Originator/beneficiary data retained \u2265 5 years", "TFR Art. 21", "Confirmed"],
    ["Personal data processed for AML/CFT purposes only", "TFR Art. 22 / GDPR", "Confirmed"],
    ["Data-minimisation in this report (IDs, not raw PII)", "GDPR Art. 5", "Applied"],
    ["Audit trail of screening & decisions preserved", "MiCA Art. 68 / EBA GL", "Confirmed"],
  ];

  const aCols = [74, 46, 54];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Requirement", ML + 4, y + 5.5);
  doc.text("Basis", ML + aCols[0] + 4, y + 5.5);
  doc.text("Status", ML + aCols[0] + aCols[1] + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  y += 8;

  for (let i = 0; i < attestations.length; i++) {
    if (i % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, 8, "F");
    }
    draw(doc, C.borderL);
    doc.setLineWidth(0.15);
    doc.line(ML, y + 8, ML + CW, y + 8);

    rgb(doc, C.heading);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(attestations[i][0], ML + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    rgb(doc, C.muted);
    doc.text(attestations[i][1], ML + aCols[0] + 4, y + 5.5);
    rgb(doc, C.complete);
    doc.setFont("helvetica", "bold");
    doc.text(attestations[i][2], ML + aCols[0] + aCols[1] + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    y += 8;
  }

  return y + 4;
}

/* ═══════════════════════════════════════════════════════
   SECTION 6: REPORT AUTHENTICATION
   ═══════════════════════════════════════════════════════ */

function drawAuthentication(doc: jsPDF, data: StellarDemoResponse, reportId: string, pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "6. REPORT AUTHENTICATION", pc);

  const sig = data.report.signature;
  const now = new Date();

  const authRows: [string, string][] = [
    ["Report ID", reportId],
    ["Generated", `${now.toLocaleDateString("en-GB")} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} UTC`],
    ["Prepared by", "Hera Protocol Compliance Engine"],
    ["Reporting Entity (CASP)", "Demo CASP Entity / LEI N/A"],
    ["Document Hash (SHA-256)", sig.public_key_hex.slice(0, 64)],
    ["Cryptographic Signature (ed25519)", sig.signature_hex.slice(0, 64) + "..."],
    ["Verification", `heralayer.com/verify/${reportId}`],
  ];

  for (const [label, value] of authRows) {
    fill(doc, C.rowAlt);
    doc.rect(ML, y, 60, 8, "F");
    draw(doc, C.borderL);
    doc.setLineWidth(0.2);
    doc.rect(ML, y, 60, 8, "S");
    rgb(doc, C.muted);
    doc.setFontSize(7.5);
    doc.text(label, ML + 4, y + 5.5);

    fill(doc, C.white);
    doc.rect(ML + 60, y, CW - 60, 8, "F");
    draw(doc, C.borderL);
    doc.rect(ML + 60, y, CW - 60, 8, "S");
    rgb(doc, C.heading);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    const valText = value.length > 50 ? value.slice(0, 48) + "..." : value;
    doc.text(valText, ML + 64, y + 5.5);
    doc.setFont("helvetica", "normal");
    y += 8;
  }

  y += 8;

  // Section 7: Disclaimer
  y = sectionBox(doc, y, "7. SCOPE, LIMITATIONS & DISCLAIMER", pc);

  const disclaimers = [
    "This report is a technical compliance record intended to support \u2014 not replace \u2014 the reporting entity\u2019s own AML/CFT obligations. Responsibility for executing, rejecting, returning or suspending any transfer, and for the accuracy of originator/beneficiary identity data, remains with the reporting CASP under Regulation (EU) 2023/1113.",
    "Hera Protocol is a compliance-technology provider. It is not a licensed financial institution, law firm, payment/crypto-asset service provider, or regulated compliance advisor, and this report does not constitute legal advice.",
    "Identity and KYC data underlying the Travel Rule assessment are supplied by the reporting entity from its own systems; Hera evaluates completeness and consistency but does not independently verify the identity of the underlying customers.",
    "Sanctions screening reflects official list coverage as at the screening date; lists change frequently and results may differ if re-run. Sanctions screening does not by itself constitute full customer due diligence.",
    "This report is confidential and prepared for the named reporting entity and its competent authority. Redistribution requires written consent from Hera Protocol.",
  ];

  for (const d of disclaimers) {
    y = ensureSpace(doc, y, 14, pc);
    rgb(doc, C.bodyText);
    doc.setFontSize(7.5);
    const bullet = `\u2022  ${d}`;
    const lines = doc.splitTextToSize(bullet, CW - 8);
    doc.text(lines, ML + 4, y);
    y += lines.length * 3.5 + 2;
  }
}

/* ═══════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════ */

export function generateTfrReportPdf(data: StellarDemoResponse) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const reportId = `TFR-2026-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  // Classify all events
  const classified = classifyEvents(data.report.events);

  // Cover page
  const pc = drawCoverPage(doc, data, reportId);

  // Section 1: Regulatory Basis & Scope
  drawRegulatoryBasis(doc, pc);

  // Section 2: Reporting-Period Summary
  drawPeriodSummary(doc, data, classified, pc);

  // Section 3: Transaction-Level Register
  drawTransactionRegister(doc, data, classified, pc);

  // Section 4: Missing Info + Section 5: Recordkeeping
  drawMissingInfo(doc, classified, pc);

  // Section 6: Authentication + Section 7: Disclaimer
  drawAuthentication(doc, data, reportId, pc);

  doc.save(`hera-tfr-transaction-compliance-${reportId}.pdf`);
}
