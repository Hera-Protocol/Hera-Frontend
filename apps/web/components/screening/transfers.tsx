"use client";

import { type CounterpartySummary, type Label, type Party, shortAddress, type SubjectRef, type Transfer } from "@hera/core";
import { ArrowDown, ArrowUp, Repeat } from "lucide-react";
import { useState } from "react";
import { Tag } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatAmount, formatDateTime, timeAgo, titleCase } from "@/lib/format";
import { explorerTxUrl } from "@/lib/hooks/monitor";

export const RISK_CATEGORIES = new Set([
  "sanctions",
  "terrorist_financing",
  "stolen_funds",
  "ransomware",
  "darknet",
  "mixer",
  "scam",
  "gambling",
  "high_risk_exchange",
]);

export function labelTone(label: Label): "severe" | "high" | "iris" {
  if (["sanctions", "terrorist_financing", "stolen_funds", "ransomware", "darknet"].includes(label.category)) return "severe";
  return RISK_CATEGORIES.has(label.category) ? "high" : "iris";
}

const normalize = (address: string) => (address.startsWith("0x") ? address.toLowerCase() : address);

function isSubject(party: Party, subject: SubjectRef): boolean {
  if (subject.chain !== "stellar") return party.address.toLowerCase() === subject.address.toLowerCase();
  if (party.address !== subject.account) return false;
  return subject.sub?.kind !== "muxed" || party.muxedId === subject.sub.id;
}

type Direction = "in" | "out" | "self";

function directionOf(t: Transfer, subject: SubjectRef): Direction {
  const toMe = isSubject(t.to, subject);
  const fromMe = isSubject(t.from, subject);
  if (toMe && fromMe) return "self";
  return toMe ? "in" : "out";
}

function kindLabel(t: Transfer): string {
  if (t.kind === "path_payment") return "Path payment";
  if (t.kind === "claim") return "Claim";
  if (t.kind === "create_account") return "Create account";
  if (t.kind === "erc20" || t.kind === "erc721" || t.kind === "erc1155") return t.kind.toUpperCase();
  return titleCase(t.kind);
}

const DIR_STYLE: Record<Direction, { label: string; className: string; icon: typeof ArrowDown }> = {
  in: { label: "In", className: "bg-peacock-soft", icon: ArrowDown },
  out: { label: "Out", className: "bg-blush-soft", icon: ArrowUp },
  self: { label: "Self", className: "bg-paper-2", icon: Repeat },
};

export function TransfersTable({
  transfers,
  subject,
  counterparties,
  pageSize = 15,
}: {
  transfers: Transfer[];
  subject: SubjectRef;
  counterparties: CounterpartySummary[];
  pageSize?: number;
}) {
  const [all, setAll] = useState(false);
  if (transfers.length === 0) {
    return <p className="px-5 py-6 text-[15px] text-ink-soft">No transfers in the window Hera read. Unknown is not the same as clean.</p>;
  }
  const labels = new Map(counterparties.map((c) => [normalize(c.address), c.labels]));
  const shown = all ? transfers : transfers.slice(0, pageSize);
  return (
    <>
      <DataTable minWidth={680}>
        <thead>
          <tr>
            <th scope="col">Direction</th>
            <th scope="col">Kind</th>
            <th scope="col">Amount</th>
            <th scope="col">Counterparty</th>
            <th scope="col">When</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((t) => {
            const dir = directionOf(t, subject);
            const d = DIR_STYLE[dir];
            const Icon = d.icon;
            const cp = dir === "in" ? t.from : t.to;
            const cpLabels = labels.get(normalize(cp.address)) ?? [];
            const url = explorerTxUrl(t.chain, t.txHash);
            return (
              <tr key={t.id} className={cn(!t.successful && "text-ink-soft")}>
                <td>
                  <span className={cn("inline-flex items-center gap-1 rounded-full border-2 border-line px-2.5 py-0.5 text-[13px] font-bold text-ink", d.className, !t.successful && "opacity-60")}>
                    <Icon className="size-3.5" aria-hidden />
                    {d.label}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold">{kindLabel(t)}</span>
                    {!t.successful && <Tag className="text-ink-soft">failed</Tag>}
                  </div>
                  {t.kind === "path_payment" && t.sourceAsset && (
                    <span className="block text-xs text-ink-soft">
                      paid with {t.sourceAmount ? `${formatAmount(t.sourceAmount)} ` : ""}
                      {t.sourceAsset.code}
                    </span>
                  )}
                </td>
                <td className={cn("font-mono whitespace-nowrap", !t.successful && "line-through decoration-1")}>
                  {formatAmount(t.amount)} {t.asset.code}
                </td>
                <td>
                  <span className="font-mono" title={cp.address}>
                    {shortAddress(cp.address)}
                  </span>
                  {cp.muxedId && <span className="ml-1 text-xs text-ink-soft">#{cp.muxedId}</span>}
                  {cpLabels.slice(0, 2).map((l) => (
                    <Tag key={l.entity} tone={labelTone(l)} className="ml-1.5 font-sans font-semibold">
                      {l.entity}
                    </Tag>
                  ))}
                </td>
                <td className="whitespace-nowrap">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" title={formatDateTime(t.timestamp)} className="text-ink-soft hover:text-iris hover:underline">
                      {timeAgo(t.timestamp)}
                      <span className="sr-only"> (open transaction in explorer)</span>
                    </a>
                  ) : (
                    <span title={formatDateTime(t.timestamp)}>{timeAgo(t.timestamp)}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </DataTable>
      {transfers.length > pageSize && (
        <div className="border-t-2 border-line px-5 py-3">
          <button type="button" onClick={() => setAll((v) => !v)} className="min-h-10 text-sm font-bold text-iris hover:underline">
            {all ? "Show fewer" : `Show all ${transfers.length} transfers`}
          </button>
        </div>
      )}
    </>
  );
}
