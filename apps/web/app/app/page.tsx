"use client";

import type { AlertDto } from "@hera/core";
import { Plus } from "lucide-react";
import Link from "next/link";
import { SeverityDot, alertContext, shortAgo } from "@/components/monitor/alert-bits";
import { ArgusTip } from "@/components/monitor/argus-tip";
import { Onboarding } from "@/components/monitor/onboarding";
import { RiskMix } from "@/components/monitor/risk-mix";
import { ScreeningsChart } from "@/components/monitor/screenings-chart";
import { ChainTag, RiskChip } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { DataTable, EmptyState, ErrorBlock, PageHeader, Skeleton } from "@/components/ui/misc";
import { timeAgo } from "@/lib/format";
import { chainName, firstName, greetingFor, shortSubject } from "@/lib/hooks/monitor";
import { useAlerts, useMe, useOverview, useTravelRuleTransfers, useWallets } from "@/lib/queries";

const SEVERITY_ORDER: AlertDto["severity"][] = ["critical", "high", "medium", "low"];

export default function OverviewPage() {
  const { data: me } = useMe();
  const overview = useOverview();
  const open = useAlerts("open");
  const wallets = useWallets();
  const travel = useTravelRuleTransfers();

  if (overview.isPending) return <OverviewSkeleton />;
  if (overview.isError) {
    return (
      <>
        <PageHeader title={`${greetingFor()}, ${firstName(me?.user.name)}`} />
        <Card>
          <ErrorBlock error={overview.error} onRetry={() => overview.refetch()} />
        </Card>
      </>
    );
  }

  const o = overview.data;
  if (o.screeningsTotal === 0 && o.watchedWallets === 0) {
    return <Onboarding screeningsTotal={o.screeningsTotal} watchedWallets={o.watchedWallets} />;
  }

  // Needs a decision: anything not closed, newest first.
  const pending = (open.data ?? o.recentAlerts.filter((a) => a.status !== "closed")).slice(0, 5);
  const openCount = open.data?.length;
  const severityHint = open.data
    ? SEVERITY_ORDER.map((s) => [s, open.data.filter((a) => a.severity === s).length] as const)
        .filter(([, n]) => n > 0)
        .map(([s, n]) => `${n} ${s}`)
        .join(" · ")
    : undefined;
  const chainHint = wallets.data?.length
    ? Object.entries(
        wallets.data.reduce<Record<string, number>>((acc, w) => {
          acc[chainName(w.chain)] = (acc[chainName(w.chain)] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([name, n]) => `${n} ${name}`)
        .join(" · ")
    : undefined;
  const awaiting = travel.data?.filter((t) => t.status === "awaiting_counterparty").length;
  const decisionLine =
    o.openAlerts === 0
      ? "Nothing needs a decision. Everything looks calm."
      : `${o.openAlerts} ${o.openAlerts === 1 ? "alert needs" : "alerts need"} a decision${openCount !== undefined && openCount < o.openAlerts ? ` (${o.openAlerts - openCount} already in review or escalated)` : ""}.`;

  return (
    <>
      <PageHeader
        title={`${greetingFor()}, ${firstName(me?.user.name)}`}
        description={decisionLine}
        actions={
          <>
            <ButtonLink href="/app/reports" variant="secondary">
              Export a report
            </ButtonLink>
            <ButtonLink href="/app/screen">
              <Plus className="size-4" aria-hidden />
              Screen an address
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
        <StatTile label="Screenings · 24h" value={o.screenings24h} hint={`${o.screeningsTotal.toLocaleString("en")} all time`} />
        <Link href="/app/alerts" className="rounded-[16px]">
          <StatTile label="Open alerts" value={o.openAlerts} tone={o.openAlerts > 0 ? "severe" : "default"} hint={o.openAlerts > 0 ? severityHint || "awaiting a decision" : "queue is clear"} />
        </Link>
        <Link href="/app/wallets" className="rounded-[16px]">
          <StatTile label="Watched wallets" value={o.watchedWallets} hint={chainHint ?? (o.watchedWallets ? undefined : "none yet")} />
        </Link>
        <Link href="/app/travel-rule" className="rounded-[16px]">
          <StatTile label="Travel Rule · open" value={o.travelRuleOpen} hint={awaiting ? `${awaiting} awaiting counterparty` : o.travelRuleOpen ? "in progress" : "nothing in flight"} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
        <ScreeningsChart daily={o.daily} />
        <Card className="flex flex-col gap-4 p-5">
          <strong className="font-display text-xl">Risk mix</strong>
          <RiskMix mix={o.bandMix} />
          <div className="mt-auto">
            <ArgusTip openAlerts={open.data ?? o.recentAlerts.filter((a) => a.status === "open")} watchedWallets={o.watchedWallets} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Recent screenings"
            action={
              <Link href="/app/screenings" className="text-sm font-semibold text-iris hover:underline">
                View all
              </Link>
            }
          />
          {o.recentScreenings.length === 0 ? (
            <EmptyState title="No screenings yet" body="Screen an address and it shows up here." action={<ButtonLink href="/app/screen">Screen an address</ButtonLink>} />
          ) : (
            <DataTable minWidth={420}>
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Chain</th>
                  <th scope="col">Score</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {o.recentScreenings.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/app/screen?id=${s.id}`} className="font-mono hover:text-iris hover:underline" title={s.display}>
                        {shortSubject(s.display)}
                      </Link>
                    </td>
                    <td>
                      <ChainTag chain={s.chain} />
                    </td>
                    <td>
                      <RiskChip band={s.band} score={s.score} />
                    </td>
                    <td className="whitespace-nowrap text-ink-soft">{timeAgo(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Needs a decision"
            action={
              <Link href="/app/alerts" className="text-sm font-semibold text-iris hover:underline">
                Open queue
              </Link>
            }
          />
          {open.isError && !pending.length ? (
            <ErrorBlock error={open.error} onRetry={() => open.refetch()} />
          ) : pending.length === 0 ? (
            <EmptyState title="All clear" body="No open alerts. Hera keeps rescreening your watched wallets in the background." mood="happy" />
          ) : (
            <ul>
              {pending.map((a, i) => (
                <li key={a.id} className={i > 0 ? "border-t border-dashed border-line/25" : undefined}>
                  <Link href={`/app/alerts?id=${a.id}`} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-paper">
                    <SeverityDot severity={a.severity} className="mt-1.5" />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <strong className="text-[15px]">{a.title}</strong>
                      <span className="truncate text-[13px] text-ink-soft">
                        {alertContext(a)} · <span className="capitalize">{a.severity}</span>
                      </span>
                    </div>
                    <span className="font-mono text-xs text-ink-soft" title={timeAgo(a.createdAt)}>
                      {shortAgo(a.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading overview">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[118px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}
