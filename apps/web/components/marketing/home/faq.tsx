import { ChevronDown } from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "../motion";

const FAQS = [
  {
    q: "Do you resell Chainalysis or other vendor data?",
    a: "No. Hera's labels come from public records (OFAC, UN, EU and UK lists), on-chain facts, Stellar SEP-1 attestations and our own analysis. Every label shows where it came from.",
  },
  { q: "Which chains do you support?", a: "Stellar and Ethereum today. Base, Arbitrum, Optimism and Polygon are next." },
  {
    q: "How do muxed accounts and memos change screening?",
    a: "Hera decodes M… addresses and memos into the underlying customer and scores that customer's own transfers, separately from the shared account.",
  },
  {
    q: "Which Travel Rule protocols do you support?",
    a: "IVMS101 payloads with Hera-to-Hera exchange first, then TRP interoperability. On Stellar, counterparties are discovered through their stellar.toml.",
  },
];

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 pb-20 sm:px-6 sm:pb-[104px]">
      <Reveal>
        <h2 id="faq-title" className="mb-3 text-center text-[clamp(36px,4.6vw,52px)] leading-none font-extrabold">
          Questions, answered
        </h2>
      </Reveal>
      <Stagger className="flex flex-col gap-4">
        {FAQS.map((f, i) => (
          <StaggerItem key={f.q}>
            <details open={i === 0} className="group brutal rounded-[14px] px-5 py-[18px] sm:px-[22px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-line bg-paper-2 transition-transform duration-300 group-open:rotate-180">
                  <ChevronDown className="size-4" strokeWidth={2.5} aria-hidden />
                </span>
              </summary>
              <p className="mt-3 text-base leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
