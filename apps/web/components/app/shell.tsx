"use client";

import {
  ArrowLeftRight,
  Bell,
  ChevronsUpDown,
  Eye,
  FileCheck,
  History,
  KeyRound,
  LayoutDashboard,
  Link2,
  Menu as MenuIcon,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api";
import { useLogout, useMe, useMyOrgs, useOverview, useResendVerification, useSwitchOrg } from "@/lib/queries";
import { Logo } from "../brand/logo";
import { Skeleton } from "../ui/misc";

const MONITOR = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/screen", label: "Screen", icon: Search },
  { href: "/app/screenings", label: "Screenings", icon: History },
  { href: "/app/wallets", label: "Wallets", icon: Eye },
  { href: "/app/alerts", label: "Alerts", icon: Bell, badge: "alerts" as const },
  { href: "/app/travel-rule", label: "Travel Rule", icon: ArrowLeftRight },
  { href: "/app/reports", label: "Reports", icon: FileCheck },
];

const ADMIN = [
  { href: "/app/webhooks", label: "Webhooks", icon: Zap },
  { href: "/app/keys", label: "API keys", icon: KeyRound },
  { href: "/app/team", label: "Team", icon: Users },
  { href: "/app/audit", label: "Audit log", icon: Link2 },
  { href: "/app/settings", label: "Settings", icon: SlidersHorizontal },
];

const TITLES: Record<string, string> = Object.fromEntries([...MONITOR, ...ADMIN].map((i) => [i.href, i.label]));

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/* ─── Popover menu ───────────────────────────────────── */

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOutside();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onOutside();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", key);
    };
  }, [ref, onOutside, active]);
}

function Popover({ trigger, children, align = "left" }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={cn("absolute top-full z-40 mt-2 min-w-[240px] rounded-[14px] border-2 border-line bg-card p-1.5 shadow-hard", align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const menuItem = "flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm font-semibold hover:bg-paper-2";

/* ─── Sidebar ────────────────────────────────────────── */

function OrgSwitcher() {
  const { data: me } = useMe();
  const orgs = useMyOrgs();
  const switchOrg = useSwitchOrg();
  const router = useRouter();
  if (!me) return null;
  const initials = me.org.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <Popover
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex w-full items-center gap-2.5 rounded-[12px] border-2 border-line bg-paper px-2.5 py-2 text-left"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line bg-blush font-display text-xs font-extrabold text-[#17130F]">{initials}</span>
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-sm">{me.org.name}</strong>
            <span className="text-xs capitalize opacity-80">{me.org.plan} plan · {me.role}</span>
          </span>
          <ChevronsUpDown className="ml-auto size-4 shrink-0" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Switch organization">
          {(orgs.data ?? [{ orgId: me.org.id, orgName: me.org.name, role: me.role, plan: me.org.plan }]).map((o) => (
            <button
              key={o.orgId}
              type="button"
              role="menuitemradio"
              aria-checked={o.orgId === me.org.id}
              className={cn(menuItem, o.orgId === me.org.id && "bg-sun text-[#17130F]")}
              onClick={async () => {
                close();
                if (o.orgId === me.org.id) return;
                try {
                  await switchOrg.mutateAsync(o.orgId);
                  router.push("/app");
                  toast.success(`Switched to ${o.orgName}`);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              <span className="truncate">{o.orgName}</span>
              <span className="ml-auto text-xs capitalize opacity-70">{o.role}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const overview = useOverview();
  const openAlerts = overview.data?.openAlerts ?? 0;
  const link = (item: (typeof MONITOR)[number] | (typeof ADMIN)[number]) => {
    const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-[11px] text-[15px] font-semibold",
          active ? "border-2 border-line bg-sun px-2.5 py-1.5 text-[#17130F] shadow-hard-sm" : "px-3 py-2 hover:bg-paper-2",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
        {item.label}
        {"badge" in item && openAlerts > 0 && (
          <span className="ml-auto rounded-full border-2 border-line bg-risk-severe-soft px-1.5 font-mono text-xs text-risk-severe">
            {openAlerts}
            <span className="sr-only"> open</span>
          </span>
        )}
      </Link>
    );
  };
  return (
    <nav aria-label="App" className="flex flex-col gap-0.5">
      <span className="px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] opacity-75">MONITOR</span>
      {MONITOR.map(link)}
      <span className="px-3 pt-3.5 pb-1.5 font-mono text-[11px] tracking-[0.12em] opacity-75">BUILD &amp; ADMIN</span>
      {ADMIN.map(link)}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-[18px] px-3.5 py-5">
      <Link href="/app" onClick={onNavigate} className="px-2">
        <Logo size={28} />
      </Link>
      <OrgSwitcher />
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-2.5">
        <Link href="/developers" className="px-2 text-[13px] font-semibold text-iris">
          Docs &amp; SDK ↗
        </Link>
      </div>
    </div>
  );
}

/* ─── Top bar ────────────────────────────────────────── */

function ScreenSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      className="flex max-w-[520px] flex-[1_1_260px] items-center gap-2.5 rounded-[11px] border-2 border-line bg-card px-2.5 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const address = value.trim();
        if (!address) return;
        router.push(`/app/screen?address=${encodeURIComponent(address)}`);
        setValue("");
      }}
    >
      <Search className="size-4 shrink-0 opacity-70" aria-hidden />
      <label htmlFor="global-screen" className="sr-only">
        Screen an address
      </label>
      <input
        id="global-screen"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Screen G…, M… or 0x…"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-1 text-[15px] outline-none"
      />
      <kbd className="hidden rounded-md border-2 border-line bg-paper-2 px-1.5 font-mono text-xs text-ink sm:inline">⌘K</kbd>
    </form>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-10 place-items-center rounded-[11px] border-2 border-line bg-card"
    >
      {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}

function AccountMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  const router = useRouter();
  if (!me) return null;
  const initials = me.user.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <Popover
      align="right"
      trigger={(open, toggle) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Account menu for ${me.user.name}`}
          className="size-10 rounded-full border-2 border-line bg-blush font-display text-[15px] font-extrabold text-[#17130F]"
        >
          {initials}
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Account">
          <div className="border-b-2 border-dashed border-line/30 px-3 py-2">
            <strong className="block text-sm">{me.user.name}</strong>
            <span className="text-xs text-ink-soft">{me.user.email}</span>
          </div>
          <Link role="menuitem" href="/app/settings" onClick={close} className={menuItem}>
            Settings
          </Link>
          <Link role="menuitem" href="/developers" onClick={close} className={menuItem}>
            Docs &amp; SDK
          </Link>
          <button
            role="menuitem"
            type="button"
            className={cn(menuItem, "text-risk-severe")}
            onClick={async () => {
              close();
              await logout.mutateAsync().catch(() => undefined);
              router.replace("/login");
            }}
          >
            Log out
          </button>
        </div>
      )}
    </Popover>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const crumb = TITLES[pathname] ?? Object.entries(TITLES).find(([href]) => href !== "/app" && pathname.startsWith(href))?.[1] ?? "Overview";
  const { data: me } = useMe();
  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-4 border-b-2 border-line bg-paper/95 px-4 py-3.5 backdrop-blur sm:px-6">
      <button type="button" onClick={onMenu} aria-label="Open navigation" className="grid size-10 place-items-center rounded-[11px] border-2 border-line bg-card lg:hidden">
        <MenuIcon className="size-[18px]" aria-hidden />
      </button>
      <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm whitespace-nowrap md:flex">
        <span className="opacity-75">{me?.org.name}</span>
        <span className="opacity-50">/</span>
        <strong>{crumb}</strong>
      </nav>
      <ScreenSearch />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  );
}

/* ─── Verification banner ────────────────────────────── */

function VerifyBanner() {
  const { data: me } = useMe();
  if (!me || me.user.emailVerified) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 border-b-2 border-line bg-sun px-6 py-2.5 text-[15px] text-[#17130F]">
      <span>
        We sent a link to <strong>{me.user.email}</strong>. Verify your email to unlock everything.
      </span>
      <ResendButton />
    </div>
  );
}

function ResendButton() {
  const resend = useResendVerification();
  return (
    <button
      type="button"
      disabled={resend.isPending || resend.isSuccess}
      className="ml-auto rounded-[10px] border-2 border-line bg-card px-3 py-1 text-sm font-bold text-ink disabled:opacity-60"
      onClick={() =>
        resend.mutate(undefined, {
          onSuccess: () => toast.success("Sent. Check your inbox."),
          onError: (e) => toast.error(errorMessage(e)),
        })
      }
    >
      {resend.isSuccess ? "Sent" : "Resend email"}
    </button>
  );
}

/* ─── Shell + guard ──────────────────────────────────── */

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (me.data === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.data, pathname, router]);

  useEffect(() => setDrawer(false), [pathname]);

  if (me.isPending || me.data === null) {
    return (
      <div className="flex min-h-screen" aria-busy="true">
        <div className="hidden w-[260px] border-r-2 border-line bg-card p-5 lg:block">
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="flex-1 p-7">
          <Skeleton className="mb-6 h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="brutal max-w-md p-8">
          <h1 className="mb-2 text-2xl font-extrabold">Hera's API isn't answering</h1>
          <p className="mb-4 text-ink-soft">{errorMessage(me.error)}</p>
          <button type="button" onClick={() => me.refetch()} className="rounded-[11px] border-2 border-line bg-sun px-4 py-2 font-bold text-[#17130F]">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 overflow-y-auto border-r-2 border-line bg-card lg:block">
        <SidebarContent />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[#17130F]/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] overflow-y-auto border-r-2 border-line bg-card shadow-hard-lg">
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close navigation" className="absolute top-4 right-3 grid size-9 place-items-center rounded-[10px] border-2 border-line bg-card">
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawer(true)} />
        <VerifyBanner />
        <main className="dot-grid flex-1">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-4 sm:p-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
