import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { EvidenceSnapshot } from "../snapshot";
import { BandPill, dateTime, KeyValues, ReportFooter, ReportHeader, Section, short, Table } from "./components";
import { MUTED, RISK, s } from "./theme";

const TRUNCATED: Record<string, string> = { page_budget: "the page budget", deadline: "the time budget", error: "an upstream error" };

function windowText(w: NonNullable<EvidenceSnapshot["dataWindow"]>): string {
  const pages = Object.entries(w.pages).map(([name, n]) => `${name} ${n}`).join(", ");
  const coverage = w.fullHistory ? "full history" : `partial history${w.truncatedBy ? `, stopped by ${TRUNCATED[w.truncatedBy] ?? w.truncatedBy}` : ""}`;
  return `${w.records} records read (${pages || "no pages"}); ${coverage}${w.oldest ? `; oldest ${dateTime(w.oldest)}` : ""}.`;
}

const DECISION_TEXT = { allow: "Allow", review: "Review before proceeding", block: "Block" } as const;

export function EvidenceReport({ snapshot, jsonSha256 }: { snapshot: EvidenceSnapshot; jsonSha256: string }) {
  const { screening } = snapshot;
  const risk = RISK[screening.band];
  return (
    <Document title={snapshot.title} author="Hera" subject={snapshot.reference} creator="Hera" producer="Hera" creationDate={new Date(snapshot.generatedAt)}>
      <Page size="A4" style={s.page}>
        {/* First child: react-pdf repeats fixed elements only from the page they first appear on. */}
        <ReportFooter header={snapshot} jsonSha256={jsonSha256} />
        <ReportHeader header={snapshot} scopeLabel="Subject" />

        <View style={[s.box, { marginTop: 12, flexDirection: "row", alignItems: "center", backgroundColor: risk.tint }]}>
          <View style={{ width: 90 }}>
            <Text style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: risk.fg }}>{screening.score}</Text>
            <Text style={s.small}>Risk score (0–100)</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[s.row, { alignItems: "center", marginBottom: 3 }]}>
              <BandPill band={screening.band} />
              <Text style={{ marginLeft: 6, fontWeight: 700, fontSize: 11 }}>Decision: {DECISION_TEXT[screening.decision]}</Text>
            </View>
            <Text style={s.small}>
              Screened {dateTime(screening.screenedAt)} with engine {screening.engineVersion}. Screening ID {screening.id}.
            </Text>
          </View>
        </View>

        <Section title="Subject">
          <KeyValues
            rows={[
              ["Chain", screening.chainName],
              ...screening.identity.map(({ label, value }) => [label, value, { mono: true }] as [string, string, { mono: boolean }]),
              ...(snapshot.delegatedTo ? ([["Delegates code to (EIP-7702)", snapshot.delegatedTo, { mono: true }]] as [string, string, { mono: boolean }][]) : []),
              [
                "Transfers in view",
                `${snapshot.stats.transfers} (${snapshot.stats.inbound} in, ${snapshot.stats.outbound} out, ${snapshot.stats.dustFiltered} dust filtered${snapshot.stats.failed ? `, ${snapshot.stats.failed} failed on-chain and not scored` : ""})`,
              ],
              ...(snapshot.dataWindow ? ([["Data window", windowText(snapshot.dataWindow)]] as [string, string][]) : []),
              ["First / last seen", `${snapshot.stats.firstSeen ? dateTime(snapshot.stats.firstSeen) : "n/a"}  →  ${snapshot.stats.lastSeen ? dateTime(snapshot.stats.lastSeen) : "n/a"}`],
            ]}
          />
        </Section>

        <Section title="Reasons">
          {snapshot.reasons.length === 0 ? (
            <Text style={s.muted}>No risk indicators were found.</Text>
          ) : (
            snapshot.reasons.map((reason, i) => (
              <View key={i} wrap={false} style={[s.box, { marginBottom: 5, padding: 7 }]}>
                <View style={[s.row, { marginBottom: 2 }]}>
                  <Text style={{ fontWeight: 700, flex: 1 }}>{reason.title}</Text>
                  <Text style={[s.mono, { color: MUTED }]}>{reason.code}</Text>
                  <Text style={{ fontWeight: 700, marginLeft: 8, width: 44, textAlign: "right" }}>{reason.points > 0 ? `+${reason.points}` : "info"}</Text>
                </View>
                <Text>{reason.detail}</Text>
                {reason.provenance ? (
                  <Text style={[s.small, { marginTop: 3 }]}>
                    Label: {reason.provenance.entity} ({reason.provenance.category}). Source: {reason.provenance.source}
                    {reason.provenance.sourceUrl ? ` (${reason.provenance.sourceUrl})` : ""}, confidence {Math.round(reason.provenance.confidence * 100)}%, added{" "}
                    {reason.provenance.addedAt}.
                  </Text>
                ) : null}
                {reason.txHashes?.length ? (
                  <Text style={[s.small, { marginTop: 2 }]}>
                    Transactions: <Text style={s.mono}>{reason.txHashes.slice(0, 3).join(", ")}</Text>
                    {reason.txHashes.length > 3 ? ` and ${reason.txHashes.length - 3} more` : ""}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </Section>

        <Section title="Counterparties">
          <Table
            columns={[{ label: "Address", flex: 3, mono: true }, { label: "In", align: "right", flex: 0.7 }, { label: "Out", align: "right", flex: 0.7 }, { label: "Labels", flex: 4 }]}
            rows={snapshot.counterparties.map((c) => [`${short(c.address, 10, 8)}${c.muxedId ? ` id ${c.muxedId}` : ""}`, c.inbound, c.outbound, c.labels.join("; ") || "None"])}
            empty="No counterparties in the screened window."
          />
        </Section>

        <Section title="Transfers scored">
          <Table
            columns={[
              { label: "Time (UTC)", flex: 2.2 },
              { label: "Dir", flex: 0.6 },
              { label: "Counterparty", flex: 2, mono: true },
              { label: "Amount", flex: 2, align: "right" },
              { label: "Tx", flex: 1.8, mono: true },
            ]}
            rows={snapshot.transfers.map((t) => [
              dateTime(t.timestamp).replace(" UTC", ""),
              t.direction,
              short(t.counterparty),
              `${t.amount} ${t.asset}${t.kind === "claim" ? " (claim)" : ""}${t.successful ? "" : " (failed)"}`,
              short(t.txHash, 8, 6),
            ])}
            empty="No transfers in the screened window."
          />
          {snapshot.transfersOmitted > 0 ? (
            <Text style={s.small}>{snapshot.transfersOmitted} older transfers are in the JSON snapshot only.</Text>
          ) : null}
        </Section>

        <Section title="Data sources and method">
          {snapshot.dataSources.map((source) => (
            <Text key={source} style={s.p}>
              • {source}
            </Text>
          ))}
          <Text style={[s.small, { marginTop: 4 }]}>
            Scores run 0–100: low 0–24, medium 25–49, high 50–74 (review), severe 75–100 (block). A direct sanctions match always scores 100. Full
            addresses and every scored transfer are in the JSON snapshot, whose SHA-256 is printed below.
          </Text>
        </Section>

      </Page>
    </Document>
  );
}
