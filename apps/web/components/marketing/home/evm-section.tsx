import { Tag } from "@/components/ui/badge";
import { Stagger, StaggerItem } from "../motion";
import { Container, SectionHeading } from "../section";

const FEATURES = [
  { title: "Internal transfers", body: "ETH paid out by contracts, like mixer withdrawals, only shows up in traces. Hera reads them." },
  { title: "Every token standard", body: "ERC-20, ERC-721 and ERC-1155 transfers, normalized next to native value." },
  { title: "Typo guard", body: "EIP-55 checksums are verified, so a mistyped address is caught before it's screened." },
  { title: "More chains", body: "Base, Arbitrum, Optimism and Polygon on the same engine.", soon: true },
];

export function EvmSection() {
  return (
    <Container aria-labelledby="evm-title" className="flex flex-col gap-9 pt-10 pb-16 sm:pb-20">
      <SectionHeading
        id="evm-title"
        eyebrow="And EVM, traced properly"
        title={
          <>
            Not just <span className="font-mono text-[0.8em] font-medium">tx.value</span>.
          </>
        }
      />
      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <StaggerItem key={f.title} as="article" lift className="brutal flex flex-col gap-2.5 p-[22px]">
            <h3 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {f.title}
              {f.soon && (
                <Tag tone="sun" className="text-[11px]">
                  SOON
                </Tag>
              )}
            </h3>
            <p className="text-[15px] leading-relaxed text-ink-soft">{f.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </Container>
  );
}
