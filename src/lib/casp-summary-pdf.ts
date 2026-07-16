import jsPDF from "jspdf";
import type { StellarDemoResponse } from "@/data/stellar-demo-data";

/* ─── Hera Protocol Report Color Palette (matches PDF templates) ─── */
const C = {
  white:      [255, 255, 255] as const,
  navy:       [26, 35, 64] as const,       // Dark navy header/footer
  navyLight:  [40, 52, 85] as const,
  bodyText:   [50, 50, 55] as const,
  heading:    [26, 35, 64] as const,
  muted:      [120, 120, 130] as const,
  border:     [200, 200, 210] as const,
  borderL:    [220, 222, 230] as const,
  rowAlt:     [245, 246, 250] as const,
  sectionBg:  [26, 35, 64] as const,       // Section heading background
  // Rating colors
  good:       [34, 120, 60] as const,
  goodBg:     [34, 120, 60] as const,
  adequate:   [200, 130, 30] as const,
  adequateBg: [200, 130, 30] as const,
  action:     [180, 40, 30] as const,
  actionBg:   [180, 40, 30] as const,
  // Priority colors
  high:       [180, 40, 30] as const,
  medium:     [200, 130, 30] as const,
  low:        [100, 110, 130] as const,
  // Data source box
  dsLabel:    [180, 40, 30] as const,
  dsBg:       [245, 242, 238] as const,
  dsText:     [90, 90, 100] as const,
  black:      [0, 0, 0] as const,
};

type RGB = readonly [number, number, number];
function rgb(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function fill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function draw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

/* ─── Page constants ─── */
const PW = 210;
const PH = 297;
const ML = 18;
const MR = 18;
const MT = 30;
const MB = 28;
const CW = PW - ML - MR;

/* ─── Helpers ─── */

function drawHeader(doc: jsPDF, pageNum: number) {
  // Navy header bar
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
  // Footer line
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

function ensureSpace(doc: jsPDF, y: number, need: number, pageCount: { n: number }): number {
  if (y + need > PH - MB) {
    doc.addPage();
    pageCount.n++;
    drawHeader(doc, pageCount.n);
    drawFooterBar(doc);
    return MT;
  }
  return y;
}

function sectionBox(doc: jsPDF, y: number, title: string, pageCount: { n: number }): number {
  y = ensureSpace(doc, y, 14, pageCount);
  fill(doc, C.sectionBg);
  doc.rect(ML, y, CW, 10, "F");
  rgb(doc, C.white);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, ML + 5, y + 7);
  doc.setFont("helvetica", "normal");
  return y + 14;
}

function dataSourceBox(doc: jsPDF, y: number, text: string, pageCount: { n: number }): number {
  y = ensureSpace(doc, y, 20, pageCount);
  const lines = doc.splitTextToSize(text, CW - 36);
  const boxH = Math.max(14, lines.length * 3.5 + 8);
  fill(doc, C.dsBg);
  doc.rect(ML, y, CW, boxH, "F");
  // Red label
  fill(doc, C.dsLabel);
  doc.rect(ML + 3, y + 3, 26, 7, "F");
  rgb(doc, C.white);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("DATA SOURCE", ML + 5, y + 8);
  doc.setFont("helvetica", "normal");
  // Text
  rgb(doc, C.dsText);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text(lines, ML + 33, y + 7.5);
  doc.setFont("helvetica", "normal");
  return y + boxH + 4;
}

function ratingBadge(doc: jsPDF, x: number, y: number, rating: string): number {
  const colors: Record<string, RGB> = {
    GOOD: C.goodBg,
    ADEQUATE: C.adequateBg,
    ACTION: C.actionBg,
    "ACTION REQUIRED": C.actionBg,
  };
  const bg = colors[rating] ?? C.muted;
  const w = Math.max(doc.getTextWidth(rating) + 8, 22);
  fill(doc, bg);
  doc.roundedRect(x, y - 4, w, 6.5, 1.5, 1.5, "F");
  rgb(doc, C.white);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text(rating, x + w / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  return w;
}

/* ─── Metadata table (cover page style) ─── */
function metaTable(doc: jsPDF, y: number, rows: [string, string][]): number {
  for (const [label, value] of rows) {
    // Label column (light gray bg)
    fill(doc, C.rowAlt);
    doc.rect(ML + 10, y, 50, 8, "F");
    draw(doc, C.borderL);
    doc.setLineWidth(0.2);
    doc.rect(ML + 10, y, 50, 8, "S");
    rgb(doc, C.muted);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, ML + 14, y + 5.5);

    // Value column
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

/* ═══════════════════════════════════════════════════════
   COVER PAGE
   ═══════════════════════════════════════════════════════ */

function drawCoverPage(doc: jsPDF, data: StellarDemoResponse, reportId: string) {
  const pc = { n: 1 };
  drawHeader(doc, 1);
  drawFooterBar(doc);

  let y = 36;

  // Hera logo box
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
  y += 8;
  doc.setFontSize(12);
  doc.text("CASP COMPLIANCE-STATUS SUMMARY", PW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 6;
  rgb(doc, C.muted);
  doc.setFontSize(9);
  doc.text("Internal / management review  \u2022  MiCA + TFR readiness overview", PW / 2, y, { align: "center" });

  y += 16;

  // Determine overall rating
  const { summary } = data.report;
  const overallRating = summary.sanctions_hits > 0 ? "ACTION REQUIRED" :
    summary.sep8_rejections > 0 ? "ADEQUATE" : "GOOD";

  // Metadata table
  const now = new Date();
  y = metaTable(doc, y, [
    ["Report ID", reportId],
    ["Report Type", "Compliance-status summary (management view)"],
    ["Prepared by", "Hera Protocol Compliance Engine"],
    ["Entity Reviewed (CASP)", "Demo CASP Entity  \u2022  LEI: N/A"],
    ["MiCA Authorisation Status", "In application"],
    ["Review Period", `${new Date(summary.audit_start).toLocaleDateString("en-GB")} \u2013 ${new Date(summary.audit_end).toLocaleDateString("en-GB")}`],
    ["Networks Covered", data.report.chain],
    ["Overall Readiness Rating", overallRating],
    ["Date Issued", now.toLocaleDateString("en-GB")],
    ["Confidentiality", "CONFIDENTIAL \u2014 Client Use Only"],
  ]);

  y += 6;

  // Data source box
  y = dataSourceBox(doc, y,
    "This is an internal management overview, not a regulator submission. It summarises the entity\u2019s Travel Rule / AML control health across the period. The authoritative per-transfer evidence is held in the companion TFR Transaction Compliance Report.",
    pc,
  );

  return pc;
}

/* ═══════════════════════════════════════════════════════
   SECTION 1: EXECUTIVE SUMMARY
   ═══════════════════════════════════════════════════════ */

function drawExecutiveSummary(doc: jsPDF, data: StellarDemoResponse, pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "1. EXECUTIVE SUMMARY", pc);

  // Intro paragraph
  rgb(doc, C.bodyText);
  doc.setFontSize(8);
  const introLines = doc.splitTextToSize(
    "This summary reports how the reviewed entity performed against its core obligations for crypto-asset transfers under Regulation (EU) 2023/1113 (Travel Rule) and the associated MiCA recordkeeping and monitoring duties, over the review period. It is written for a non-technical reader and highlights control strengths, gaps and recommended actions.",
    CW - 4,
  );
  doc.text(introLines, ML + 2, y);
  y += introLines.length * 3.5 + 6;

  const { summary, events } = data.report;

  // Compute ratings from data
  const totalTx = events.filter(e => e.event_type !== "FEE").length;
  const passCount = events.filter(e => e.compliance_flags.some(f => f.includes("COMPLETE") || f.includes("APPROVED")) && !e.compliance_flags.some(f => f.includes("SANCTIONS") || f.includes("REJECTED"))).length;
  const fieldCompleteRate = totalTx > 0 ? Math.round((passCount / totalTx) * 100) : 0;

  const sanctionsOk = summary.sanctions_hits === 0;
  const selfHostedPending = events.filter(e => e.compliance_flags.includes("EDD_REQUIRED")).length;
  const missingInfoCount = events.filter(e => e.compliance_flags.some(f => f.includes("PARTIAL"))).length;
  const repeatedFailures = events.filter(e => e.sep8_approval?.status === "rejected").length;

  const controlAreas: { area: string; rating: string; summary: string }[] = [
    {
      area: "Travel Rule field completeness",
      rating: fieldCompleteRate >= 90 ? "GOOD" : fieldCompleteRate >= 70 ? "ADEQUATE" : "ACTION",
      summary: `${fieldCompleteRate}% of transfers carried all required originator/beneficiary fields.`,
    },
    {
      area: "Sanctions screening coverage",
      rating: sanctionsOk ? "GOOD" : "ACTION",
      summary: sanctionsOk
        ? "All in-scope transfers screened against OFAC/EU/UN lists."
        : `${summary.sanctions_hits} sanctions hit(s) detected and blocked.`,
    },
    {
      area: "Self-hosted wallet handling (>\u20AC1,000)",
      rating: selfHostedPending > 0 ? "ADEQUATE" : "GOOD",
      summary: selfHostedPending > 0
        ? `Ownership checks applied; ${selfHostedPending} case(s) pending attestation.`
        : "All self-hosted wallet transfers verified.",
    },
    {
      area: "Missing-info procedures",
      rating: missingInfoCount > 0 ? "ADEQUATE" : "GOOD",
      summary: missingInfoCount > 0
        ? "Risk-based actions logged; response times to improve."
        : "No missing-info events in period.",
    },
    {
      area: "Recordkeeping (\u22655 yrs) & GDPR",
      rating: "GOOD",
      summary: "Retention and data-minimisation controls in place.",
    },
    {
      area: "Counterparty-failure escalation",
      rating: repeatedFailures > 0 ? "ACTION" : "GOOD",
      summary: repeatedFailures > 0
        ? `${repeatedFailures} repeated-failure counterparties require reporting/review.`
        : "No repeated counterparty failures.",
    },
  ];

  // Control area table
  const colWidths = [65, 25, CW - 90];

  // Header
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Control area", ML + 4, y + 5.5);
  doc.text("Rating", ML + colWidths[0] + 4, y + 5.5);
  doc.text("Summary", ML + colWidths[0] + colWidths[1] + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  y += 8;

  for (let i = 0; i < controlAreas.length; i++) {
    const row = controlAreas[i];
    y = ensureSpace(doc, y, 12, pc);

    // Row background
    if (i % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, 10, "F");
    }
    // Borders
    draw(doc, C.borderL);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, colWidths[0], 10, "S");
    doc.rect(ML + colWidths[0], y, colWidths[1], 10, "S");
    doc.rect(ML + colWidths[0] + colWidths[1], y, colWidths[2], 10, "S");

    // Area name
    rgb(doc, C.heading);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(row.area, ML + 4, y + 6.5);
    doc.setFont("helvetica", "normal");

    // Rating badge
    ratingBadge(doc, ML + colWidths[0] + 3, y + 6.5, row.rating);

    // Summary text
    rgb(doc, C.bodyText);
    doc.setFontSize(7);
    const sumLines = doc.splitTextToSize(row.summary, colWidths[2] - 8);
    doc.text(sumLines[0], ML + colWidths[0] + colWidths[1] + 4, y + 6.5);

    y += 10;
  }

  y += 6;
  y = dataSourceBox(doc, y,
    "Ratings derived by the Hera engine from the entity\u2019s transfer set and control logs over the period. Illustrative ratings shown; live report reflects actual results.",
    pc,
  );

  return y;
}

/* ═══════════════════════════════════════════════════════
   SECTION 2: KEY METRICS
   ═══════════════════════════════════════════════════════ */

function drawKeyMetrics(doc: jsPDF, data: StellarDemoResponse, pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "2. KEY METRICS", pc);

  const { summary, events } = data.report;
  const totalTx = events.filter(e => e.event_type !== "FEE").length;

  // Top metric cards
  const metrics = [
    { label: "TRANSFERS REVIEWED", value: totalTx.toString() },
    { label: "FIELD-COMPLETE RATE", value: `${Math.round((events.filter(e => e.compliance_flags.some(f => f.includes("COMPLETE"))).length / Math.max(totalTx, 1)) * 100)}%` },
    { label: "SANCTIONS HITS", value: summary.sanctions_hits.toString() },
    { label: "OPEN REMEDIATIONS", value: events.filter(e => e.compliance_flags.some(f => f.includes("PARTIAL") || f.includes("EDD"))).length.toString() },
  ];

  const cardW = CW / 4;
  fill(doc, C.rowAlt);
  doc.rect(ML, y, CW, 16, "F");
  draw(doc, C.borderL);
  doc.setLineWidth(0.2);
  doc.rect(ML, y, CW, 16, "S");

  for (let i = 0; i < metrics.length; i++) {
    const cx = ML + i * cardW;
    if (i > 0) {
      draw(doc, C.borderL);
      doc.line(cx, y + 2, cx, y + 14);
    }
    rgb(doc, C.muted);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(metrics[i].label, cx + cardW / 2, y + 5.5, { align: "center" });
    rgb(doc, C.navy);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(metrics[i].value, cx + cardW / 2, y + 13, { align: "center" });
    doc.setFont("helvetica", "normal");
  }
  y += 22;

  // Travel Rule Outcomes table
  rgb(doc, C.heading);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Travel Rule Outcomes Over Period", ML, y + 4);
  doc.setFont("helvetica", "normal");
  y += 10;

  // Compute outcomes
  const passEvents = events.filter(e => e.event_type !== "FEE" && e.compliance_flags.some(f => f.includes("COMPLETE")) && !e.compliance_flags.some(f => f.includes("SANCTIONS") || f.includes("REJECTED")));
  const partialEvents = events.filter(e => e.compliance_flags.some(f => f.includes("PARTIAL")));
  const failedEvents = events.filter(e => e.sep8_approval?.status === "rejected" && !e.compliance_flags.includes("SANCTIONS_HIT"));
  const blockedEvents = events.filter(e => e.compliance_flags.includes("SANCTIONS_HIT"));

  const outcomes = [
    { outcome: "Fully compliant (PASS)", count: passEvents.length, share: `${Math.round((passEvents.length / Math.max(totalTx, 1)) * 100)}%`, trend: "\u25B2" },
    { outcome: "Partial (non-critical gap)", count: partialEvents.length, share: `${Math.round((partialEvents.length / Math.max(totalTx, 1)) * 100)}%`, trend: "=" },
    { outcome: "Failed (critical gap)", count: failedEvents.length, share: `${Math.round((failedEvents.length / Math.max(totalTx, 1)) * 100)}%`, trend: "=" },
    { outcome: "Blocked (sanctions)", count: blockedEvents.length, share: `${Math.round((blockedEvents.length / Math.max(totalTx, 1)) * 100)}%`, trend: "=" },
  ];

  // Table header
  const oCols = [70, 24, 24, 56];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Outcome", ML + 4, y + 5.5);
  doc.text("Count", ML + oCols[0] + 4, y + 5.5);
  doc.text("Share", ML + oCols[0] + oCols[1] + 4, y + 5.5);
  doc.text("Trend vs. prior period", ML + oCols[0] + oCols[1] + oCols[2] + 4, y + 5.5);
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
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(row.outcome, ML + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    rgb(doc, C.bodyText);
    doc.text(row.count.toString(), ML + oCols[0] + 4, y + 5.5);
    doc.text(row.share, ML + oCols[0] + oCols[1] + 4, y + 5.5);
    doc.text(row.trend, ML + oCols[0] + oCols[1] + oCols[2] + 4, y + 5.5);
    y += 8;
  }
  y += 8;

  // Network Breakdown
  rgb(doc, C.heading);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Network Breakdown", ML, y + 4);
  doc.setFont("helvetica", "normal");
  y += 10;

  const nCols = [60, 36, 40, 38];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Network", ML + 4, y + 5.5);
  doc.text("Transfers", ML + nCols[0] + 4, y + 5.5);
  doc.text("Field-complete %", ML + nCols[0] + nCols[1] + 4, y + 5.5);
  doc.text("Sanctions hits", ML + nCols[0] + nCols[1] + nCols[2] + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  y += 8;

  // One row for the current network
  fill(doc, C.rowAlt);
  doc.rect(ML, y, CW, 8, "F");
  draw(doc, C.borderL);
  doc.setLineWidth(0.15);
  doc.line(ML, y + 8, ML + CW, y + 8);

  rgb(doc, C.heading);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(data.report.chain, ML + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  rgb(doc, C.bodyText);
  doc.text(totalTx.toString(), ML + nCols[0] + 4, y + 5.5);
  doc.text(`${Math.round((passEvents.length / Math.max(totalTx, 1)) * 100)}%`, ML + nCols[0] + nCols[1] + 4, y + 5.5);
  doc.text(summary.sanctions_hits.toString(), ML + nCols[0] + nCols[1] + nCols[2] + 4, y + 5.5);
  y += 12;

  y = dataSourceBox(doc, y,
    "Transfer facts verified by Hera against on-chain data; completeness computed against the reporting entity\u2019s KYC records; sanctions via OFAC/EU/UN lists + Scorechain address screening.",
    pc,
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION 3: IDENTIFIED GAPS & RECOMMENDED ACTIONS
   ═══════════════════════════════════════════════════════ */

function drawGapsSection(doc: jsPDF, data: StellarDemoResponse, pc: { n: number }) {
  doc.addPage();
  pc.n++;
  drawHeader(doc, pc.n);
  drawFooterBar(doc);

  let y = MT;
  y = sectionBox(doc, y, "3. IDENTIFIED GAPS & RECOMMENDED ACTIONS", pc);

  const { events } = data.report;

  // Build gaps from data
  const gaps: { gap: string; priority: string; action: string; owner: string }[] = [];

  const sanctionsHits = events.filter(e => e.compliance_flags.includes("SANCTIONS_HIT"));
  if (sanctionsHits.length > 0) {
    gaps.push({
      gap: `${sanctionsHits.length} sanctions-blocked counterpart(y/ies) detected`,
      priority: "HIGH",
      action: "Report to NCA; review relationship",
      owner: "[MLRO] / immediate",
    });
  }

  const eddRequired = events.filter(e => e.compliance_flags.includes("EDD_REQUIRED"));
  if (eddRequired.length > 0) {
    gaps.push({
      gap: `${eddRequired.length} self-hosted attestation(s) pending`,
      priority: "MEDIUM",
      action: "Collect ownership evidence",
      owner: "[Ops] / 7 days",
    });
  }

  const partialTR = events.filter(e => e.compliance_flags.some(f => f.includes("PARTIAL")));
  if (partialTR.length > 0) {
    gaps.push({
      gap: `${partialTR.length} transfer(s) with incomplete Travel Rule fields`,
      priority: "MEDIUM",
      action: "Tighten SLA on info requests",
      owner: "[Compliance] / 14 days",
    });
  }

  const rejected = events.filter(e => e.sep8_approval?.status === "rejected");
  if (rejected.length > 0) {
    gaps.push({
      gap: `${rejected.length} repeated counterparty failure(s)`,
      priority: "HIGH",
      action: "Report to competent authority; review relationship",
      owner: "[MLRO] / immediate",
    });
  }

  if (gaps.length === 0) {
    gaps.push({
      gap: "No significant gaps identified in this period",
      priority: "LOW",
      action: "Continue monitoring",
      owner: "[Compliance] / ongoing",
    });
  }

  // Table
  const gCols = [10, 60, 22, 48, 34];
  fill(doc, C.navy);
  doc.rect(ML, y, CW, 8, "F");
  rgb(doc, C.white);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  let gx = ML;
  for (const [i, label] of ["#", "Gap identified", "Priority", "Recommended action", "Owner / due"].entries()) {
    doc.text(label, gx + 3, y + 5.5);
    gx += gCols[i];
  }
  doc.setFont("helvetica", "normal");
  y += 8;

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    const rowH = 10;
    y = ensureSpace(doc, y, rowH + 2, pc);

    if (i % 2 === 0) {
      fill(doc, C.rowAlt);
      doc.rect(ML, y, CW, rowH, "F");
    }
    draw(doc, C.borderL);
    doc.setLineWidth(0.15);
    doc.line(ML, y + rowH, ML + CW, y + rowH);

    doc.setFontSize(7.5);
    rgb(doc, C.bodyText);
    doc.text((i + 1).toString(), ML + 3, y + 6.5);

    rgb(doc, C.heading);
    doc.setFont("helvetica", "bold");
    const gapLines = doc.splitTextToSize(gap.gap, gCols[1] - 6);
    doc.text(gapLines[0], ML + gCols[0] + 3, y + 6.5);
    doc.setFont("helvetica", "normal");

    // Priority badge
    const prioColor = gap.priority === "HIGH" ? C.high : gap.priority === "MEDIUM" ? C.medium : C.low;
    fill(doc, prioColor);
    const pw = Math.max(doc.getTextWidth(gap.priority) + 6, 16);
    doc.roundedRect(ML + gCols[0] + gCols[1] + 2, y + 3, pw, 5.5, 1.2, 1.2, "F");
    rgb(doc, C.white);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.text(gap.priority, ML + gCols[0] + gCols[1] + 2 + pw / 2, y + 6.8, { align: "center" });
    doc.setFont("helvetica", "normal");

    rgb(doc, C.bodyText);
    doc.setFontSize(7);
    const actLines = doc.splitTextToSize(gap.action, gCols[3] - 6);
    doc.text(actLines[0], ML + gCols[0] + gCols[1] + gCols[2] + 3, y + 6.5);

    doc.text(gap.owner, ML + gCols[0] + gCols[1] + gCols[2] + gCols[3] + 3, y + 6.5);

    y += rowH;
  }

  y += 6;
  y = dataSourceBox(doc, y,
    "Gaps flagged by the Hera engine from period data. Prioritisation and ownership are set with the reporting entity; Hera does not remediate on the entity\u2019s behalf.",
    pc,
  );

  // Section 4: Scope, Limitations & Disclaimer
  y += 4;
  y = sectionBox(doc, y, "4. SCOPE, LIMITATIONS & DISCLAIMER", pc);

  const disclaimers = [
    "This is an internal management summary, not a submission to a competent authority and not legal advice. It supports \u2014 it does not replace \u2014 the entity\u2019s own compliance and risk-management processes.",
    "Hera Protocol is a compliance-technology provider, not a licensed financial institution, law firm, CASP, or regulated compliance advisor.",
    "Ratings and metrics derive from data supplied by the reviewed entity (transfers and KYC records) combined with on-chain verification and official sanctions lists. Hera does not independently verify the identity of the entity\u2019s underlying customers.",
    "Sanctions results reflect list coverage at the screening date and may change on re-screening.",
    "Confidential; prepared for the named entity. Redistribution requires written consent from Hera Protocol.",
  ];

  for (const d of disclaimers) {
    y = ensureSpace(doc, y, 12, pc);
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

export function generateCaspSummaryPdf(data: StellarDemoResponse) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const reportId = `SUM-2026-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  // Cover page
  const pc = drawCoverPage(doc, data, reportId);

  // Section 1: Executive Summary
  drawExecutiveSummary(doc, data, pc);

  // Section 2: Key Metrics
  drawKeyMetrics(doc, data, pc);

  // Section 3: Gaps + Section 4: Disclaimer
  drawGapsSection(doc, data, pc);

  doc.save(`hera-casp-compliance-summary-${reportId}.pdf`);
}
