import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "../motion";
import { ScreeningReceipt } from "./screening-receipt";

const PROOF = ["SEP-23 native", "IVMS101 Travel Rule", "Every score explained"];

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-14 overflow-x-clip px-4 pt-14 pb-20 sm:px-6 sm:pt-[72px] sm:pb-[88px] lg:flex-row lg:items-center"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-6 sm:gap-[26px]">
        <Reveal y={12}>
          <span className="inline-flex items-center gap-2.5 rounded-[18px] border-2 sm:rounded-full border-line bg-card px-3.5 py-1.5 font-mono text-[13px] shadow-hard-sm">
            <span className="size-[9px] shrink-0 animate-blink-dot rounded-full bg-peacock" aria-hidden />
            Live on Stellar + Ethereum · Travel Rule ready
          </span>
        </Reveal>
        <Reveal delay={0.06}>
          <h1 id="hero-title" className="text-[clamp(44px,7vw,86px)] leading-[0.95] font-extrabold">
            Compliance that <span className="highlight">never blinks.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="max-w-[560px] text-lg leading-relaxed text-ink-soft sm:text-xl">
            Hera screens wallets, scores every transaction and handles the Travel Rule across Stellar and EVM chains. Our own intelligence, no resold vendor
            data, and native support for muxed accounts, memos and SEPs.
          </p>
        </Reveal>
        <Reveal delay={0.18} className="flex flex-wrap gap-3.5">
          <ButtonLink href="/signup" size="lg">
            Start building <ArrowRight className="size-[18px]" strokeWidth={2.5} aria-hidden />
          </ButtonLink>
          <ButtonLink href="/app/screen" size="lg" variant="secondary">
            Watch it screen
          </ButtonLink>
        </Reveal>
        <Reveal delay={0.24}>
          <ul className="flex flex-wrap gap-x-[18px] gap-y-2 font-mono text-[13px] text-ink-soft">
            {PROOF.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-peacock" strokeWidth={3} aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={0.15} y={36} className="flex min-w-0 flex-1 justify-center">
        <ScreeningReceipt />
      </Reveal>
    </section>
  );
}
