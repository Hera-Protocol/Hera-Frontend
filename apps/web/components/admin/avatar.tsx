import { cn } from "@/lib/cn";

const TONES = [
  "bg-blush text-[#17130F]",
  "bg-sun text-[#17130F]",
  "bg-peacock-soft text-ink",
  "bg-iris text-paper",
] as const;

export function initialsOf(value: string) {
  return (
    value
      .replace(/@.*/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Initials in a colored circle; the color is stable per person. */
export function Avatar({ name, seed, className }: { name: string; seed: string; className?: string }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border-2 border-line font-display text-sm font-extrabold",
        TONES[hash % TONES.length],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
