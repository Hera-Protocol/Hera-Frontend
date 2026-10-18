import { Reveal, Stagger, StaggerItem } from "../motion";
import { Container, SectionHeading } from "../section";
import { MuxedDecoder } from "./muxed-decoder";

const POINTS = [
  {
    title: "Muxed accounts (SEP-23)",
    body: "Decoded at the edge with checksum validation, then carried through screening, alerts, Travel Rule and records. The sub-identity is never flattened away.",
  },
  {
    title: "Memos",
    body: "Memo IDs route funds to an end user at a shared address. Hera scores that user's own transfers, not the whole omnibus account.",
  },
  {
    title: "SEPs and anchors",
    body: "Anchors are identified through their stellar.toml (SEP-1), and only when the toml lists the account back. SEP-10, 12 and 31 endpoints feed the Travel Rule.",
  },
];

export function StellarSection() {
  return (
    <Container id="stellar" aria-labelledby="stellar-title" className="scroll-mt-20 py-16 sm:py-20">
      <Reveal className="overflow-hidden rounded-[24px] border-2 border-line shadow-[8px_8px_0_var(--peacock)]">
        {/* Always the dark palette, in both themes. */}
        <div data-theme="dark" className="flex flex-col gap-10 bg-paper p-[clamp(20px,5vw,56px)] text-ink">
          <SectionHeading
            id="stellar-title"
            eyebrow="Built native on Stellar"
            eyebrowClassName="text-sun"
            title="EVM tools see one address. Hera sees the customer."
            lede="Exchanges and anchors put thousands of customers behind one Stellar account. Screening the shared address tells you nothing. Hera decodes who is actually on the other side, and keeps that identity through every check and record."
          />

          <MuxedDecoder />

          <Stagger className="grid gap-6 md:grid-cols-3">
            {POINTS.map((p) => (
              <StaggerItem key={p.title} className="flex flex-col gap-2">
                <h3 className="text-[22px] font-bold">{p.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-soft">{p.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>
    </Container>
  );
}
