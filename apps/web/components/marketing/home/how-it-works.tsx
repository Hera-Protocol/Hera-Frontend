import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Stagger, StaggerItem } from "../motion";
import { Container, SectionHeading } from "../section";

function Step({ n, tone, title, body, children }: { n: string; tone: string; title: string; body: string; children: ReactNode }) {
  return (
    <StaggerItem as="article" lift className="brutal flex flex-col gap-4 p-6 sm:p-[26px]">
      <div className="flex items-center gap-3">
        <span className={cn("rounded-lg border-2 border-line px-2 py-0.5 font-mono text-[13px]", tone)}>{n}</span>
        <h3 className="text-[28px] font-extrabold">{title}</h3>
      </div>
      <p className="text-base leading-relaxed text-ink-soft">{body}</p>
      {children}
    </StaggerItem>
  );
}

export function HowItWorks() {
  return (
    <Container id="how" aria-labelledby="how-title" className="flex scroll-mt-20 flex-col gap-10 pt-20 pb-10 sm:pt-[104px]">
      <SectionHeading
        id="how-title"
        eyebrow="How it works"
        title="Watch. Score. Act."
        lede="One pipeline from a raw address to a decision you can defend to a regulator."
      />
      <Stagger className="grid gap-6 md:grid-cols-3">
        <Step
          n="01"
          tone="bg-peacock-soft"
          title="Watch"
          body="Add a wallet or call the SDK. Hera follows it on-chain: payments, path payments, token transfers and the internal calls generic tools miss."
        >
          {/* Illustrative activity feed */}
          <ul className="flex flex-col gap-2 font-mono text-[13px]" aria-label="Example activity">
            <li className="flex items-center justify-between rounded-[10px] border-2 border-line bg-paper px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <ArrowDown className="size-3.5" strokeWidth={2.5} aria-label="In" /> 2,500 USDC
              </span>
              <span className="text-ink-soft">12s ago</span>
            </li>
            <li className="flex items-center justify-between rounded-[10px] border-2 border-line bg-paper px-3 py-2">
              <span className="inline-flex items-center gap-1.5">
                <ArrowUp className="size-3.5" strokeWidth={2.5} aria-label="Out" /> 0.42 ETH
              </span>
              <span className="text-ink-soft">1m ago</span>
            </li>
          </ul>
        </Step>
        <Step
          n="02"
          tone="bg-iris-soft"
          title="Score"
          body="Every subject gets a 0–100 score with the reasons behind it: sanctions, counterparty exposure, behaviour. No black box."
        >
          <ul className="flex flex-wrap gap-2 font-mono text-xs" aria-label="Example reasons">
            <li className="rounded-lg border-2 border-line bg-risk-severe-soft px-2 py-1 text-risk-severe">+100 SANCTIONS_DIRECT</li>
            <li className="rounded-lg border-2 border-line bg-risk-medium-soft px-2 py-1 text-risk-medium">+15 RAPID_IN_OUT</li>
            <li className="rounded-lg border-2 border-line bg-risk-high-soft px-2 py-1 text-risk-high">+20 STRUCTURING</li>
          </ul>
        </Step>
        <Step
          n="03"
          tone="bg-blush-soft"
          title="Act"
          body="Allow, review or block. Alerts land in a queue, webhooks fire, and the Travel Rule message is ready to send."
        >
          <ul className="flex flex-wrap gap-2 text-sm font-bold" aria-label="Decisions">
            <li className="rounded-full border-2 border-line bg-risk-low-soft px-3.5 py-1.5 text-risk-low">Allow</li>
            <li className="rounded-full border-2 border-line bg-risk-medium-soft px-3.5 py-1.5 text-risk-medium">Review</li>
            <li className="rounded-full border-2 border-line bg-risk-severe-soft px-3.5 py-1.5 text-risk-severe">Block</li>
          </ul>
        </Step>
      </Stagger>
    </Container>
  );
}
