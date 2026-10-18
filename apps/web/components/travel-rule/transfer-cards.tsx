"use client";

import type { IvmsPerson, SubjectRef, TravelRuleTransferDto } from "@hera/core";
import type { ReactNode } from "react";
import { Tag } from "@/components/ui/badge";
import { Address } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { countryName } from "./countries";
import { personName, STATUS_META, StatusDot } from "./status";

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export function AccountValue({ subject }: { subject: SubjectRef }) {
  if (subject.chain !== "stellar") return <Address value={subject.address} />;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Address value={subject.account} />
      {subject.sub?.kind === "muxed" && (
        <Tag tone="sun" title={subject.sub.muxed}>
          muxed {subject.sub.id}
        </Tag>
      )}
      {subject.sub?.kind === "memo" && (
        <Tag tone="sun">
          memo {subject.sub.type}: {subject.sub.value}
        </Tag>
      )}
    </span>
  );
}

/** IVMS101 party: person details, account, and VASP. */
export function PartyCard({
  role,
  person,
  account,
  vasp,
}: {
  role: "Originator" | "Beneficiary";
  person: IvmsPerson;
  account: SubjectRef;
  vasp: ReactNode;
}) {
  const address = person.address
    ? [person.address.street, person.address.city].filter(Boolean).join(", ")
    : "";
  return (
    <section className="brutal flex min-w-0 flex-col gap-2.5 p-[18px]">
      <span className="eyebrow">{role} · IVMS101</span>
      <h2 className="text-2xl font-extrabold break-words">{personName(person)}</h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 text-sm">
        <Row label="Type">{person.type === "natural" ? "Natural person" : "Legal person"}</Row>
        {person.type === "legal" && <Row label="LEI">{person.lei ? <span className="font-mono">{person.lei}</span> : null}</Row>}
        <Row label="Customer ID">{person.customerId ? <span className="font-mono">{person.customerId}</span> : null}</Row>
        {person.type === "natural" && (
          <>
            <Row label="National ID">{person.nationalId ? <span className="font-mono">{person.nationalId}</span> : null}</Row>
            <Row label="Born">{[person.dateOfBirth, person.placeOfBirth].filter(Boolean).join(", ") || null}</Row>
          </>
        )}
        <Row label="Address">{address || null}</Row>
        <Row label="Country">{person.address?.country ? `${countryName(person.address.country)} (${person.address.country})` : null}</Row>
        <Row label="Account">
          <AccountValue subject={account} />
        </Row>
        <Row label="VASP">{vasp}</Row>
      </dl>
    </section>
  );
}

export function Timeline({ events }: { events: TravelRuleTransferDto["events"] }) {
  const ordered = [...events].reverse();
  return (
    <ol className="px-5 pt-2 pb-3">
      {ordered.map((e, i) => (
        <li key={`${e.at}-${i}`} className="flex flex-wrap gap-x-3.5 gap-y-1 border-b border-dashed border-line/25 py-3 last:border-b-0">
          <StatusDot status={e.status} />
          <div className="min-w-0 flex-[1_1_200px] text-sm leading-normal">
            <strong>{STATUS_META[e.status].label}</strong>
            {e.note && <p className="whitespace-pre-line break-words text-ink-soft">{e.note}</p>}
          </div>
          <span className="ml-7 font-mono text-xs text-ink-soft sm:ml-0 sm:text-right">
            <time dateTime={e.at}>{formatDateTime(e.at)}</time>
            <br />
            {e.actor}
          </span>
        </li>
      ))}
    </ol>
  );
}
