import { Argus } from "@/components/brand/argus";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="dot-grid flex min-h-screen flex-col px-4 py-8 sm:px-14">
      <Link href="/" aria-label="Hera home" className="self-start"><Logo size={32} /></Link>
      <main className="flex flex-1 flex-wrap items-center justify-center gap-10 py-10">
        <div className="animate-[wiggle_3s_ease-in-out_infinite]"><Argus mood="scanning" size={240} title="Argus the peacock, looking puzzled" /></div>
        <div className="flex max-w-[520px] flex-col gap-4">
          <span className="font-mono text-sm tracking-[0.12em] text-ink-soft">ERROR 404</span>
          <h1 className="text-[clamp(48px,7vw,88px)] leading-[0.95] font-extrabold">A hundred eyes, and not one found this page.</h1>
          <p className="text-lg text-ink-soft">The link may be old, or the page may have moved. Let's get you somewhere useful.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/app">Go to the dashboard</ButtonLink>
            <ButtonLink href="/" variant="secondary">Back to the homepage</ButtonLink>
          </div>
        </div>
      </main>
    </div>
  );
}
