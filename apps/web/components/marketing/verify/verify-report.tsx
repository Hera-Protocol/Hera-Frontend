"use client";

import type { ReportType, ReportVerifyResponse } from "@hera/core";
import { FileUp, ShieldCheck, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Argus } from "@/components/brand/argus";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorBlock } from "@/components/ui/misc";
import { Stamp } from "@/components/ui/stamp";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useVerifyReport } from "@/lib/queries";

const MAX_BYTES = 50 * 1024 * 1024;

const TYPE_LABEL: Record<ReportType, string> = {
  screening_evidence: "Screening evidence report",
  travel_rule: "Travel Rule record",
  audit: "Compliance audit report",
};

/** Accepts "sha256:ABC…", spaces and line breaks from a copied footer. */
function normalizeHash(raw: string): string {
  return raw.trim().replace(/^sha-?256[:\s]*/i, "").replace(/\s+/g, "").toLowerCase();
}

const isSha256 = (v: string) => /^[0-9a-f]{64}$/.test(v);

async function sha256Hex(file: File): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Your browser can't hash files on this page. Paste the hash from the report's footer instead.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const sameRef = (a?: string, b?: string) => Boolean(a && b && a.trim().toUpperCase() === b.trim().toUpperCase());

/**
 * Public report verification. The file is hashed in the browser; only the
 * SHA-256 goes to `GET /v1/reports/verify`. `reference` comes from the
 * /verify/[reference] URL and is context only: the API matches by hash.
 */
export function VerifyReport({ reference }: { reference?: string }) {
  const verify = useVerifyReport();
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [hashing, setHashing] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hashInput, setHashInput] = useState("");
  const [hashError, setHashError] = useState<string | undefined>();

  const check = (hash: string) => {
    setHashError(undefined);
    verify.mutate(hash);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    if (file.size > MAX_BYTES) {
      setFileError("That file is over 50 MB, which is bigger than any Hera report. Check you picked the right one.");
      return;
    }
    setHashing(file.name);
    try {
      const hex = await sha256Hex(file);
      setFileName(file.name);
      setHashInput(hex);
      check(hex);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Couldn't read that file. Try again, or paste its hash.");
    } finally {
      setHashing(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files[0]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const hash = normalizeHash(hashInput);
    if (!isSha256(hash)) {
      setHashError(hash ? "A SHA-256 is 64 characters, using only 0–9 and a–f." : "Paste the hash from the report's footer.");
      return;
    }
    setFileName(null);
    setHashInput(hash);
    check(hash);
  };

  const checked = verify.variables;

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 pt-12 pb-20 sm:px-6 sm:pt-16 lg:flex-row lg:items-start">
      <section aria-labelledby="verify-title" className="flex min-w-0 flex-1 flex-col gap-[18px]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-[18px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="eyebrow">Public verification · no account needed</span>
            {reference && (
              <span className="rounded-lg border-2 border-line bg-sun px-2 py-0.5 font-mono text-[13px] text-[#17130F]">Checking {reference}</span>
            )}
          </div>
          <h1 id="verify-title" className="text-[clamp(38px,5vw,60px)] leading-none font-extrabold">
            Is this Hera report genuine?
          </h1>
          <p className="text-lg leading-relaxed text-ink-soft">
            Drop the PDF here, or paste the SHA-256 printed in its footer. We check the fingerprint against our records. Your file never leaves your
            browser: only its hash is sent.
          </p>
          {reference && (
            <p className="text-[15px] text-ink-soft">
              Reports are matched by their fingerprint, not the reference, so we still need the file or its hash to confirm <span className="font-mono text-ink">{reference}</span>.
            </p>
          )}
        </motion.div>

        <motion.label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          animate={{ scale: dragging ? 1.02 : 1, rotate: dragging ? -0.6 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className={cn(
            "relative flex cursor-pointer flex-col items-center gap-2.5 rounded-[18px] border-[3px] border-dashed border-line px-5 py-9 text-center transition-colors",
            "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-iris",
            dragging ? "bg-sun/30" : "bg-card hover:bg-paper-2",
          )}
        >
          <motion.span animate={dragging ? { y: -6 } : { y: 0 }} className="grid size-14 place-items-center rounded-full border-2 border-line bg-paper-2" aria-hidden>
            <FileUp className="size-7" />
          </motion.span>
          <strong className="text-[17px]">{hashing ? `Hashing ${hashing}…` : dragging ? "Drop it" : "Drop a PDF or choose a file"}</strong>
          <span className="text-sm text-ink-soft">Hashed locally with SHA-256. JSON snapshots work too.</span>
          <input
            id={inputId}
            type="file"
            accept="application/pdf,application/json,.pdf,.json"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = ""; // so picking the same file again re-checks it
            }}
          />
        </motion.label>
        {fileError && (
          <p role="alert" className="flex items-start gap-2 text-sm font-medium text-risk-severe">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {fileError}
          </p>
        )}

        <form onSubmit={onSubmit} noValidate>
          <Field label="Or paste a hash" hint="The 64-character SHA-256 from the report's footer." error={hashError}>
            {({ id, describedBy, invalid }) => (
              <div className="flex gap-2.5">
                <Input
                  id={id}
                  mono
                  value={hashInput}
                  onChange={(e) => {
                    setHashInput(e.target.value);
                    if (hashError) setHashError(undefined);
                  }}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="4be1f0c2d97a…"
                  className="min-w-0 flex-1"
                />
                <Button type="submit" loading={verify.isPending} className="shrink-0">
                  Verify
                </Button>
              </div>
            )}
          </Field>
        </form>
      </section>

      <section aria-label="Result" className="flex min-w-0 flex-1 flex-col gap-4 lg:sticky lg:top-24">
        <div aria-live="polite" aria-busy={verify.isPending || Boolean(hashing)}>
          <AnimatePresence mode="wait">
            {hashing || verify.isPending ? (
              <Panel key="pending" className="items-center bg-card text-center">
                <div>
                  <Argus mood="scanning" size={120} title="Argus checking the fingerprint" />
                </div>
                <h2 className="text-2xl font-extrabold">{hashing ? "Reading the file…" : "Checking the fingerprint…"}</h2>
              </Panel>
            ) : verify.isError ? (
              <Panel key="error" className="bg-card p-0">
                <ErrorBlock error={verify.error} onRetry={checked ? () => verify.mutate(checked) : undefined} />
              </Panel>
            ) : verify.data && checked ? (
              verify.data.valid ? (
                <Genuine key={`ok-${checked}`} data={verify.data} hash={checked} fileName={fileName} reference={reference} />
              ) : (
                <NoMatch key={`no-${checked}`} hash={checked} reference={reference} />
              )
            ) : (
              <Panel key="idle" className="items-center bg-card text-center">
                <div>
                  <Argus mood="idle" size={120} title="Argus waiting for a report" />
                </div>
                <h2 className="text-2xl font-extrabold">Waiting for a report</h2>
                <p className="max-w-sm text-[15px] text-ink-soft">
                  Every PDF and JSON snapshot Hera issues has a SHA-256 fingerprint on record. Change one byte and it no longer matches.
                </p>
              </Panel>
            )}
          </AnimatePresence>
        </div>

        <aside className="flex items-start gap-3 rounded-[16px] border-2 border-line bg-paper-2 p-[18px] shadow-hard-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm leading-normal">
            If a hash doesn&apos;t match, the file was changed after Hera issued it, or it never came from Hera. Ask the sender for the original.
          </p>
        </aside>
      </section>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      className={cn("flex flex-col gap-3.5 rounded-[20px] border-2 border-line p-6 shadow-[6px_6px_0_var(--shadow-color)] sm:p-[26px]", className)}
    >
      {children}
    </motion.div>
  );
}

function HashLine({ hash, fileName }: { hash: string; fileName?: string | null }) {
  return (
    <p className="font-mono text-xs leading-normal break-all text-ink-soft">
      {fileName && <span className="block truncate text-ink">{fileName}</span>}
      sha256 {hash}
    </p>
  );
}

function Genuine({ data, hash, fileName, reference }: { data: ReportVerifyResponse; hash: string; fileName: string | null; reference?: string }) {
  const mismatch = reference && data.reference && !sameRef(reference, data.reference);
  const rows: [string, ReactNode][] = [
    ["Reference", data.reference ? <span className="font-mono">{data.reference}</span> : "—"],
    ["Type", data.type ? TYPE_LABEL[data.type] : "—"],
    ["Issued to", data.orgName ?? "—"],
    ["Generated", data.createdAt ? formatDateTime(data.createdAt) : "—"],
    ["Matched", data.matched === "json" ? "JSON snapshot fingerprint" : data.matched === "pdf" ? "PDF fingerprint" : "Fingerprint"],
  ];
  return (
    <Panel className="bg-risk-low-soft">
      <Stamp tone="low" className="self-start bg-card text-[26px]">
        GENUINE
      </Stamp>
      <h2 className="text-[28px] leading-[1.1] font-extrabold">Issued by Hera, unaltered.</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[15px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
      </dl>
      {mismatch && (
        <p role="alert" className="flex items-start gap-2 rounded-[12px] border-2 border-line bg-card p-3 text-sm leading-normal">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-risk-medium" aria-hidden />
          <span>
            This is a genuine Hera report, but it&apos;s <strong className="font-mono">{data.reference}</strong>, not{" "}
            <strong className="font-mono">{reference}</strong> from the link you followed. Make sure you&apos;re checking the report you were sent.
          </span>
        </p>
      )}
      <HashLine hash={hash} fileName={fileName} />
    </Panel>
  );
}

function NoMatch({ hash, reference }: { hash: string; reference?: string }) {
  return (
    <Panel className="bg-risk-severe-soft">
      <Stamp tone="severe" rotate={-5} className="self-start bg-card text-xl">
        NO MATCH
      </Stamp>
      <h2 className="text-[28px] leading-[1.1] font-extrabold">This file doesn&apos;t match our records.</h2>
      <p className="text-[15px] leading-relaxed">
        No report Hera has issued has this fingerprint
        {reference ? (
          <>
            , so it isn&apos;t an unaltered copy of <span className="font-mono">{reference}</span>
          </>
        ) : null}
        . Either the file was changed after it was issued, or it didn&apos;t come from Hera. Ask the sender for the original.
      </p>
      <HashLine hash={hash} />
    </Panel>
  );
}
