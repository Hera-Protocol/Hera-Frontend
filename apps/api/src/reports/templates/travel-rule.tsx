import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { IvmsPerson, SubjectRef } from "@hera/core";
import type { TravelRuleSnapshot } from "../snapshot";
import { dateTime, KeyValues, ReportFooter, ReportHeader, Section, Table } from "./components";
import { s } from "./theme";

const STATUS_TEXT: Record<string, string> = {
  draft: "Draft",
  awaiting_counterparty: "Awaiting counterparty",
  acknowledged: "Acknowledged",
  accepted: "Accepted",
  rejected: "Rejected",
  unhosted_verification: "Unhosted wallet verification",
  settled: "Settled",
};

type Row = [string, string, { mono?: boolean }?];

function personRows(person: IvmsPerson): Row[] {
  const rows: Row[] =
    person.type === "natural"
      ? [
          ["Type", "Natural person"],
          ["Name", `${person.firstName} ${person.lastName}`],
          ...(person.dateOfBirth ? ([["Date of birth", person.dateOfBirth]] as Row[]) : []),
          ...(person.placeOfBirth ? ([["Place of birth", person.placeOfBirth]] as Row[]) : []),
          ...(person.nationalId ? ([["National ID", person.nationalId]] as Row[]) : []),
        ]
      : [["Type", "Legal person"], ["Legal name", person.legalName], ...(person.lei ? ([["LEI", person.lei, { mono: true }]] as Row[]) : [])];
  if (person.customerId) rows.push(["Customer ID", person.customerId]);
  const address = person.address ? [person.address.street, person.address.city, person.address.country].filter(Boolean).join(", ") : "";
  if (address) rows.push(["Address", address]);
  return rows;
}

function accountText(account: SubjectRef): string {
  if (account.chain !== "stellar") return account.address;
  if (account.sub?.kind === "muxed") return `${account.sub.muxed} (base ${account.account}, id ${account.sub.id})`;
  if (account.sub?.kind === "memo") return `${account.account} (memo ${account.sub.type}: ${account.sub.value})`;
  return account.account;
}

export function TravelRuleReport({ snapshot, jsonSha256 }: { snapshot: TravelRuleSnapshot; jsonSha256: string }) {
  const { transfer, jurisdiction } = snapshot;
  const threshold = jurisdiction.threshold === 0 ? "Every transfer" : `${jurisdiction.currency} ${jurisdiction.threshold.toLocaleString("en-US")} and above`;
  return (
    <Document title={snapshot.title} author="Hera" subject={snapshot.reference} creator="Hera" producer="Hera" creationDate={new Date(snapshot.generatedAt)}>
      <Page size="A4" style={s.page}>
        {/* First child: react-pdf repeats fixed elements only from the page they first appear on. */}
        <ReportFooter header={snapshot} jsonSha256={jsonSha256} />
        <ReportHeader header={snapshot} scopeLabel="Transfer" />

        <Section title="Transfer">
          <KeyValues
            rows={[
              ["Reference", transfer.reference, { mono: true }],
              ["Status", STATUS_TEXT[transfer.status] ?? transfer.status],
              ["Direction", transfer.direction === "outgoing" ? "Outgoing (we are the originating VASP)" : "Incoming (we are the beneficiary VASP)"],
              ["Chain", transfer.chain],
              ["Amount", `${transfer.amount} ${transfer.asset} (≈ USD ${transfer.amountUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })})`],
              ["Transaction", transfer.txHash ?? "Not yet broadcast", { mono: Boolean(transfer.txHash) }],
              ["Created", dateTime(transfer.createdAt)],
            ]}
          />
        </Section>

        <Section title="Threshold check">
          <View style={[s.box, { marginBottom: 6 }]}>
            <Text style={{ fontWeight: 700, marginBottom: 3 }}>
              {transfer.check.required ? "Travel Rule data is required for this transfer." : "Below the threshold: Travel Rule data is not required."}
            </Text>
            <Text>{transfer.check.explanation}</Text>
          </View>
          <KeyValues
            rows={[
              ["Rule applied", `${jurisdiction.name} (${jurisdiction.code}): ${jurisdiction.reference}`],
              ["Threshold", `${threshold} (≈ USD ${transfer.check.thresholdUsd.toLocaleString("en-US")})`],
              ["Unhosted wallet proof", transfer.check.unhostedProofRequired ? "Required: the counterparty is a self-hosted wallet above the verification limit" : "Not required"],
            ]}
          />
        </Section>

        <Section title="Originator (IVMS101)">
          <KeyValues rows={[...personRows(transfer.originator), ["Account", accountText(transfer.originatorAccount), { mono: true }]]} />
        </Section>

        <Section title="Beneficiary (IVMS101)">
          <KeyValues rows={[...personRows(transfer.beneficiary), ["Account", accountText(transfer.beneficiaryAccount), { mono: true }]]} />
        </Section>

        <Section title="Counterparty VASP">
          {transfer.beneficiaryVasp ? (
            <KeyValues
              rows={[
                ["Name", transfer.beneficiaryVasp.name],
                ...(transfer.beneficiaryVasp.lei ? ([["LEI", transfer.beneficiaryVasp.lei, { mono: true }]] as Row[]) : []),
                ...(transfer.beneficiaryVasp.domain ? ([["Domain", transfer.beneficiaryVasp.domain]] as Row[]) : []),
              ]}
            />
          ) : (
            <Text style={s.p}>None: the beneficiary account is a self-hosted (unhosted) wallet.</Text>
          )}
        </Section>

        <Section title="Status timeline">
          <Table
            columns={[{ label: "Time (UTC)", flex: 1.6 }, { label: "Status", flex: 1.6 }, { label: "By", flex: 1.4 }, { label: "Note", flex: 3 }]}
            rows={transfer.events.map((e) => [dateTime(e.at).replace(" UTC", ""), STATUS_TEXT[e.status] ?? e.status, e.actor, e.note ?? ""])}
          />
        </Section>

        <Text style={[s.small, { marginTop: 8 }]}>
          This record contains personal data collected under the Travel Rule. Share it only with the counterparty VASP or a competent authority.
        </Text>

      </Page>
    </Document>
  );
}
