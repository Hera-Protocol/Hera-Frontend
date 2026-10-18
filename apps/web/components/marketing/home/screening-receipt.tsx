"use client";

import { decodeMuxedAccount, shortAddress, type RiskBand } from "@hera/core";
import { Check, Pause, Play, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Argus, type ArgusMood } from "@/components/brand/argus";
import { Tag } from "@/components/ui/badge";
import { Stamp } from "@/components/ui/stamp";
import { cn } from "@/lib/cn";
import { BAND_STYLE } from "@/lib/risk";
import { SAMPLE_MUXED } from "../constants";
import { usePrefersReducedMotion } from "../use-reduced-motion";

/* ─── The three illustrative subjects ───────────────────── */

const MUXED = SAMPLE_MUXED;
const decoded = decodeMuxedAccount(MUXED);

interface Row {
  label: string;
  value: string;
  /** Risk band the value is colored with; omitted for neutral facts. */
  tone?: RiskBand;
  /** Icon after the value: a check for a clean result, a cross for a hit. */
  mark?: "ok" | "hit";
}

interface Subject {
  ref: string;
  chain: string;
  address: string;
  decoded: ReactNode;
  rows: Row[];
  score: number;
  band: RiskBand;
  mood: ArgusMood;
  summary: string;
  short: string;
}

const SUBJECTS: Subject[] = [
  {
    ref: "000428",
    chain: "Stellar · mainnet",
    address: MUXED,
    decoded: (
      <>
        <Tag tone="iris" className="py-0.5 text-[12px]">SEP-23 decoded</Tag>
        <span className="font-mono">{shortAddress(decoded?.account ?? "", 4, 4)}</span>
        <span className="text-ink-soft">+</span>
        <Tag tone="sun" className="py-0.5 text-[12px]">muxed id {decoded?.id.toString() ?? "?"}</Tag>
      </>
    ),
    rows: [
      { label: "Sanctions lists", value: "NO MATCH", tone: "low", mark: "ok" },
      { label: "Counterparty exposure", value: "0 RISKY", tone: "low", mark: "ok" },
      { label: "Known entity", value: "Circle: USDC issuer" },
      { label: "Sub-account view", value: "2 of 174 transfers" },
    ],
    score: 7,
    band: "low",
    mood: "happy",
    short: "Muxed customer",
    summary: "A muxed Stellar address for a customer of Circle's USDC issuer account. No sanctions match, no risky counterparties. Score 7 of 100, low risk, clear.",
  },
  {
    ref: "000429",
    chain: "Ethereum · mainnet",
    address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96",
    decoded: (
      <>
        <Tag tone="iris" className="py-0.5 text-[12px]">EIP-55 checksum ok</Tag>
        <span className="font-mono">evm:1</span>
      </>
    ),
    rows: [
      { label: "Sanctions lists", value: "OFAC SDN MATCH", tone: "severe", mark: "hit" },
      { label: "Known entity", value: "Lazarus Group" },
      { label: "Top reason", value: "+100 SANCTIONS_DIRECT", tone: "severe" },
      { label: "Policy", value: "Direct hit always blocks" },
    ],
    score: 100,
    band: "severe",
    mood: "alarmed",
    short: "OFAC-listed",
    summary: "An Ethereum address on the OFAC SDN list. A direct sanctions hit forces the score to 100 and the decision to block.",
  },
  {
    ref: "000430",
    chain: "Ethereum · example",
    address: "0x7E57a11cE0000000000000000000000000C0FfEe",
    decoded: (
      <>
        <Tag tone="iris" className="py-0.5 text-[12px]">EIP-55 checksum ok</Tag>
        <span className="font-mono">evm:1</span>
      </>
    ),
    rows: [
      { label: "Sanctions lists", value: "NO MATCH", tone: "low", mark: "ok" },
      { label: "Counterparty exposure", value: "Mixer, first hop", tone: "high", mark: "hit" },
      { label: "Behaviour", value: "+15 RAPID_IN_OUT", tone: "medium" },
      { label: "Known entity", value: "None" },
    ],
    score: 64,
    band: "high",
    mood: "idle",
    short: "Mixer exposure",
    summary: "An example Ethereum address that received funds straight from a mixer and moves money in and out quickly. Score 64 of 100, high risk, sent to review.",
  },
];

/* ─── Timeline ──────────────────────────────────────────── */

const TYPE_TOTAL_MS = 1100; // typing the address
const FIRST_ROW_MS = 320;
const ROW_MS = 420;
const VERDICT_MS = 360;
const HOLD_MS = 2800; // ~6 s per subject in all

/** Steps per subject: one per typed tick, one per check row, one for the verdict, then hold. */
function timeline(s: Subject) {
  const perTick = Math.max(1, Math.ceil(s.address.length / 40));
  const ticks = Math.ceil(s.address.length / perTick);
  return { perTick, ticks, typeMs: TYPE_TOTAL_MS / ticks, rows: s.rows.length, end: ticks + s.rows.length + 1 };
}

function useDocumentVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function ScreeningReceipt() {
  const reduced = usePrefersReducedMotion();
  const visible = useDocumentVisible();
  const [userPaused, setUserPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);

  const subject = SUBJECTS[index]!;
  const t = timeline(subject);
  const playing = !reduced && visible && !userPaused;

  useEffect(() => {
    if (!playing) return;
    let delay: number;
    if (step < t.ticks) delay = t.typeMs;
    else if (step < t.ticks + t.rows) delay = step === t.ticks ? FIRST_ROW_MS : ROW_MS;
    else if (step < t.end) delay = VERDICT_MS;
    else delay = HOLD_MS;
    const timer = setTimeout(() => {
      if (step >= t.end) {
        setIndex((i) => (i + 1) % SUBJECTS.length);
        setStep(0);
      } else setStep(step + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [playing, step, t.ticks, t.typeMs, t.rows, t.end]);

  // Reduced motion shows each subject's final state; there is nothing to watch.
  const shown = reduced ? t.end : step;
  const typedChars = Math.min(subject.address.length, shown * t.perTick);
  const typing = shown < t.ticks;
  const rowsDone = Math.max(0, Math.min(t.rows, shown - t.ticks));
  const verdict = shown >= t.end;
  const mood: ArgusMood = verdict ? subject.mood : "scanning";
  const band = BAND_STYLE[subject.band];

  const pick = (i: number) => {
    setIndex(i);
    setStep(0);
  };

  return (
    <figure className="relative mx-auto mt-24 w-full max-w-[520px] min-w-0" aria-labelledby="receipt-caption">
      {/* Argus perches on the card and reacts to each verdict. */}
      <div className="pointer-events-none absolute -top-[130px] right-0 z-10 origin-bottom-right scale-[0.78] sm:-right-5 sm:scale-100">
        <div className="animate-float">
          <Argus mood={mood} size={190} title={`Argus the peacock, looking ${mood === "alarmed" ? "alarmed" : mood === "happy" ? "pleased" : mood === "scanning" ? "busy scanning" : "watchful"}`} />
        </div>
      </div>

      <p className="sr-only">
        Example {index + 1} of {SUBJECTS.length}: {subject.summary}
      </p>

      <div aria-hidden className="relative overflow-hidden rounded-[18px] border-2 border-line bg-card shadow-[8px_8px_0_var(--shadow-color)]">
        {/* Argus stands on the right of this rule, so the header keeps its content left. */}
        <div className="border-b-2 border-dashed border-line px-4 py-3.5 font-mono text-xs tracking-[0.1em] uppercase sm:px-5">
          Screening · #{subject.ref}
        </div>

        {/* scan progress */}
        <div className="h-1 bg-paper-2">
          <motion.div
            className="h-full origin-left bg-sun"
            animate={{ scaleX: verdict ? 1 : (typedChars / subject.address.length) * 0.35 + (rowsDone / t.rows) * 0.65 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="eyebrow text-[11px]">Subject</span>
              <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[11px] tracking-[0.1em] text-paper uppercase">{subject.chain}</span>
            </div>
            <div className="min-h-[66px] rounded-[10px] border-2 border-line bg-paper px-3 py-2.5 font-mono text-[13px] leading-normal break-all sm:min-h-[70px] sm:text-sm">
              {subject.address.slice(0, typedChars)}
              {typing && <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-pulse bg-ink" />}
            </div>
          </div>

          <div className="flex min-h-9 flex-wrap items-center gap-2.5 text-sm">
            <AnimatePresence>
              {!typing && (
                <motion.div
                  key={subject.ref}
                  className="flex flex-wrap items-center gap-2.5"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                >
                  {subject.decoded}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ul className="flex flex-col gap-2.5 text-[15px]">
            {subject.rows.map((row, r) => {
              const done = r < rowsDone;
              const active = !done && r === rowsDone && !typing;
              return (
                <li
                  key={`${subject.ref}-${row.label}`}
                  className="flex items-center justify-between gap-3 border-b border-dashed border-line/25 pb-2.5 last:border-0 last:pb-0"
                >
                  <span className={cn("transition-opacity", !done && !active && "opacity-50")}>{row.label}</span>
                  {done ? (
                    <motion.span
                      initial={{ opacity: 0, x: 10, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 24 }}
                      className={cn(
                        "inline-flex items-center gap-1 text-right font-mono text-[13px] font-medium",
                        row.tone && BAND_STYLE[row.tone].text,
                      )}
                    >
                      {row.value}
                      {row.mark === "ok" && <Check className="size-3.5" strokeWidth={3} />}
                      {row.mark === "hit" && <X className="size-3.5" strokeWidth={3} />}
                    </motion.span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[13px] text-ink-soft">
                      {active ? (
                        <>
                          <span className="size-2 animate-blink-dot rounded-full bg-peacock" />
                          checking
                        </>
                      ) : (
                        "···"
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex min-h-[86px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-2 border-line bg-paper-2 px-4 py-4 sm:px-5">
          <div className="flex items-baseline gap-2">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={verdict ? `${subject.ref}-score` : "pending"}
                initial={{ opacity: 0, y: 12, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 420, damping: 18 }}
                className={cn("font-display text-[52px] leading-none font-extrabold", !verdict && "text-ink-soft/50")}
              >
                {verdict ? subject.score : "–"}
              </motion.span>
            </AnimatePresence>
            <span className="font-mono text-xs text-ink-soft sm:text-[13px]">/100{verdict && ` · ${band.label.toUpperCase()} RISK`}</span>
          </div>
          {verdict && (
            <Stamp key={subject.ref} tone={subject.band} rotate={-9} className="text-[20px] sm:text-[26px]">
              {band.stamp}
            </Stamp>
          )}
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
        <span id="receipt-caption" className="flex items-center gap-2 font-mono text-xs text-ink-soft">
          <Tag tone="sun">Illustrative</Tag>
          Every Hera score is explained line by line.
        </span>
        <span className="flex items-center gap-1.5">
          {SUBJECTS.map((s, i) => (
            <button
              key={s.ref}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={i === index}
              aria-label={`Show example ${i + 1}: ${s.short}`}
              className="grid size-10 place-items-center rounded-full"
            >
              <span
                className={cn(
                  "block h-2.5 rounded-full border-2 border-line transition-all",
                  i === index ? cn("w-6", BAND_STYLE[s.band].solid) : "w-2.5 bg-card",
                )}
              />
            </button>
          ))}
          {!reduced && (
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={userPaused ? "Play the example" : "Pause the example"}
              className="grid size-10 place-items-center rounded-[10px] border-2 border-line bg-card shadow-hard-sm"
            >
              {userPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
