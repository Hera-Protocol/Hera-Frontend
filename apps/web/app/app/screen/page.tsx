"use client";

import type { ChainId, ScreeningResponse } from "@hera/core";
import { RotateCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Argus } from "@/components/brand/argus";
import { SCREEN_EXAMPLES } from "@/components/screening/examples";
import { ScreeningResultView } from "@/components/screening/result";
import { ScanningState } from "@/components/screening/scanning";
import { ChainOptions, SubjectHint } from "@/components/screening/subject-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui/misc";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  type ChainChoice,
  classifyScreenError,
  draftToRequest,
  fullAddressLength,
  type MemoType,
  type SubjectDraft,
  subjectToRequest,
  useSubjectCheck,
} from "@/lib/hooks/monitor";
import { useScreen, useScreening } from "@/lib/queries";

export default function ScreenPage() {
  return (
    <Suspense fallback={<LoadingBlock rows={3} />}>
      <ScreenView />
    </Suspense>
  );
}

const MEMO_TYPES: MemoType[] = ["id", "text", "hash"];

function draftFromParams(params: URLSearchParams): SubjectDraft {
  const memo = params.get("memo") ?? "";
  const memoType = params.get("memoType") as MemoType | null;
  const chain = params.get("chain");
  return {
    address: params.get("address") ?? "",
    chain: chain === "stellar" || (chain && /^evm:\d+$/.test(chain)) ? (chain as ChainId) : "detect",
    memoType: memoType && MEMO_TYPES.includes(memoType) ? memoType : /^\d*$/.test(memo) ? "id" : /^[0-9a-f]{64}$/i.test(memo) ? "hash" : "text",
    memo,
  };
}

function ScreenView() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const [draft, setDraft] = useState<SubjectDraft>(() => draftFromParams(params));
  const [touched, setTouched] = useState(false);
  const check = useSubjectCheck(draft);
  const screen = useScreen();
  const past = useScreening(id);
  const ran = useRef<string | null>(null);
  const [lastRequest, setLastRequest] = useState<SubjectDraft | null>(null);

  const run = (d: SubjectDraft) => {
    setLastRequest(d);
    screen.mutate(draftToRequest(d), {
      onSuccess: (result) => router.replace(`/app/screen?id=${result.id}`, { scroll: false }),
    });
  };

  // Auto-run once per incoming ?address= (the top bar search and links land here).
  const paramKey = params.get("address") ? params.toString() : null;
  useEffect(() => {
    if (!paramKey) {
      ran.current = null;
      return;
    }
    if (ran.current === paramKey) return;
    ran.current = paramKey;
    const d = draftFromParams(new URLSearchParams(paramKey));
    setDraft(d);
    setTouched(true);
    run(d);
  }, [paramKey]);

  // Opening a past screening fills the form with its subject.
  useEffect(() => {
    if (!past.data || screen.isPending) return;
    const req = subjectToRequest(past.data.subject);
    setDraft({ address: req.address, chain: req.chain ?? "detect", memoType: req.memo?.type ?? "id", memo: req.memo?.value ?? "" });
  }, [past.data?.id]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (check.state !== "ok") return;
    run(draft);
  };

  const pick = (address: string) => {
    const d: SubjectDraft = { address, chain: "detect", memoType: "id", memo: "" };
    setDraft(d);
    setTouched(true);
    run(d);
  };

  const err = screen.error ? classifyScreenError(screen.error) : null;
  const fieldError = err?.kind === "field" ? err : null;
  // Validate as you type, but don't shout about an address that's still being pasted or typed.
  const fullLength = fullAddressLength(draft.address);
  const localError =
    check.state === "error" && (touched || check.field !== "address" || draft.address.trim().length >= fullLength) ? check : null;
  const addressError = fieldError && fieldError.field === "address" ? fieldError.message : localError?.field === "address" ? localError.message : undefined;
  const memoError = fieldError?.field === "memo" ? fieldError.message : localError?.field === "memo" ? localError.message : undefined;
  const chainError = fieldError?.field === "chain" ? fieldError.message : localError?.field === "chain" ? localError.message : undefined;
  const addr = draft.address.trim();
  const memoDisabled = /^0x/i.test(addr) || addr.startsWith("M");
  const result: ScreeningResponse | undefined = screen.isPending ? undefined : id ? past.data : screen.data;

  return (
    <>
      <PageHeader
        title="Screen an address"
        description="Paste a Stellar G… or M… address, or an EVM 0x… address. Add a memo to screen one customer at a shared account."
      />

      <Card className="p-[18px]">
        <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-3">
          <Field label="Chain" error={chainError} className="flex-[0_1_190px]">
            {({ id: fid, describedBy, invalid }) => (
              <Select
                id={fid}
                value={draft.chain}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(e) => setDraft({ ...draft, chain: e.target.value as ChainChoice })}
              >
                <ChainOptions />
              </Select>
            )}
          </Field>
          <Field label="Address" error={addressError} className="min-w-0 flex-[1_1_380px]">
            {({ id: fid, describedBy, invalid }) => (
              <>
                <Input
                  id={fid}
                  mono
                  value={draft.address}
                  onChange={(e) => {
                    setDraft({ ...draft, address: e.target.value });
                    setTouched(false);
                    if (screen.isError) screen.reset();
                  }}
                  onBlur={() => draft.address.trim() && setTouched(true)}
                  placeholder="G…, M… or 0x…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={invalid || undefined}
                  aria-describedby={[describedBy, `${fid}-decoded`].filter(Boolean).join(" ")}
                />
                {!addressError && check.state === "ok" && <SubjectHint id={`${fid}-decoded`} check={check} />}
              </>
            )}
          </Field>
          <fieldset className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5" disabled={memoDisabled}>
            <legend className="mb-1.5 text-sm font-semibold">
              Memo <span className="font-normal text-ink-soft">(optional)</span>
            </legend>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="memo-type">
                Memo type
              </label>
              <Select
                id="memo-type"
                className="w-[96px] shrink-0 px-2.5"
                value={draft.memoType}
                onChange={(e) => setDraft({ ...draft, memoType: e.target.value as MemoType })}
              >
                <option value="id">ID</option>
                <option value="text">Text</option>
                <option value="hash">Hash</option>
              </Select>
              <label className="sr-only" htmlFor="memo-value">
                Memo value
              </label>
              <Input
                id="memo-value"
                mono
                value={draft.memo}
                onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
                placeholder={memoDisabled ? "n/a for this address" : "id, text or hash"}
                aria-invalid={memoError ? true : undefined}
                aria-describedby={memoError ? "memo-error" : undefined}
                autoComplete="off"
                className="min-w-0 disabled:opacity-50"
              />
            </div>
            {memoError && (
              <span id="memo-error" className="text-[13px] font-medium text-risk-severe">
                {memoError}
              </span>
            )}
          </fieldset>
          <Button type="submit" size="lg" loading={screen.isPending} className="w-full sm:mt-[26px] sm:w-auto">
            {screen.isPending ? "Screening…" : "Screen"}
          </Button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Try an example">
        <span className="eyebrow">Try an example:</span>
        {SCREEN_EXAMPLES.map((ex) => {
          const on = addr === ex.address;
          return (
            <button
              key={ex.id}
              type="button"
              aria-pressed={on}
              disabled={screen.isPending}
              onClick={() => pick(ex.address)}
              className={cn(
                "min-h-10 rounded-full border-2 border-line px-3.5 text-sm font-bold disabled:opacity-60",
                on ? "bg-ink text-paper shadow-[3px_3px_0_var(--peacock)]" : "bg-card hover:bg-paper-2",
              )}
            >
              {ex.label}
            </button>
          );
        })}
      </div>

      {screen.isPending ? (
        <ScanningState address={lastRequest?.address} />
      ) : err && err.kind !== "field" ? (
        <ScreenErrorCard kind={err.kind} message={err.message} onRetry={() => lastRequest && run(lastRequest)} />
      ) : result ? (
        <ScreeningResultView key={result.id} result={result} />
      ) : id && past.isPending ? (
        <Card>
          <LoadingBlock rows={5} />
        </Card>
      ) : id && past.isError ? (
        past.error instanceof ApiError && past.error.status === 404 ? (
          <Card className="p-6">
            <h2 className="text-2xl font-extrabold">That screening wasn&apos;t found</h2>
            <p className="mt-1 text-ink-soft">It may belong to another organization. Screen the address again above.</p>
          </Card>
        ) : (
          <Card>
            <ErrorBlock error={past.error} onRetry={() => past.refetch()} />
          </Card>
        )
      ) : (
        <IdleCard />
      )}
    </>
  );
}

function IdleCard() {
  return (
    <Card className="flex flex-wrap items-center gap-5 p-6">
      <Argus mood="idle" size={110} />
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
        <h2 className="text-2xl font-extrabold">Ready when you are</h2>
        <p className="text-[15px] text-ink-soft">
          Hera decodes the address, reads its recent on-chain history, checks every counterparty against its own labels and explains the score. Muxed M… addresses
          and memos are screened as the customer, not the exchange.
        </p>
      </div>
    </Card>
  );
}

function ScreenErrorCard({ kind, message, onRetry }: { kind: "chain_unavailable" | "chain_not_live" | "other"; message: string; onRetry: () => void }) {
  if (kind === "chain_not_live") {
    return (
      <Card role="alert" className="flex flex-wrap items-center gap-5 p-6">
        <Argus mood="idle" size={100} />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <span className="eyebrow">Coming soon</span>
          <h2 className="text-2xl font-extrabold">That chain isn&apos;t live yet</h2>
          <p className="text-[15px] text-ink-soft">{message} Stellar and Ethereum are live today.</p>
        </div>
      </Card>
    );
  }
  if (kind === "chain_unavailable") {
    return (
      <Card role="alert" className="flex flex-wrap items-center gap-5 p-6">
        <Argus mood="idle" size={100} />
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <h2 className="text-2xl font-extrabold">The chain data source is slow right now</h2>
          <p className="text-[15px] text-ink-soft">Hera couldn&apos;t read this address&apos;s history in time. Public explorers have bad minutes; try again.</p>
          <p className="font-mono text-xs text-ink-soft">{message}</p>
        </div>
        <Button onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden />
          Try again
        </Button>
      </Card>
    );
  }
  return (
    <Card>
      <ErrorBlock error={new Error(message)} onRetry={onRetry} />
    </Card>
  );
}
