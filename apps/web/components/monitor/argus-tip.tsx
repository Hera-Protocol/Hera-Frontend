"use client";

import type { AlertDto } from "@hera/core";
import Link from "next/link";
import { Argus } from "@/components/brand/argus";
import { timeAgo } from "@/lib/format";
import { shortSubject } from "@/lib/hooks/monitor";

/** Argus says one true thing, derived from the data on screen. */
export function ArgusTip({ openAlerts, watchedWallets }: { openAlerts: AlertDto[]; watchedWallets: number }) {
  const latest = [...openAlerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] border-2 border-line bg-peacock-soft px-3.5 py-3">
      <Argus mood={latest ? (latest.severity === "critical" ? "alarmed" : "idle") : "happy"} size={64} title="Argus" />
      <p className="text-sm leading-normal">
        <strong>Argus says:</strong>{" "}
        {latest ? (
          <>
            {latest.title.charAt(0).toLowerCase() + latest.title.slice(1)} on {latest.walletLabel ?? shortSubject(latest.subjectDisplay)}, raised {timeAgo(latest.createdAt)}.{" "}
            <Link href={`/app/alerts?id=${latest.id}`} className="font-semibold text-iris underline-offset-2 hover:underline">
              Worth a look.
            </Link>
          </>
        ) : watchedWallets > 0 ? (
          <>All quiet. No open alerts across your {watchedWallets} watched {watchedWallets === 1 ? "wallet" : "wallets"}.</>
        ) : (
          <>
            All quiet. <Link href="/app/wallets" className="font-semibold text-iris hover:underline">Watch a wallet</Link> and I&apos;ll tell you the moment something risky
            touches it.
          </>
        )}
      </p>
    </div>
  );
}
