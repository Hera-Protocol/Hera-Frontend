"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/queries";
import { Logo } from "../brand/logo";
import { ButtonLink } from "../ui/button";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/stellar", label: "Stellar" },
  { href: "/developers", label: "Developers" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: me } = useMe();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-paper/95 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-6 px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="Hera home">
          <Logo size={30} />
        </Link>
        <div className="hidden flex-1 flex-wrap gap-5 text-[15px] font-medium md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn("hover:text-iris", pathname === l.href && "border-b-[3px] border-sun font-bold")}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-2.5 md:flex">
          {me ? (
            <ButtonLink href="/app" size="sm">Open dashboard</ButtonLink>
          ) : (
            <>
              <Link href="/login" className="px-3 py-2 text-[15px] font-semibold">Log in</Link>
              <ButtonLink href="/signup" size="sm">Start building</ButtonLink>
            </>
          )}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className="ml-auto grid size-11 place-items-center rounded-[12px] border-2 border-line bg-card md:hidden">
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>
        {open && (
          <div className="flex w-full flex-col gap-1 pb-3 md:hidden">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-[10px] px-3 py-2.5 font-semibold hover:bg-paper-2">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <ButtonLink href="/login" variant="secondary" size="sm" className="flex-1">Log in</ButtonLink>
              <ButtonLink href="/signup" size="sm" className="flex-1">Start building</ButtonLink>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line bg-paper">
      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-10 px-6 py-12">
        <div className="flex max-w-xs flex-col gap-3">
          <Logo size={28} />
          <p className="text-[15px] leading-relaxed text-ink-soft">Compliance infrastructure for Stellar and EVM. KYT, AML and the Travel Rule, built in-house.</p>
        </div>
        <div className="flex flex-wrap gap-14 text-[15px]">
          <div className="flex flex-col gap-2.5"><strong>Product</strong><Link href="/#how">How it works</Link><Link href="/pricing">Pricing</Link><Link href="/#travel-rule">Travel Rule</Link><Link href="/verify">Verify a report</Link></div>
          <div className="flex flex-col gap-2.5"><strong>Developers</strong><Link href="/developers">Docs &amp; SDK</Link><Link href="/developers#api">API reference</Link><Link href="/stellar">Working with Stellar</Link></div>
          <div className="flex flex-col gap-2.5"><strong>Company</strong><Link href="/security">Security</Link><a href="mailto:hello@heralayer.com">Contact</a></div>
        </div>
      </div>
      <div className="mx-auto max-w-[1200px] px-6 pb-8 font-mono text-xs text-ink-soft">© {new Date().getFullYear()} Hera Protocol</div>
    </footer>
  );
}
