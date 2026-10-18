import { Argus } from "@/components/brand/argus";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "../motion";
import { Container } from "../section";

export function FinalCta() {
  return (
    <Container aria-labelledby="cta-title" className="pb-20 sm:pb-24">
      <Reveal
        // Deep peacock: the token mixed toward black, darker still in dark mode so white text keeps AA contrast.
        className="flex flex-col items-center gap-8 rounded-[24px] border-2 border-line bg-[color-mix(in_srgb,var(--peacock)_70%,black)] p-[clamp(24px,5vw,56px)] shadow-[8px_8px_0_var(--shadow-color)] md:flex-row dark:bg-[color-mix(in_srgb,var(--peacock)_50%,black)]"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[18px] text-white">
          <h2 id="cta-title" className="text-[clamp(36px,5vw,64px)] leading-[0.98] font-extrabold">
            Put a hundred eyes on every transaction.
          </h2>
          <p className="text-lg leading-relaxed text-white/90">Hera put the eyes of Argus on the peacock&apos;s tail. We put them on your transfers.</p>
          <div>
            <ButtonLink href="/signup" size="lg">
              Create your account
            </ButtonLink>
          </div>
        </div>
        <div className="shrink-0 animate-float">
          <Argus mood="happy" size={210} title="Argus the peacock" />
        </div>
      </Reveal>
    </Container>
  );
}
