"use client";

import { type RiskBand, shortAddress } from "@hera/core";
import { Download, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChainTag, DecisionPill, RiskChip } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Segmented } from "@/components/ui/misc";
import { formatDateTime, timeAgo } from "@/lib/format";
import { chainName, downloadCsv, splitDisplay } from "@/lib/hooks/monitor";
import { useScreenings } from "@/lib/queries";

const PAGE = 50;
/** The API caps ?limit at 200 and has no cursor yet. */
const MAX = 200;

export default function ScreeningsPage() {
  const [limit, setLimit] = useState(PAGE);
  const [band, setBand] = useState<"all" | RiskBand>("all");
  const [chain, setChain] = useState("all");
  const [q, setQ] = useState("");
  const query = useScreenings(limit);
  // Keep showing the previous page while the bigger one loads.
  const [last, setLast] = useState(query.data);
  if (query.data && query.data !== last) setLast(query.data);
  const data = query.data ?? last;

  const items = data?.items ?? [];
  const chains = useMemo(() => [...new Set(items.map((s) => s.chain))], [items]);
  const needle = q.trim().toLowerCase();
  const rows = items.filter(
    (s) =>
      (band === "all" || s.band === band) &&
      (chain === "all" || s.chain === chain) &&
      (!needle || s.display.toLowerCase().includes(needle) || s.topReason?.toLowerCase().includes(needle)),
  );
  const filtered = band !== "all" || chain !== "all" || needle;
  const canLoadMore = data ? items.length < data.total && limit < MAX : false;

  const exportCsv = () =>
    downloadCsv(
      `hera-screenings-${new Date().toISOString().slice(0, 10)}.csv`,
      ["id", "subject", "chain", "score", "band", "decision", "top_reason", "screened_at"],
      rows.map((s) => [s.id, s.display, s.chain, s.score, s.band, s.decision, s.topReason ?? "", s.createdAt]),
    );

  return (
    <>
      <PageHeader
        title="Screenings"
        description="Every screening, from the dashboard and the API."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-4" aria-hidden />
              Export CSV
            </Button>
            <ButtonLink href="/app/screen">
              <Plus className="size-4" aria-hidden />
              New screening
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-h-11 flex-[1_1_260px] items-center gap-2 rounded-[11px] border-2 border-line bg-card px-3 focus-within:outline-3 focus-within:outline-iris">
          <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
          <span className="sr-only">Filter by address, memo or reason</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by address, memo or reason"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
          />
        </label>
        <div className="max-w-full overflow-x-auto">
          <Segmented
            label="Risk band"
            value={band}
            onChange={setBand}
            options={[
              { value: "all", label: "All" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "severe", label: "Severe" },
            ]}
          />
        </div>
        <label className="flex">
          <span className="sr-only">Chain</span>
          <Select value={chain} onChange={(e) => setChain(e.target.value)} className="min-h-11 py-2 text-sm">
            <option value="all">All chains</option>
            {chains.map((c) => (
              <option key={c} value={c}>
                {chainName(c)}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Card className="overflow-hidden">
        {!data && query.isPending ? (
          <LoadingBlock rows={8} />
        ) : !data && query.isError ? (
          <ErrorBlock error={query.error} onRetry={() => query.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No screenings yet"
            body="Screen an address from the dashboard or call POST /v1/screen with an API key. Every result lands here."
            action={<ButtonLink href="/app/screen">Screen an address</ButtonLink>}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            body={`None of the ${items.length} loaded screenings match these filters.`}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setBand("all");
                  setChain("all");
                  setQ("");
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
                <th scope="col">Subject</th>
                <th scope="col">Chain</th>
                <th scope="col">Score</th>
                <th scope="col">Decision</th>
                <th scope="col">Top reason</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const { base, sub } = splitDisplay(s.display);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/app/screen?id=${s.id}`} className="font-mono font-medium hover:text-iris hover:underline" title={s.display}>
                        {shortAddress(base)}
                      </Link>
                      {sub && <div className="text-xs text-ink-soft">{sub}</div>}
                    </td>
                    <td>
                      <ChainTag chain={s.chain} />
                    </td>
                    <td>
                      <RiskChip band={s.band} score={s.score} />
                    </td>
                    <td>
                      <DecisionPill decision={s.decision} />
                    </td>
                    <td className="max-w-[260px] text-ink-soft">{s.topReason ?? "No rules fired"}</td>
                    <td className="whitespace-nowrap text-ink-soft" title={formatDateTime(s.createdAt)}>
                      {timeAgo(s.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
        {data && items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t-2 border-line px-5 py-3 text-sm">
            <span className="text-ink-soft" aria-live="polite">
              {filtered ? `${rows.length} matching · ` : ""}
              {items.length.toLocaleString("en")} of {data.total.toLocaleString("en")} loaded
            </span>
            {canLoadMore ? (
              <Button variant="secondary" size="sm" loading={query.isFetching} onClick={() => setLimit((l) => Math.min(MAX, l + PAGE))}>
                Load more
              </Button>
            ) : items.length < data.total ? (
              <span className="text-xs text-ink-soft">Showing the latest {MAX}. Use the API for the full history.</span>
            ) : null}
          </div>
        )}
      </Card>
    </>
  );
}
