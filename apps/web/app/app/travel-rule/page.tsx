"use client";

import { TRAVEL_RULE_STATUSES, type TravelRuleStatus, type TravelRuleTransferDto } from "@hera/core";
import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { counterpartyLine, personName, STATUS_META, TravelRuleStatusPill } from "@/components/travel-rule/status";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatAmount, formatDateTime, timeAgo } from "@/lib/format";
import { useTravelRuleTransfers } from "@/lib/queries";

const DAY_MS = 24 * 3600 * 1000;

function CountTile({ label, value, className }: { label: string; value: number | undefined; className: string }) {
  return (
    <div className={cn("rounded-[14px] border-2 border-line p-3.5 shadow-hard-sm", className)}>
      <span className="text-[13px]">{label}</span>
      <div className="font-display text-[30px] leading-tight font-extrabold">{value ?? <Skeleton className="mt-1 h-8 w-12" />}</div>
    </div>
  );
}

function counts(transfers: TravelRuleTransferDto[] | undefined) {
  if (!transfers) return undefined;
  const since = Date.now() - 30 * DAY_MS;
  const recent = (t: TravelRuleTransferDto) => new Date(t.updatedAt).getTime() >= since;
  return {
    draft: transfers.filter((t) => t.status === "draft").length,
    awaiting: transfers.filter((t) => t.status === "awaiting_counterparty").length,
    unhosted: transfers.filter((t) => t.status === "unhosted_verification").length,
    settled: transfers.filter((t) => t.status === "settled" && recent(t)).length,
    rejected: transfers.filter((t) => t.status === "rejected" && recent(t)).length,
  };
}

export default function TravelRulePage() {
  const router = useRouter();
  const transfers = useTravelRuleTransfers();
  const [status, setStatus] = useState<TravelRuleStatus | "all">("all");
  const [query, setQuery] = useState("");
  const c = counts(transfers.data);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (transfers.data ?? []).filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (!q) return true;
      return [t.reference, personName(t.originator), personName(t.beneficiary), t.beneficiaryVasp?.name ?? "", t.asset]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [transfers.data, status, query]);

  const newButton = (
    <ButtonLink href="/app/travel-rule/new">
      <Plus aria-hidden className="size-4" strokeWidth={3} /> New transfer
    </ButtonLink>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Travel Rule" description="IVMS101 messages with counterparty VASPs, tracked to settlement." actions={newButton} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5" aria-label="Transfers by status" role="group">
        <CountTile label="Draft" value={c?.draft} className="bg-card" />
        <CountTile label="Awaiting counterparty" value={c?.awaiting} className="bg-iris-soft" />
        <CountTile label="Unhosted: proof needed" value={c?.unhosted} className="bg-risk-medium-soft" />
        <CountTile label="Settled · 30 days" value={c?.settled} className="bg-risk-low-soft" />
        <CountTile label="Rejected · 30 days" value={c?.rejected} className="bg-risk-severe-soft" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b-2 border-line px-5 py-4">
          <label className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5 text-sm font-semibold">
            Search
            <span className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reference, name or VASP" className="py-2 pl-9" />
            </span>
          </label>
          <label className="flex flex-[0_1_240px] flex-col gap-1.5 text-sm font-semibold">
            Status
            <Select value={status} onChange={(e) => setStatus(e.target.value as TravelRuleStatus | "all")} className="py-2">
              <option value="all">All statuses</option>
              {TRAVEL_RULE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {transfers.isPending ? (
          <LoadingBlock rows={6} />
        ) : transfers.isError ? (
          <ErrorBlock error={transfers.error} onRetry={() => transfers.refetch()} />
        ) : transfers.data.length === 0 ? (
          <EmptyState
            title="No Travel Rule transfers yet"
            body="Create one when a customer sends to or receives from another VASP. Hera checks the threshold and tracks it to settlement."
            action={newButton}
          />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-[15px] text-ink-soft">No transfers match these filters.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setStatus("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <DataTable minWidth={880}>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Direction</th>
                <th scope="col">Originator → beneficiary</th>
                <th scope="col">Amount</th>
                <th scope="col">Rulebook</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="cursor-pointer" onClick={() => router.push(`/app/travel-rule/${t.id}`)}>
                  <td>
                    <Link href={`/app/travel-rule/${t.id}`} className="font-mono font-medium underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {t.reference}
                    </Link>
                  </td>
                  <td>{t.direction === "outgoing" ? "Outgoing" : "Incoming"}</td>
                  <td>
                    <strong>{personName(t.originator)}</strong> → <strong>{personName(t.beneficiary)}</strong>
                    <div className="text-xs text-ink-soft">{counterpartyLine(t)}</div>
                  </td>
                  <td className="font-mono whitespace-nowrap">
                    {formatAmount(t.amount, 2)} {t.asset}
                  </td>
                  <td>{t.jurisdiction}</td>
                  <td>
                    <TravelRuleStatusPill status={t.status} />
                  </td>
                  <td className="whitespace-nowrap text-ink-soft">
                    <time dateTime={t.updatedAt} title={formatDateTime(t.updatedAt)}>
                      {timeAgo(t.updatedAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}
