import type { Metadata } from "next";
import { ApiReference, DevHero, DevSteps, ErrorsAndProxy, WhoBuilds } from "@/components/marketing/developers/developers-page";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "The @hera/sdk TypeScript SDK and REST API: guard a send, verify signed webhooks and file Travel Rule transfers. Muxed addresses and memos just work.",
};

export default function DevelopersPage() {
  return (
    <>
      <DevHero />
      <DevSteps />
      <WhoBuilds />
      <ErrorsAndProxy />
      <ApiReference />
    </>
  );
}
