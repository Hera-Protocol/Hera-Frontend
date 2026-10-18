"use client";

import { decodeMuxedAccount, encodeMuxedAccount, isValidAccountId } from "@hera/core";
import { RotateCcw, Shuffle, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { MUXED_ACCOUNT_CHARS as ACCOUNT_CHARS, SAMPLE_MUXED } from "../constants";


type Result =
  | { kind: "empty" }
  | { kind: "muxed"; account: string; id: bigint; muxed: string }
  | { kind: "account"; account: string }
  | { kind: "invalid"; message: string };

function decode(raw: string): Result {
  const value = raw.replace(/\s+/g, "").toUpperCase();
  if (!value) return { kind: "empty" };
  if (value.startsWith("M")) {
    const decoded = decodeMuxedAccount(value);
    if (decoded) return { kind: "muxed", ...decoded };
    if (value.length !== 69)
      return { kind: "invalid", message: `Muxed addresses are 69 characters long. This one has ${value.length}, so something is missing or extra.` };
    return { kind: "invalid", message: "That doesn't pass the checksum. One character is probably off; check it against the original." };
  }
  if (value.startsWith("G")) {
    if (isValidAccountId(value)) return { kind: "account", account: value };
    return { kind: "invalid", message: "That G… account doesn't pass its checksum. Check for a typo." };
  }
  return { kind: "invalid", message: "Muxed Stellar addresses start with M. Paste one to see what's inside." };
}

const groupId = (id: bigint) => id.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Live SEP-23 decoder: paste an M… address, see the account and the customer behind it. */
export function MuxedDecoder() {
  const inputId = useId();
  const messageId = useId();
  const [value, setValue] = useState(SAMPLE_MUXED);
  const result = useMemo(() => decode(value), [value]);

  const baseAccount = result.kind === "muxed" || result.kind === "account" ? result.account : decodeMuxedAccount(SAMPLE_MUXED)!.account;

  const shuffle = () => {
    // A random customer under the same account. Small ids read better.
    const id = BigInt(Math.floor(Math.random() * 9_999_999) + 1);
    setValue(encodeMuxedAccount(baseAccount, id));
  };

  const message =
    result.kind === "invalid"
      ? result.message
      : result.kind === "account"
        ? "That's a plain G… account, so there's no customer ID inside. Hera screens it as is, or with the memo you send."
        : result.kind === "empty"
          ? "Paste an M… address to see who's inside."
          : null;

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border-2 border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="eyebrow text-xs">
          One M… address, decoded
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            aria-invalid={result.kind === "invalid" || undefined}
            aria-describedby={message ? messageId : undefined}
            placeholder="M…"
            className={cn(
              "min-h-11 w-full min-w-0 flex-1 rounded-[11px] border-2 border-line/60 bg-paper px-3.5 font-mono text-sm text-ink placeholder:text-ink-soft/60",
              "focus-visible:border-line aria-invalid:border-risk-severe",
            )}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={shuffle}
              className="press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[11px] border-2 border-line bg-sun px-3.5 text-sm font-bold text-[#17130F] shadow-hard sm:flex-none"
            >
              <Shuffle className="size-4" aria-hidden /> New customer
            </button>
            <button
              type="button"
              onClick={() => setValue(SAMPLE_MUXED)}
              aria-label="Reset to the sample address"
              disabled={value === SAMPLE_MUXED}
              className="press grid size-11 shrink-0 place-items-center rounded-[11px] border-2 border-line bg-card text-ink shadow-hard disabled:opacity-40"
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* The address, split into the part that encodes the account and the part that carries the id. */}
      <div className="min-h-[3em] font-mono text-[clamp(13px,1.6vw,18px)] leading-normal break-all" aria-hidden>
        {result.kind === "muxed" ? (
          <>
            <span className="rounded-[4px] bg-peacock/25">{result.muxed.slice(0, ACCOUNT_CHARS)}</span>
            <span className="rounded-[4px] bg-sun/30">{result.muxed.slice(ACCOUNT_CHARS)}</span>
          </>
        ) : (
          <span className="text-ink-soft">{value.trim().toUpperCase() || "M…"}</span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {message && (
          <motion.p
            id={messageId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn("flex items-start gap-2 overflow-hidden text-[15px]", result.kind === "invalid" ? "text-risk-severe" : "text-ink-soft")}
          >
            {result.kind === "invalid" && <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5 rounded-[12px] border-2 border-peacock p-4">
          <span className="font-mono text-xs text-peacock">ACCOUNT · holds the balance</span>
          <span className="font-mono text-sm break-all">{result.kind === "muxed" || result.kind === "account" ? result.account : "—"}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-[12px] border-2 border-sun p-4">
          <span className="font-mono text-xs text-sun">MUXED ID · the actual customer</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={result.kind === "muxed" ? result.id.toString() : result.kind}
              initial={{ opacity: 0, y: 14, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 420, damping: 20 }}
              className="font-display text-[34px] leading-none font-extrabold break-all"
            >
              {result.kind === "muxed" ? groupId(result.id) : <span className="text-ink-soft">—</span>}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {result.kind === "muxed" ? `Decoded. Account ${result.account}, muxed ID ${result.id.toString()}.` : (message ?? "")}
      </p>
    </div>
  );
}
