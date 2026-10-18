"use client";

import type { OverviewResponse } from "@hera/core";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Day = OverviewResponse["daily"][number];

const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (date: string) => dayFmt.format(new Date(`${date}T00:00:00Z`));

function Swatch({ className }: { className: string }) {
  return <span className={`inline-block size-3 rounded-[3px] border-2 border-line ${className}`} aria-hidden />;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const d = payload?.[0]?.payload as (Day & { clear: number }) | undefined;
  if (!active || !d) return null;
  return (
    <div className="rounded-[10px] border-2 border-line bg-card px-3 py-2 text-[13px] shadow-hard-sm">
      <strong className="block">{longFmt.format(new Date(`${d.date}T00:00:00Z`))}</strong>
      <span className="flex items-center gap-1.5">
        <Swatch className="bg-iris" /> Clear <span className="ml-auto pl-3 font-mono">{d.clear}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Swatch className="bg-tangerine" /> Flagged <span className="ml-auto pl-3 font-mono">{d.flagged}</span>
      </span>
    </div>
  );
}

/** 14-day stacked bars: clear (allow) below, flagged (review/block) on top. */
export function ScreeningsChart({ daily }: { daily: Day[] }) {
  const data = daily.map((d) => ({ ...d, clear: Math.max(0, d.screenings - d.flagged) }));
  const total = data.reduce((n, d) => n + d.screenings, 0);
  const flagged = data.reduce((n, d) => n + d.flagged, 0);
  const busiest = data.reduce<(typeof data)[number] | undefined>((best, d) => (!best || d.screenings > best.screenings ? d : best), undefined);
  const first = data[0]?.date;
  const mid = data[Math.floor(data.length / 2)]?.date;
  const last = data.at(-1)?.date;
  const summary =
    total === 0
      ? "No screenings in the last 14 days."
      : `${total} screenings in the last 14 days, ${flagged} flagged.${busiest ? ` Busiest day ${longFmt.format(new Date(`${busiest.date}T00:00:00Z`))} with ${busiest.screenings}.` : ""}`;

  return (
    <figure className="brutal flex flex-col gap-4 p-5">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <strong className="font-display text-xl">Screenings, last 14 days</strong>
        <span className="flex gap-3.5 text-[13px]">
          <span className="flex items-center gap-1.5">
            <Swatch className="bg-iris" />
            Clear
          </span>
          <span className="flex items-center gap-1.5">
            <Swatch className="bg-tangerine" />
            Flagged
          </span>
        </span>
        <span className="sr-only">{summary}</span>
      </figcaption>
      <div className="relative h-[190px]" aria-hidden>
        {total === 0 && (
          <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft">Nothing screened yet. Bars appear as you screen.</p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 2, bottom: 0, left: 2 }} barCategoryGap="16%" accessibilityLayer={false}>
            <XAxis
              dataKey="date"
              ticks={[first, mid, last].filter((t): t is string => Boolean(t))}
              tickFormatter={(d: string) => (d === last ? "Today" : dayLabel(d))}
              tickLine={false}
              axisLine={{ stroke: "var(--line)", strokeWidth: 2 }}
              tick={{ fill: "var(--ink-soft)", fontSize: 12, fontFamily: "var(--font-dm-mono), monospace" }}
              interval={0}
              tickMargin={8}
            />
            <YAxis hide allowDecimals={false} domain={[0, (max: number) => Math.max(4, max)]} />
            <Tooltip cursor={{ fill: "var(--paper-2)" }} content={(props) => <ChartTooltip active={props.active} payload={props.payload} />} isAnimationActive={false} />
            <Bar dataKey="clear" stackId="day" fill="var(--iris)" stroke="var(--line)" strokeWidth={2} animationDuration={700} />
            <Bar dataKey="flagged" stackId="day" fill="var(--tangerine)" stroke="var(--line)" strokeWidth={2} radius={[4, 4, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Screenings per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Clear</th>
            <th scope="col">Flagged</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel(d.date)}</th>
              <td>{d.clear}</td>
              <td>{d.flagged}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
