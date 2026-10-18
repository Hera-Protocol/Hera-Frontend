"use client";

import { getChain, getJurisdiction, TRAVEL_RULE_TRANSITIONS, type TravelRuleStatus } from "@hera/core";
import { ArrowLeft, ExternalLink, FileDown } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { chainName, TRANSITION_LABEL, TravelRuleStatusPill, txHashFromEvents } from "@/components/travel-rule/status";
import { StatusTrack } from "@/components/travel-rule/status-track";
import { PartyCard, Timeline } from "@/components/travel-rule/transfer-cards";
import { TransitionDialog, txHashError } from "@/components/travel-rule/transition-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Address, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Skeleton } from "@/components/ui/misc";
import { ApiError, errorMessage } from "@/lib/api";
import { formatAmount, formatUsd } from "@/lib/format";
import { startDownload } from "@/lib/hooks/compliance";
import { reportPdfUrl, useCreateReport, useMe, useTravelRuleTransfer } from "@/lib/queries";

export default function TravelRuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const transfer = useTravelRuleTransfer(id);
  const me = useMe();
  const createReport = useCreateReport();
  const [dialog, setDialog] = useState<{ to: TravelRuleStatus; txHash?: string } | null>(null);
  const [settleHash, setSettleHash] = useState("");
  const [settleTouched, setSettleTouched] = useState(false);

  if (transfer.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy>
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-24 w-full" />
        <LoadingBlock rows={5} />
      </div>
    );
  }
  if (transfer.isError) {
    if (transfer.error instanceof ApiError && transfer.error.status === 404) {
      return (
        <Card>
          <EmptyState
            title="Transfer not found"
            body="It may belong to another organization, or the link is wrong."
            action={<ButtonLink href="/app/travel-rule">Back to Travel Rule</ButtonLink>}
            mood="alarmed"
          />
        </Card>
      );
    }
    return (
      <Card>
        <ErrorBlock error={transfer.error} onRetry={() => transfer.refetch()} />
      </Card>
    );
  }

  const t = transfer.data;
  const next = TRAVEL_RULE_TRANSITIONS[t.status];
  const jurisdiction = getJurisdiction(t.jurisdiction);
  const creator = t.events.find((e) => e.status === "draft")?.actor ?? t.events[0]?.actor;
  const settledTx = txHashFromEvents(t);
  const canSettle = next.includes("settled");
  const settleError = settleTouched ? txHashError(t.chain, settleHash) : null;
  const explorerUrl = settledTx ? getChain(t.chain).explorerTxUrl(settledTx) : undefined;

  const exportPdf = async () => {
    try {
      const report = await createReport.mutateAsync({ type: "travel_rule", transferId: t.id });
      startDownload(reportPdfUrl(report.id));
      toast.success(`Record ${report.reference} ready`, {
        description: "The PDF is downloading. It's also saved in Reports.",
        action: { label: "View", onClick: () => router.push(`/app/reports/${report.id}`) },
      });
    } catch (error) {
      toast.error("Couldn't export the record", { description: errorMessage(error) });
    }
  };

  const originatorVasp = t.direction === "outgoing" ? me.data?.org.name : undefined;
  const beneficiaryVasp = t.beneficiaryVasp ? (
    <span>
      {t.beneficiaryVasp.name}
      {t.beneficiaryVasp.domain && <span className="font-mono text-[13px] text-ink-soft"> · {t.beneficiaryVasp.domain}</span>}
      {t.beneficiaryVasp.lei && <span className="block font-mono text-[13px] text-ink-soft">LEI {t.beneficiaryVasp.lei}</span>}
    </span>
  ) : (
    "Self-hosted wallet"
  );

  return (
    <div className="flex flex-col gap-[22px]">
      <Link href="/app/travel-rule" className="inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" /> All transfers
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[34px] tracking-[-0.03em] sm:text-[38px]">{t.reference}</span>
            <TravelRuleStatusPill status={t.status} className="font-sans text-sm" />
          </span>
        }
        description={`${t.direction === "outgoing" ? "Outgoing" : "Incoming"} · ${formatAmount(t.amount, 7)} ${t.asset} on ${chainName(t.chain)} (${formatUsd(t.amountUsd)}) · ${t.jurisdiction} rulebook${creator ? ` · created by ${creator}` : ""}`}
        actions={
          <>
            <Button variant="secondary" onClick={exportPdf} loading={createReport.isPending}>
              <FileDown aria-hidden className="size-4" /> Export record PDF
            </Button>
            {next.map((to) => (
              <Button key={to} variant={to === "rejected" ? "danger" : "secondary"} onClick={() => setDialog({ to })}>
                {TRANSITION_LABEL[to]}
              </Button>
            ))}
          </>
        }
      />

      <StatusTrack transfer={t} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-[18px]">
        <PartyCard role="Originator" person={t.originator} account={t.originatorAccount} vasp={originatorVasp} />
        <PartyCard role="Beneficiary" person={t.beneficiary} account={t.beneficiaryAccount} vasp={beneficiaryVasp} />
      </div>

      <div className="flex flex-wrap items-start gap-[18px]">
        <Card className="min-w-0 flex-[999_1_480px] overflow-hidden">
          <CardHeader title="Timeline" />
          <Timeline events={t.events} />
        </Card>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-[18px]">
          <section className={`flex flex-col gap-2 rounded-[16px] border-2 border-line p-[18px] shadow-hard ${t.check.required ? "bg-risk-medium-soft" : "bg-peacock-soft"}`}>
            <h3 className="text-lg font-bold">Rule check</h3>
            <p className="text-sm leading-normal">{t.check.explanation}</p>
            <p className="font-mono text-xs text-ink-soft">
              {jurisdiction.name} · {jurisdiction.reference} · threshold {formatUsd(t.check.thresholdUsd)}
            </p>
            {t.check.unhostedProofRequired && (
              <p className="text-sm font-semibold">Proof of wallet control is required before this settles.</p>
            )}
          </section>

          <section className="brutal flex flex-col gap-2.5 p-[18px]">
            <h3 className="text-lg font-bold">Settlement</h3>
            {settledTx ? (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">Transaction hash</span>
                <Address value={settledTx} />
                {explorerUrl && (
                  <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-iris underline-offset-2 hover:underline">
                    View on explorer <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                )}
              </div>
            ) : null}
            {t.status !== "settled" && t.status !== "rejected" && (
              <form
                className="flex flex-col gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSettleTouched(true);
                  if (!canSettle || txHashError(t.chain, settleHash)) return;
                  setDialog({ to: "settled", txHash: settleHash.trim() });
                }}
              >
                <Field label="Transaction hash" error={settleError ?? undefined} hint={canSettle ? "Paste it once it's on-chain." : undefined}>
                  {({ id: inputId, describedBy, invalid }) => (
                    <Input
                      id={inputId}
                      mono
                      value={settleHash}
                      onChange={(e) => setSettleHash(e.target.value)}
                      onBlur={() => setSettleTouched(true)}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      placeholder="Paste once settled on-chain"
                      className="bg-paper py-2.5 text-[13px]"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  )}
                </Field>
                <Button type="submit" variant="secondary" disabled={!canSettle}>
                  {canSettle ? "Mark settled" : t.beneficiaryVasp ? "Mark settled (after acceptance)" : "Mark settled (after verification)"}
                </Button>
              </form>
            )}
            {t.status === "rejected" && <p className="text-sm text-ink-soft">This transfer was rejected, so it won&apos;t settle.</p>}
          </section>
        </aside>
      </div>

      <TransitionDialog
        transferId={t.id}
        chain={t.chain}
        to={dialog?.to ?? null}
        initialTxHash={dialog?.txHash ?? ""}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
