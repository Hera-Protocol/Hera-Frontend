"use client";

import { ALERT_STATUSES, type AlertDto, type AlertStatus } from "@hera/core";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertDetail } from "@/components/monitor/alert-detail";
import { SEVERITY_BAR, SEVERITY_TEXT, alertContext, shortAgo } from "@/components/monitor/alert-bits";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useAlerts } from "@/lib/queries";

const TAB_LABEL: Record<AlertStatus, string> = { open: "Open", in_review: "In review", escalated: "Escalated", closed: "Closed" };

const EMPTY: Record<AlertStatus, { title: string; body: string }> = {
  open: { title: "No open alerts", body: "Nothing needs a decision. Hera raises an alert when a watched wallet picks up a reason worth 25 points or more." },
  in_review: { title: "Nothing in review", body: "Start a review on an open alert to park it here while you investigate." },
  escalated: { title: "Nothing escalated", body: "Escalated alerts wait here for a senior decision." },
  closed: { title: "No closed alerts yet", body: "Closed alerts keep their disposition and notes as your audit trail." },
};

export default function AlertsPage() {
  return (
    <Suspense fallback={<LoadingBlock rows={4} />}>
      <AlertsQueue />
    </Suspense>
  );
}

function AlertsQueue() {
  const router = useRouter();
  const params = useSearchParams();
  const alerts = useAlerts("all");
  const id = params.get("id");
  const statusParam = params.get("status") as AlertStatus | null;

  const all = alerts.data ?? [];
  const selected = id ? all.find((a) => a.id === id) : undefined;
  const tab: AlertStatus = statusParam && ALERT_STATUSES.includes(statusParam) ? statusParam : (selected?.status ?? "open");
  const list = all.filter((a) => a.status === tab);
  const counts = Object.fromEntries(ALERT_STATUSES.map((s) => [s, all.filter((a) => a.status === s).length])) as Record<AlertStatus, number>;
  // Desktop always shows a detail; mobile shows it only once one is picked.
  const shown = selected ?? list[0];

  const go = (next: { id?: string | null; status?: AlertStatus }) => {
    const q = new URLSearchParams();
    const status = next.status ?? tab;
    if (status !== "open") q.set("status", status);
    const nextId = next.id === undefined ? id : next.id;
    if (nextId) q.set("id", nextId);
    const s = q.toString();
    router.replace(s ? `/app/alerts?${s}` : "/app/alerts", { scroll: false });
  };

  /** After a status change, move on to the next alert left in this tab. */
  const onMoved = (alert: AlertDto) => {
    if (alert.status === tab) return;
    const idx = list.findIndex((a) => a.id === alert.id);
    const next = list[idx + 1] ?? list[idx - 1];
    go({ id: next?.id ?? null });
  };

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Every alert needs a decision and a note before it closes. That's your audit trail."
        actions={
          <div role="tablist" aria-label="Alert status" className="flex flex-wrap gap-2">
            {ALERT_STATUSES.map((s) => {
              const on = s === tab;
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  id={`tab-${s}`}
                  aria-selected={on}
                  aria-controls="alert-queue"
                  onClick={() => go({ status: s, id: null })}
                  className={cn(
                    "min-h-10 rounded-full border-2 border-line px-3.5 text-sm font-bold",
                    on ? "bg-ink text-paper shadow-[3px_3px_0_var(--peacock)]" : "bg-card hover:bg-paper-2",
                  )}
                >
                  {TAB_LABEL[s]}
                  {alerts.data && (s !== "closed" || counts.closed > 0) ? ` · ${counts[s]}` : ""}
                </button>
              );
            })}
          </div>
        }
      />

      {alerts.isPending ? (
        <Card>
          <LoadingBlock rows={5} />
        </Card>
      ) : alerts.isError ? (
        <Card>
          <ErrorBlock error={alerts.error} onRetry={() => alerts.refetch()} />
        </Card>
      ) : (
        <div id="alert-queue" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-wrap items-start gap-5">
          <div className={cn("min-w-0 flex-[1_1_320px] lg:max-w-[400px]", selected && "max-lg:hidden")}>
            {list.length === 0 ? (
              <Card>
                <EmptyState title={EMPTY[tab].title} body={EMPTY[tab].body} mood={tab === "open" ? "happy" : "idle"} />
              </Card>
            ) : (
              <ul aria-label={`${TAB_LABEL[tab]} alerts`} className="brutal overflow-hidden">
                {list.map((a, i) => {
                  const on = shown?.id === a.id;
                  return (
                    <li key={a.id} className={cn(i > 0 && "border-t border-dashed border-line/30")}>
                      <button
                        type="button"
                        onClick={() => go({ id: a.id })}
                        aria-current={on ? "true" : undefined}
                        className={cn(
                          "flex w-full flex-col gap-1 border-l-[6px] p-4 text-left hover:bg-paper",
                          SEVERITY_BAR[a.severity],
                          on && "bg-paper-2 hover:bg-paper-2 lg:shadow-[inset_0_-2px_0_var(--line),inset_0_2px_0_var(--line)]",
                        )}
                      >
                        <span className="flex justify-between gap-2">
                          <span className={cn("font-mono text-[11px] font-medium tracking-[0.08em] uppercase", SEVERITY_TEXT[a.severity])}>{a.severity}</span>
                          <span className="font-mono text-xs text-ink-soft">{shortAgo(a.createdAt)}</span>
                        </span>
                        <strong className="text-[15px]">{a.title}</strong>
                        <span className="truncate text-[13px] text-ink-soft">{alertContext(a)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {shown ? (
            <div className={cn("min-w-0 flex-[999_1_520px]", !selected && "max-lg:hidden")}>
              <AlertDetail key={shown.id} alert={shown} onBack={() => go({ id: null })} onMoved={onMoved} />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
