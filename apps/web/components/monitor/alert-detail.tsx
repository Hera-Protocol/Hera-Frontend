"use client";

import { type AlertDto, type AlertStatus, type Disposition, shortAddress, type UpdateAlertInput, updateAlertSchema } from "@hera/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink, FileDown } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Pill, Tag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/field";
import { Address } from "@/components/ui/misc";
import { ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime, timeAgo } from "@/lib/format";
import { chainName, explorerTxUrl, useEvidenceExport } from "@/lib/hooks/monitor";
import { useScreenings, useUpdateAlert } from "@/lib/queries";

const HEADER: Record<AlertDto["severity"], string> = {
  low: "bg-risk-low-soft",
  medium: "bg-risk-medium-soft",
  high: "bg-risk-high-soft",
  critical: "bg-risk-severe-soft",
};
const SOLID: Record<AlertDto["severity"], string> = {
  low: "bg-risk-low",
  medium: "bg-risk-medium",
  high: "bg-risk-high",
  critical: "bg-risk-severe",
};
const STATUS_TONE: Record<AlertStatus, "sun" | "iris" | "blush" | "neutral"> = { open: "sun", in_review: "iris", escalated: "blush", closed: "neutral" };
const STATUS_LABEL: Record<AlertStatus, string> = { open: "Open", in_review: "In review", escalated: "Escalated", closed: "Closed" };

const DISPOSITIONS: { value: Disposition; label: string; on: string }[] = [
  { value: "true_positive", label: "True positive: act on it", on: "bg-risk-severe-soft" },
  { value: "false_positive", label: "False positive: no risk", on: "bg-risk-low-soft" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function AlertDetail({ alert, onBack, onMoved }: { alert: AlertDto; onBack: () => void; onMoved: (alert: AlertDto) => void }) {
  const update = useUpdateAlert(alert.id);
  const evidence = useEvidenceExport();
  const history = useScreenings(50);
  const related = history.data?.items.find((s) => s.display === alert.subjectDisplay && s.chain === alert.chain);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [action, setAction] = useState<AlertStatus | "note" | null>(null);
  const closed = alert.status === "closed";
  const txUrl = alert.txHash ? explorerTxUrl(alert.chain, alert.txHash) : undefined;

  const form = useForm<UpdateAlertInput>({
    resolver: zodResolver(updateAlertSchema),
    defaultValues: { disposition: alert.disposition, note: "" },
  });
  const { register, handleSubmit, setValue, setError, watch, reset, formState } = form;
  const disposition = watch("disposition");

  const send = (status: AlertStatus | "note") => {
    setRequestError(null);
    setAction(status);
    setValue("status", status === "note" ? undefined : status);
    void handleSubmit(async (values) => {
      const note = values.note?.trim();
      if (status === "note" && !note) {
        setError("note", { message: "Write a note first." });
        return;
      }
      const body: UpdateAlertInput = {
        ...(status !== "note" ? { status } : {}),
        ...(status === "closed" && values.disposition ? { disposition: values.disposition } : {}),
        ...(note ? { note } : {}),
      };
      try {
        const updated = await update.mutateAsync(body);
        reset({ disposition: updated.disposition, note: "", status: undefined });
        toast.success(
          status === "closed"
            ? "Alert closed"
            : status === "escalated"
              ? "Escalated"
              : status === "in_review"
                ? "Review started"
                : status === "open"
                  ? "Alert reopened"
                  : "Note added",
        );
        onMoved(updated);
      } catch (e) {
        if (e instanceof ApiError && Object.keys(e.fields).length) {
          for (const [field, message] of Object.entries(e.fields)) {
            if (field === "note" || field === "disposition") setError(field, { message });
            else setRequestError(message);
          }
        } else setRequestError(errorMessage(e));
      }
    })();
  };

  const errors = formState.errors;
  const noteError = errors.note?.message;
  const needsDisposition = action === "closed" && !disposition && Boolean(noteError);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      aria-labelledby="alert-title"
      className="overflow-hidden rounded-[18px] border-2 border-line bg-card shadow-hard-lg"
    >
      <header className={cn("flex flex-col gap-2 border-b-2 border-line px-5 py-5 sm:px-[22px]", HEADER[alert.severity])}>
        <button type="button" onClick={onBack} className="-ml-1 inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-semibold lg:hidden">
          <ArrowLeft className="size-4" aria-hidden />
          All alerts
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs text-card uppercase", SOLID[alert.severity])}>
            {alert.severity} · score {alert.score}
          </span>
          <Tag>{alert.reasonCode}</Tag>
          <Pill tone={STATUS_TONE[alert.status]}>{STATUS_LABEL[alert.status]}</Pill>
          <span className="text-[13px] text-ink-soft" title={formatDateTime(alert.createdAt)}>
            Raised {timeAgo(alert.createdAt)} by wallet monitoring
          </span>
        </div>
        <h2 id="alert-title" className="text-[26px] leading-[1.1] font-extrabold sm:text-[28px]">
          {alert.title}
        </h2>
        <p className="text-[15px] leading-relaxed">{alert.detail}</p>
      </header>

      <div className="flex flex-col gap-[18px] px-5 py-5 sm:px-[22px]">
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-sm">
          <div className="rounded-[12px] border-2 border-line bg-paper px-3 py-2.5">
            <dt className="text-xs text-ink-soft">Wallet</dt>
            <dd className="font-bold">
              {alert.walletId ? (
                <Link href={`/app/wallets/${alert.walletId}`} className="hover:text-iris hover:underline">
                  {alert.walletLabel ?? "Watched wallet"}
                </Link>
              ) : (
                <span className="font-normal text-ink-soft">No longer watched</span>
              )}
            </dd>
          </div>
          <div className="rounded-[12px] border-2 border-line bg-paper px-3 py-2.5">
            <dt className="text-xs text-ink-soft">Subject · {chainName(alert.chain)}</dt>
            <dd>
              <Address value={alert.subjectDisplay} />
            </dd>
          </div>
          <div className="rounded-[12px] border-2 border-line bg-paper px-3 py-2.5">
            <dt className="text-xs text-ink-soft">Evidence</dt>
            <dd className="font-mono">
              {alert.txHash ? (
                txUrl ? (
                  <a href={txUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-iris hover:underline" title={alert.txHash}>
                    tx {shortAddress(alert.txHash)}
                    <ExternalLink className="size-3" aria-hidden />
                    <span className="sr-only"> (opens explorer)</span>
                  </a>
                ) : (
                  <span title={alert.txHash}>tx {shortAddress(alert.txHash)}</span>
                )
              ) : (
                <span className="font-sans text-ink-soft">The subject itself</span>
              )}
            </dd>
          </div>
        </dl>

        <section className="flex flex-col gap-2.5" aria-labelledby="notes-title">
          <h3 id="notes-title" className="text-lg font-bold">
            Notes
          </h3>
          {alert.notes.length === 0 ? (
            <p className="text-sm text-ink-soft">No notes yet. Write down what you checked; it goes into the audit trail.</p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {alert.notes.map((n) => (
                <li key={n.id} className="flex gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-line bg-iris text-xs font-extrabold text-card" aria-hidden>
                    {initials(n.author)}
                  </span>
                  <div className="min-w-0 rounded-[12px] border-2 border-line bg-paper px-3 py-2.5 text-sm leading-normal">
                    <strong>{n.author}</strong>{" "}
                    <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)} className="text-xs text-ink-soft">
                      {timeAgo(n.createdAt)}
                    </time>
                    <p className="break-words whitespace-pre-wrap">{n.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send(closed ? "note" : "closed");
          }}
          className="flex flex-col gap-3 border-t-2 border-dashed border-line pt-4"
        >
          {closed ? (
            <p className="text-sm">
              Closed as{" "}
              <strong>{alert.disposition === "true_positive" ? "true positive" : alert.disposition === "false_positive" ? "false positive" : "no disposition"}</strong>{" "}
              {timeAgo(alert.updatedAt)}.
            </p>
          ) : (
            <fieldset aria-invalid={needsDisposition || undefined} aria-describedby={needsDisposition ? "note-error" : undefined}>
              <legend className="mb-2 text-sm font-bold">Disposition</legend>
              <div className="flex flex-wrap gap-2.5">
                {DISPOSITIONS.map((d) => (
                  <label
                    key={d.value}
                    className={cn(
                      "flex min-h-11 flex-[1_1_200px] cursor-pointer items-center gap-2.5 rounded-[12px] border-2 border-line px-3 py-2.5 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-iris",
                      disposition === d.value ? d.on : "bg-card hover:bg-paper",
                      needsDisposition && "border-risk-severe",
                    )}
                  >
                    <input type="radio" value={d.value} {...register("disposition")} className="size-[18px] accent-[var(--ink)]" />
                    {d.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`note-${alert.id}`} className="text-sm font-bold">
              Note {closed ? "" : <span className="font-normal text-ink-soft">(required to close)</span>}
            </label>
            <Textarea
              id={`note-${alert.id}`}
              rows={3}
              placeholder={closed ? "Add a follow-up note" : "What did you check, and what did you decide?"}
              aria-invalid={noteError ? true : undefined}
              aria-describedby={noteError ? "note-error" : undefined}
              {...register("note")}
            />
            {noteError && (
              <span id="note-error" className="text-[13px] font-medium text-risk-severe">
                {noteError}
              </span>
            )}
          </div>

          <FormError message={requestError} />

          <div className="flex flex-wrap justify-end gap-2.5">
            {related && (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10"
                loading={evidence.isPending}
                onClick={() => evidence.exportFor(related.id)}
                title={`From the latest screening of this subject, ${timeAgo(related.createdAt)}`}
              >
                <FileDown className="size-4" aria-hidden />
                Export evidence
              </Button>
            )}
            {closed ? (
              <>
                <Button variant="secondary" size="sm" className="min-h-10" loading={update.isPending && action === "open"} onClick={() => send("open")}>
                  Reopen
                </Button>
                <Button type="submit" variant="ink" size="sm" className="min-h-10" loading={update.isPending && action === "note"}>
                  Add note
                </Button>
              </>
            ) : (
              <>
                {alert.status === "open" && (
                  <Button variant="secondary" size="sm" className="min-h-10" loading={update.isPending && action === "in_review"} onClick={() => send("in_review")}>
                    Start review
                  </Button>
                )}
                {alert.status !== "escalated" && (
                  <Button variant="secondary" size="sm" className="min-h-10" loading={update.isPending && action === "escalated"} onClick={() => send("escalated")}>
                    Escalate
                  </Button>
                )}
                <Button type="submit" variant="ink" size="sm" className="min-h-10" loading={update.isPending && action === "closed"}>
                  Close alert
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </motion.article>
  );
}
