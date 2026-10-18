import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CodeWindow } from "../code/code-window";
import { CopyButton } from "../code/copy-button";
import { SCREEN_SAMPLE } from "../code/samples";
import { Reveal } from "../motion";
import { Container, SectionHeading } from "../section";

const POINTS = ["REST API and a TypeScript SDK", "Signed webhooks for wallet activity and alerts", "Scoped API keys you can revoke any time"];

export function DevelopersSection() {
  return (
    <Container id="developers" aria-labelledby="developers-title" className="flex scroll-mt-20 flex-col gap-12 py-20 sm:py-[104px] lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-col gap-[18px] lg:max-w-[460px] lg:flex-1">
        <SectionHeading
          id="developers-title"
          eyebrow="For developers"
          title="Your first screen in five minutes."
          lede="One call before you sign or credit a transfer. Pass an M… address or a memo and Hera handles the rest."
        />
        <Reveal delay={0.08} as="ul" className="flex flex-col gap-2.5 text-base">
          {POINTS.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <ArrowRight className="size-4 shrink-0 text-peacock" strokeWidth={2.5} aria-hidden />
              {p}
            </li>
          ))}
        </Reveal>
        <Reveal delay={0.12} className="flex flex-wrap gap-3">
          <ButtonLink href="/signup">Get an API key</ButtonLink>
          <ButtonLink href="/developers" variant="secondary">
            Read the docs
          </ButtonLink>
        </Reveal>
      </div>
      <Reveal delay={0.1} y={32} className="min-w-0 lg:flex-1">
        <CodeWindow filename="screen.ts" code={SCREEN_SAMPLE} actions={<CopyButton value={SCREEN_SAMPLE} label="Copy screen.ts" />} />
      </Reveal>
    </Container>
  );
}
