"use client";

import type { ScreeningResponse } from "@hera/core";
import { ArrowLeftRight, Eye, FileDown } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { WatchWalletDialog } from "@/components/monitor/watch-wallet-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime, timeAgo } from "@/lib/format";
import { subjectToRequest, useEvidenceExport } from "@/lib/hooks/monitor";
import { DataStatusBanner, ProfileFacts, TopCounterparties } from "./profile";
import { ReasonsList } from "./reasons";
import { TransfersTable } from "./transfers";
import { VerdictCard } from "./verdict";

/** The full screening result: verdict, actions, reasons, transfers, profile. */
export function ScreeningResultView({ result }: { result: ScreeningResponse }) {
  const [watching, setWatching] = useState(false);
  const evidence = useEvidenceExport();
  const request = subjectToRequest(result.subject);
  const travelRuleHref = `/app/travel-rule/new?beneficiary=${encodeURIComponent(request.address)}&chain=${encodeURIComponent(result.subject.chain)}`;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-wrap items-start gap-[22px]">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-[22px]">
        <VerdictCard result={result}>
          <Button variant="ink" size="sm" className="min-h-10" onClick={() => setWatching(true)}>
            <Eye className="size-4" aria-hidden />
            Watch this wallet
          </Button>
          <ButtonLink variant="secondary" size="sm" className="min-h-10" href={travelRuleHref}>
            <ArrowLeftRight className="size-4" aria-hidden />
            Start Travel Rule transfer
          </ButtonLink>
          <Button variant="secondary" size="sm" className="min-h-10" loading={evidence.isPending} onClick={() => evidence.exportFor(result.id)}>
            {!evidence.isPending && <FileDown className="size-4" aria-hidden />}
            Export evidence PDF
          </Button>
        </VerdictCard>

        <DataStatusBanner result={result} />

        <Card className="overflow-hidden">
          <CardHeader title="Why this score" action={<span className="font-mono text-xs text-ink-soft">engine {result.engineVersion}</span>} />
          <ReasonsList reasons={result.reasons} chain={result.subject.chain} />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recent transfers"
            action={
              <span className="font-mono text-xs text-ink-soft">
                {result.stats.transfers} in view{result.stats.failed ? ` · ${result.stats.failed} failed` : ""}
              </span>
            }
          />
          <TransfersTable transfers={result.transfers} subject={result.subject} counterparties={result.counterparties} />
        </Card>
      </div>

      <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-[22px]">
        <ProfileFacts result={result} />
        <TopCounterparties result={result} />
        <p className="text-[13px] leading-normal text-ink-soft">
          Screened <time dateTime={result.screenedAt} title={formatDateTime(result.screenedAt)}>{timeAgo(result.screenedAt)}</time> with engine{" "}
          <span className="font-mono">{result.engineVersion}</span>. Every label shows its source. Hera uses public records, on-chain facts and its own analysis,
          never resold vendor data.
        </p>
      </aside>

      <WatchWalletDialog open={watching} onClose={() => setWatching(false)} subject={request} subjectDisplay={result.display} />
    </motion.div>
  );
}
