import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A rough strength estimate for the meter. The real rule is core's
 * `passwordSchema` (10+ characters, letters and numbers); the meter only
 * nudges people past the minimum.
 */
export function passwordScore(value: string): 0 | 1 | 2 | 3 | 4 {
  if (!value) return 0;
  const meetsRule = value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value);
  if (!meetsRule) return 1;
  let score = 2;
  if (value.length >= 14) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return Math.min(score, 4) as 2 | 3 | 4;
}

const LABELS = ["", "Too weak", "Okay", "Good", "Strong"] as const;
const FILL = ["", "bg-blush", "bg-sun", "bg-peacock", "bg-peacock"] as const;

export function StrengthMeter({ value, id }: { value: string; id?: string }) {
  const score = passwordScore(value);
  return (
    <span id={id} className="mt-0.5 flex items-center gap-1.5" aria-live="polite">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} aria-hidden className={cn("h-1.5 flex-1 rounded-full border border-line", i <= score ? FILL[score] : "bg-card")} />
      ))}
      <span className={"ml-1.5 min-w-[64px] text-[13px] font-semibold text-ink"}>
        {score === 0 ? <span className="text-ink-soft">10+ characters</span> : LABELS[score]}
        <span className="sr-only"> password</span>
      </span>
    </span>
  );
}

/** The live checklist on the reset page. Only rules the API enforces. */
export function PasswordChecklist({ value, id }: { value: string; id?: string }) {
  const rules = [
    { ok: value.length >= 10, label: "At least 10 characters" },
    { ok: /[A-Za-z]/.test(value) && /\d/.test(value), label: "Letters and numbers" },
  ];
  return (
    <ul id={id} className="flex flex-col gap-1.5 text-sm">
      {rules.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-2 font-semibold", r.ok ? "text-ink" : "text-ink-soft")}>
          {r.ok ? <Check className="size-4 text-peacock" aria-hidden /> : <X className="size-4 opacity-60" aria-hidden />}
          {r.label}
          <span className="sr-only">{r.ok ? " (done)" : " (not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}
