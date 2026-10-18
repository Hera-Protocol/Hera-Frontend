"use client";

import type { AuditEventDto, AuditVerifyResponse } from "@hera/core";
import { Check, Download, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { shortHash } from "@/components/admin/format";
import { Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useAudit, useMe, useVerifyAudit } from "@/lib/queries";

const AUDIT_LIMIT = 200;
const API_KEYS = "__api_keys__";
const ANYONE = "";

const FAMILY_TONE: Record<string, "blush" | "iris" | "peacock" | "sun" | "neutral"> = {
  alert: "blush",
  api_key: "iris",
  screening: "peacock",
  wallet: "peacock",
  webhook: "iris",
  report: "blush",
  travel_rule: "blush",
  user: "sun",
  password: "sun",
};

function actorLabel(actor: string) {
  if (actor === "system") return "System";
  if (actor.startsWith("api_key:")) return `API · ${actor.slice("api_key:".length)}`;
  return actor;
}

function targetLabel(e: AuditEventDto) {
  const name = typeof e.metadata.name === "string" ? e.metadata.name : undefined;
  return name ?? e.target ?? "—";
}

export default function AuditPage() {
  const audit = useAudit();
  const verify = useVerifyAudit();
  const { data: me } = useMe();
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [action, setAction] = useState(ANYONE);
  const [actor, setActor] = useState(ANYONE);

  const entries = useMemo(() => audit.data ?? [], [audit.data]);
  const actions = useMemo(() => [...new Set(entries.map((e) => e.action))].sort(), [entries]);
  const people = useMemo(() => [...new Set(entries.map((e) => e.actor))].filter((a) => a !== "system" && !a.startsWith("api_key:")).sort(), [entries]);
  const hasApiKeys = entries.some((e) => e.actor.startsWith("api_key:"));
  const hasSystem = entries.some((e) => e.actor === "system");

  const filtered = entries.filter(
    (e) =>
      (action === ANYONE || e.action === action) &&
      (actor === ANYONE || (actor === API_KEYS ? e.actor.startsWith("api_key:") : e.actor === actor)),
  );
  const head = entries.reduce<AuditEventDto | undefined>((top, e) => (!top || e.seq > top.seq ? e : top), undefined);

  const runVerify = async () => {
    try {
      await verify.mutateAsync();
      setVerifiedAt(new Date().toISOString());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (me?.org.name ?? "org").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = url;
    a.download = `hera-audit-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Exported ${entries.length} entries`);
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only. Each entry includes the hash of the one before, so any edit breaks the chain."
        actions={
          <>
            <Button variant="secondary" size="sm" className="min-h-11 px-4 text-sm" onClick={exportJson} disabled={entries.length === 0}>
              <Download className="size-4" aria-hidden />
              Export
            </Button>
            <Button variant="ink" size="sm" className="min-h-11 px-4 text-sm" onClick={runVerify} loading={verify.isPending}>
              <ShieldCheck className="size-4" aria-hidden />
              Verify chain
            </Button>
          </>
        }
      />

      <div aria-live="polite">{verify.data && verifiedAt && <VerifyResult result={verify.data} at={verifiedAt} head={head} />}</div>

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex">
            <span className="sr-only">Action</span>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="min-h-10 rounded-[11px] border-2 border-line bg-card px-3 text-sm font-semibold"
            >
              <option value={ANYONE}>All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex">
            <span className="sr-only">Actor</span>
            <select
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="min-h-10 max-w-full rounded-[11px] border-2 border-line bg-card px-3 text-sm font-semibold"
            >
              <option value={ANYONE}>Anyone</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              {hasApiKeys && <option value={API_KEYS}>API keys</option>}
              {hasSystem && <option value="system">System</option>}
            </select>
          </label>
          {(action !== ANYONE || actor !== ANYONE) && (
            <button
              type="button"
              onClick={() => {
                setAction(ANYONE);
                setActor(ANYONE);
              }}
              className="min-h-10 px-2 text-sm font-semibold text-iris underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-[13px] text-ink-soft" aria-live="polite">
            {filtered.length === entries.length ? `${entries.length} entries` : `${filtered.length} of ${entries.length} entries`}
            {entries.length >= AUDIT_LIMIT && " · latest 200"}
          </span>
        </div>
      )}

      <Card className="overflow-hidden">
        {audit.isPending ? (
          <LoadingBlock rows={8} />
        ) : audit.isError ? (
          <ErrorBlock error={audit.error} onRetry={() => audit.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState title="Nothing in the log yet" body="Every sign-in, screening, key and webhook change lands here, chained to the entry before it." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No entries match"
            body="Try another action or actor."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setAction(ANYONE);
                  setActor(ANYONE);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <DataTable minWidth={820}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Target</th>
                <th scope="col">
                  Hash <span aria-hidden>←</span>
                  <span className="sr-only">and</span> previous
                </th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const broken = verify.data && !verify.data.valid && verify.data.brokenAt === e.seq;
                const family = e.action.split(".")[0] ?? "";
                return (
                  <tr key={e.id} className={cn(broken && "!bg-risk-severe-soft")}>
                    <td className="font-mono text-ink-soft">
                      {e.seq}
                      {broken && <span className="sr-only"> (chain breaks here)</span>}
                    </td>
                    <td>
                      <Tag tone={FAMILY_TONE[family] ?? "neutral"}>{e.action}</Tag>
                    </td>
                    <td className="max-w-[220px] truncate" title={e.actor}>
                      {actorLabel(e.actor)}
                    </td>
                    <td className="max-w-[220px] truncate text-ink-soft" title={e.target}>
                      {targetLabel(e)}
                    </td>
                    <td className="font-mono text-xs whitespace-nowrap">
                      <span title={e.hash}>{shortHash(e.hash)}…</span>{" "}
                      <span className="text-ink-soft" title={`Previous: ${e.prevHash}`}>
                        ← {shortHash(e.prevHash)}…
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-ink-soft" title={formatDateTime(e.createdAt)}>
                      {timeAgo(e.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>
    </>
  );
}

function VerifyResult({ result, at, head }: { result: AuditVerifyResponse; at: string; head?: AuditEventDto }) {
  const count = result.checked.toLocaleString("en");
  const ok = result.valid;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3.5 rounded-[16px] border-2 border-line px-[18px] py-3.5 shadow-hard",
        ok ? "bg-risk-low-soft" : "bg-risk-severe-soft",
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full text-paper", ok ? "bg-risk-low" : "bg-risk-severe")} aria-hidden>
        {ok ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-[1_1_300px]">
        <strong className={cn("text-[17px]", !ok && "text-risk-severe")}>
          {ok ? "Chain intact" : result.brokenAt !== undefined ? `Chain broken at #${result.brokenAt}` : "Chain broken"}
        </strong>
        <div className="text-sm">
          {ok ? (
            <>
              {count} {result.checked === 1 ? "entry" : "entries"} recomputed {timeAgo(at)}.
              {head && (
                <>
                  {" "}
                  Head <span className="font-mono">{shortHash(head.hash)}…{head.hash.slice(-4)}</span>.
                </>
              )}
            </>
          ) : (
            <>
              {count} {result.checked === 1 ? "entry" : "entries"} checked {timeAgo(at)}.{" "}
              {result.brokenAt !== undefined
                ? `Entry #${result.brokenAt} doesn't match its recorded hash, so it or something before it was changed. Export the log and contact support.`
                : "An entry doesn't match its recorded hash. Export the log and contact support."}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
