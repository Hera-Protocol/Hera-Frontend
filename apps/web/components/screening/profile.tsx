"use client";

import { CHAINS, type ScreeningResult, shortAddress } from "@hera/core";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Tag } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatAmount, formatDateTime } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/hooks/monitor";
import { labelTone } from "./transfers";

const TRUNCATED: Record<string, string> = {
  page_budget: "page budget reached",
  deadline: "time budget reached",
  error: "a later page failed",
};

const TOML_TONE = { verified: "low", unlisted: "high", unavailable: "neutral" } as const;

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed border-line/25 pb-2.5 last:border-0 last:pb-0">
      <dt className="shrink-0 text-ink-soft">{k}</dt>
      <dd className="min-w-0 text-right font-mono text-[13px] font-medium break-words">{children}</dd>
    </div>
  );
}

export function ProfileFacts({ result }: { result: ScreeningResult }) {
  const { profile, stats, subject } = result;
  const chain = CHAINS[subject.chain];
  const isEvm = subject.chain !== "stellar";
  const w = profile.window;
  const flags = profile.flags
    ? [profile.flags.authRequired && "auth required", profile.flags.authRevocable && "auth revocable", profile.flags.clawbackEnabled && "clawback"].filter(Boolean)
    : null;
  const date = (iso?: string) => (iso ? formatDateTime(iso) : undefined);

  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]">
      <h2 className="text-xl font-extrabold">Profile</h2>
      <dl className="flex flex-col gap-2.5 text-sm">
        <Fact k="Exists">{profile.exists ? "yes" : "no, never seen on-chain"}</Fact>
        {isEvm && (
          <Fact k="Type">{profile.isContract ? "Contract" : profile.delegatedTo ? "Wallet (EIP-7702)" : "Wallet (EOA)"}</Fact>
        )}
        {profile.delegatedTo && (
          <Fact k="Delegates to">
            <a href={explorerAddressUrl(subject.chain, profile.delegatedTo)} target="_blank" rel="noopener noreferrer" className="text-iris hover:underline" title={profile.delegatedTo}>
              {shortAddress(profile.delegatedTo)}
            </a>
          </Fact>
        )}
        {profile.ensName && <Fact k="ENS">{profile.ensName}</Fact>}
        <Fact k="Created">{date(profile.createdAt) ?? "not observed"}</Fact>
        {(profile.firstSeen ?? stats.firstSeen) && <Fact k="First seen">{date(profile.firstSeen ?? stats.firstSeen)}</Fact>}
        {stats.lastSeen && <Fact k="Last seen">{date(stats.lastSeen)}</Fact>}
        {profile.homeDomain && (
          <Fact k="Home domain">
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
              {profile.homeDomain}
              {profile.toml && <Tag tone={TOML_TONE[profile.toml.status]}>toml {profile.toml.status}</Tag>}
            </span>
          </Fact>
        )}
        {profile.toml?.orgName && <Fact k="Organization">{profile.toml.orgName}</Fact>}
        {flags && <Fact k="Flags">{flags.length ? flags.join(", ") : "none"}</Fact>}
        {profile.nativeBalance !== undefined && (
          <Fact k="Native balance">
            {formatAmount(profile.nativeBalance, 2)} {chain?.nativeSymbol}
          </Fact>
        )}
        <Fact k="Transfers in view">
          {stats.transfers} ({stats.inbound} in · {stats.outbound} out)
        </Fact>
        {stats.failed ? <Fact k="Failed (not scored)">{stats.failed}</Fact> : null}
        {stats.dustFiltered > 0 && <Fact k="Dust filtered">{stats.dustFiltered}</Fact>}
        {profile.sharedAccountRatio !== undefined && (
          <Fact k="Inbound with sub-account">{Math.round(profile.sharedAccountRatio * 100)}%</Fact>
        )}
        <Fact k="Observed transfers">{profile.observedTransfers}</Fact>
        <Fact k="Full history">{profile.fullHistory ? "yes" : "no, recent window only"}</Fact>
        {w && (
          <>
            <Fact k="Records read">
              {w.records}
              {Object.keys(w.pages).length > 0 && (
                <span className="block text-xs text-ink-soft">
                  {Object.entries(w.pages)
                    .map(([k, v]) => `${k} ×${v}`)
                    .join(" · ")}
                </span>
              )}
            </Fact>
            {w.truncatedBy && <Fact k="Window cut by">{TRUNCATED[w.truncatedBy] ?? w.truncatedBy}</Fact>}
            {w.oldest && <Fact k="Oldest record">{date(w.oldest)}</Fact>}
            {w.claimsResolved || w.claimsSkipped ? (
              <Fact k="Claims">
                {w.claimsResolved ?? 0} resolved{w.claimsSkipped ? ` · ${w.claimsSkipped} skipped` : ""}
              </Fact>
            ) : null}
          </>
        )}
      </dl>
    </Card>
  );
}

/** Warning when part (or all) of the chain data didn't arrive. */
export function DataStatusBanner({ result }: { result: ScreeningResult }) {
  const status = result.profile.dataStatus;
  if (!status || status === "complete") return null;
  const missing = result.profile.window?.missing;
  return (
    <div role="status" className="flex items-start gap-3 rounded-[14px] border-2 border-line bg-paper-2 px-4 py-3 text-[15px] shadow-hard-sm">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-tangerine" aria-hidden />
      <p>
        {status === "partial" ? (
          <>
            <strong>Partial chain data.</strong> {missing?.length ? `${missing.join(", ")} didn't answer in time. ` : "A data source didn't answer in time. "}
            The score rests on what did arrive. Rescreen in a minute for the full picture.
          </>
        ) : (
          <>
            <strong>Chain data unavailable.</strong> No data source answered, so this score rests on Hera&apos;s labels alone. Rescreen before relying on it.
          </>
        )}
      </p>
    </div>
  );
}

export function TopCounterparties({ result, limit = 6 }: { result: ScreeningResult; limit?: number }) {
  const top = [...result.counterparties].sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound)).slice(0, limit);
  return (
    <Card className="flex flex-col gap-3 px-5 py-[18px]">
      <h2 className="text-xl font-extrabold">Top counterparties</h2>
      {top.length === 0 ? (
        <p className="text-sm text-ink-soft">No counterparties in the window Hera read.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {top.map((c) => {
            const url = explorerAddressUrl(result.subject.chain, c.address);
            return (
              <li key={`${c.address}-${c.muxedId ?? ""}`} className="flex flex-wrap items-center gap-2 text-sm">
                <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono hover:text-iris hover:underline" title={c.address}>
                  {shortAddress(c.address)}
                  {c.muxedId && <span className="text-xs text-ink-soft"> #{c.muxedId}</span>}
                </a>
                {c.labels.slice(0, 2).map((l) => (
                  <Tag key={l.entity} tone={labelTone(l)} className="font-sans font-semibold" title={`${l.category.replace(/_/g, " ")} · ${l.source}`}>
                    {l.entity}
                  </Tag>
                ))}
                <span className="ml-auto font-mono text-xs text-ink-soft">
                  {c.inbound + c.outbound}×<span className="sr-only"> transfers ({c.inbound} in, {c.outbound} out)</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
