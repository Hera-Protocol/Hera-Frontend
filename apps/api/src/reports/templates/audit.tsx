import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { RiskBand } from "@hera/core";
import type { AuditSnapshot } from "../snapshot";
import { type Cell, dateTime, Kpis, ReportFooter, ReportHeader, Section, Table } from "./components";
import { RISK, s } from "./theme";

const n = (value: number) => value.toLocaleString("en-US");

export function AuditReport({ snapshot, jsonSha256 }: { snapshot: AuditSnapshot; jsonSha256: string }) {
  const { kpis, screenings, alerts, travelRule, auditLog, methodology } = snapshot;
  const chainCols = screenings.chains.map((c) => ({ label: c.name, align: "right" as const }));
  return (
    <Document title={snapshot.title} author="Hera" subject={snapshot.reference} creator="Hera" producer="Hera" creationDate={new Date(snapshot.generatedAt)}>
      <Page size="A4" style={s.page}>
        {/* First child: react-pdf repeats fixed elements only from the page they first appear on. */}
        <ReportFooter header={snapshot} jsonSha256={jsonSha256} />
        <ReportHeader header={snapshot} scopeLabel="Period" />

        <Section title="Executive summary">
          {snapshot.summary.map((sentence, i) => (
            <Text key={i} style={s.p}>
              {sentence}
            </Text>
          ))}
        </Section>

        <View style={{ marginTop: 6 }}>
          <Kpis
            items={[
              { label: "Screenings", value: n(kpis.screenings) },
              { label: "Flagged (review or block)", value: n(kpis.flagged), ...(kpis.flagged > 0 ? { band: "high" as RiskBand } : {}) },
              { label: "Alerts opened", value: n(kpis.alertsOpened) },
              { label: "Travel Rule transfers", value: n(kpis.travelRuleTransfers) },
              { label: "Audit events", value: n(kpis.auditEvents) },
            ]}
          />
        </View>

        <Section title="Screening outcomes by risk band and chain">
          <Table
            columns={[{ label: "Band", flex: 1.2 }, ...chainCols, { label: "Total", align: "right" }]}
            rows={[
              ...screenings.rows.map((row): Cell[] => [
                { text: row.band.toUpperCase(), band: row.band },
                ...screenings.chains.map((c) => n(row.counts[c.id] ?? 0)),
                { text: n(row.total), bold: true },
              ]),
              [{ text: "Total", bold: true }, ...screenings.chains.map((c) => ({ text: n(screenings.totals[c.id] ?? 0), bold: true })), { text: n(screenings.total), bold: true }],
            ]}
          />
          <Text style={s.small}>
            {n(kpis.blocked)} screenings were blocked and {n(kpis.flagged - kpis.blocked)} sent to review. {n(kpis.watchedWallets)} wallets were under monitoring at the end of the period.
          </Text>
        </Section>

        <Section title="Alerts">
          <Table
            columns={[{ label: "Measure", flex: 3 }, { label: "Count", align: "right" }]}
            rows={[
              ["Opened in the period", n(alerts.opened)],
              ["Closed as true positive", n(alerts.closedTruePositive)],
              ["Closed as false positive", n(alerts.closedFalsePositive)],
              ["Escalated", n(alerts.escalated)],
              ["Open at the end of the period", n(alerts.openAtEnd)],
              ["Median time to decision", alerts.medianHoursToDecision === null ? "n/a" : `${alerts.medianHoursToDecision.toFixed(1)} h`],
            ]}
          />
          <Text style={s.small}>
            Opened by severity: {Object.entries(alerts.bySeverity).map(([severity, count]) => `${severity} ${count}`).join(", ") || "none"}. Time to decision runs from an
            alert opening to its first close.
          </Text>
        </Section>

        <Section title="Travel Rule by jurisdiction">
          <Table
            columns={[
              { label: "Jurisdiction", flex: 2.4 },
              { label: "Transfers", align: "right" },
              { label: "Data required", align: "right", flex: 1.2 },
              { label: "Completed", align: "right" },
              { label: "Rejected", align: "right" },
              { label: "Unhosted", align: "right" },
              { label: "Completion", align: "right" },
            ]}
            rows={travelRule.rows.map((row) => [
              `${row.name} (${row.jurisdiction})`,
              n(row.transfers),
              n(row.required),
              n(row.completed),
              n(row.rejected),
              n(row.unhosted),
              row.completionPct === null ? "n/a" : `${row.completionPct.toFixed(0)}%`,
            ])}
            empty="No Travel Rule transfers in this period."
          />
          <Text style={s.small}>Completed means accepted by the counterparty or settled. Counts only; no personal data appears in this report.</Text>
        </Section>

        <Section title="Access and configuration changes">
          <Table columns={[{ label: "Change", flex: 3 }, { label: "Count", align: "right" }]} rows={snapshot.access.map((a) => [a.label, n(a.count)])} />
        </Section>

        <Section title="Audit log verification">
          <View style={[s.box, { backgroundColor: auditLog.valid ? RISK.low.tint : RISK.severe.tint }]} wrap={false}>
            <Text style={{ fontWeight: 700, color: auditLog.valid ? RISK.low.fg : RISK.severe.fg, marginBottom: 2 }}>
              {auditLog.valid ? `Hash chain intact: all ${n(auditLog.checked)} events verified.` : `Hash chain broken at event #${auditLog.brokenAt}.`}
            </Text>
            <Text>
              Every audit event stores sha256(previous hash + canonical event). Hera recomputed the whole chain for this organization at {dateTime(auditLog.verifiedAt)}
              {auditLog.valid ? " and every link matched." : `; ${n(auditLog.checked)} events matched before the break. Investigate before relying on this log.`}
            </Text>
          </View>
        </Section>

        <Section title="Appendix: methodology" breakBefore>
          <Text style={s.h3}>Risk score bands</Text>
          <Table
            columns={[{ label: "Band" }, { label: "Score", align: "right" }, { label: "Decision", flex: 2 }]}
            rows={methodology.bands.map((b) => [{ text: b.band.toUpperCase(), band: b.band }, b.range, b.decision])}
          />
          <Text style={s.small}>
            A direct sanctions match forces a score of 100 and a block. On watched wallets, any reason worth {methodology.alertThresholdPoints} points or more opens an alert.
          </Text>

          <Text style={s.h3}>Reason codes</Text>
          <Table columns={[{ label: "Code", flex: 2, mono: true }, { label: "Meaning", flex: 5 }]} rows={methodology.reasonCodes.map((r) => [r.code, r.description])} />

          <Text style={s.h3}>Label categories and severity</Text>
          <Table
            columns={[{ label: "Category", flex: 2 }, { label: "Severity", align: "right" }]}
            rows={methodology.categories.map((c) => [c.label, String(c.severity)])}
          />

          <Text style={s.h3}>Label sources in force</Text>
          <Table
            columns={[{ label: "Source", flex: 3 }, { label: "Labels", align: "right" }, { label: "Categories", flex: 2 }]}
            rows={methodology.labelSources.map((l) => [`${l.source}${l.url ? `\n${l.url}` : ""}`, String(l.labels), l.categories.join(", ")])}
          />

          <Text style={s.h3}>Travel Rule thresholds in force</Text>
          <Table
            columns={[{ label: "Jurisdiction", flex: 2 }, { label: "Threshold", flex: 1.5, align: "right" }, { label: "Unhosted proof above", flex: 1.5, align: "right" }, { label: "Legal basis", flex: 3 }]}
            rows={methodology.jurisdictions.map((j) => [
              `${j.name} (${j.code})`,
              j.threshold === 0 ? "every transfer" : `${j.currency} ${n(j.threshold)}`,
              j.unhostedVerificationAbove === undefined ? "n/a" : `${j.currency} ${n(j.unhostedVerificationAbove)}`,
              j.reference,
            ])}
          />
        </Section>

      </Page>
    </Document>
  );
}
