import { ArrowRight, ExternalLink } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CodeWindow } from "../code/code-window";
import { CopyButton } from "../code/copy-button";
import { INSTALL_COMMAND, PROXY_SAMPLE } from "../code/samples";
import { Reveal, Stagger, StaggerItem } from "../motion";
import { Container } from "../section";
import { CodeTabs } from "./code-tabs";

/* ─── Hero ──────────────────────────────────────────────── */

export function DevHero() {
  return (
    <Container aria-labelledby="dev-title" className="flex flex-col gap-10 pt-14 pb-10 sm:pt-16 lg:flex-row lg:items-center">
      <Reveal className="flex min-w-0 flex-col gap-[18px] lg:flex-1">
        <span className="eyebrow text-[13px]">@hera/sdk · TypeScript · Node, Bun, Deno, edge</span>
        <h1 id="dev-title" className="text-[clamp(40px,6vw,72px)] leading-[0.98] font-extrabold">
          Compliance in one line of your app.
        </h1>
        <p className="text-lg leading-relaxed text-ink-soft sm:text-[19px]">
          Screen a recipient before you sign, watch your hot wallets, verify webhooks and file Travel Rule transfers, all with typed calls. Muxed addresses
          and memos just work.
        </p>
        <InstallSnippet />
      </Reveal>
      <Reveal delay={0.1} y={32} className="min-w-0 lg:flex-1">
        <CodeTabs />
      </Reveal>
    </Container>
  );
}

function InstallSnippet() {
  return (
    <div className="self-start overflow-hidden rounded-[12px] border-2 border-line shadow-[4px_4px_0_var(--peacock)]">
      <div data-theme="dark" className="flex items-center gap-1 bg-paper py-1 pr-1 pl-4 font-mono text-[15px] text-ink sm:text-base">
        <span className="text-sun" aria-hidden>
          $
        </span>
        <code className="pr-2">{INSTALL_COMMAND}</code>
        <CopyButton value={INSTALL_COMMAND} label="Copy the install command" />
      </div>
    </div>
  );
}

/* ─── How it works ──────────────────────────────────────── */

const STEPS = [
  { eyebrow: "1 · Your app", title: "Calls hera.guard()", body: "From your server, with a scoped key. The address is validated and decoded locally first." },
  { eyebrow: "2 · Hera API", title: "Reads the chain", body: "Live Stellar and Ethereum history: payments, path payments, tokens, internal calls." },
  { eyebrow: "3 · Engine", title: "Labels and scores", body: "Hera's own labels (OFAC and more), exposure and behaviour. 0–100 with reasons." },
  { eyebrow: "4 · Decision", title: "Allow, review or block", body: "You decide what happens next; Hera records why, in a hash-chained audit log." },
];

export function DevSteps() {
  return (
    <Container aria-labelledby="dev-how" className="flex flex-col gap-[22px] py-8">
      <Reveal>
        <h2 id="dev-how" className="text-[clamp(34px,4.4vw,44px)] leading-none font-extrabold">
          How it works
        </h2>
      </Reveal>
      <Stagger as="ol" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => {
          const last = i === STEPS.length - 1;
          return (
            <StaggerItem
              as="li"
              key={s.title}
              lift
              className={cn(
                "flex flex-col gap-1.5 rounded-[16px] border-2 border-line p-[18px] shadow-hard",
                last ? "bg-sun text-[#17130F]" : "bg-card",
              )}
            >
              <span className={cn("font-mono text-xs uppercase", !last && "text-ink-soft")}>{s.eyebrow}</span>
              <strong className="text-lg">{s.title}</strong>
              <span className={cn("text-sm", !last && "text-ink-soft")}>{s.body}</span>
            </StaggerItem>
          );
        })}
      </Stagger>
    </Container>
  );
}

/* ─── Who builds with Hera (docs/SDK.md, "Which apps can use it") ─── */

const APPS = [
  { title: "Self-custody wallets", check: "Screen the recipient before the user signs a send. Warn on review, stop on block.", pattern: "guard() before sign", tone: "bg-card" },
  { title: "Exchanges & on/off-ramps", check: "Screen deposits before crediting and withdrawals before sending. File Travel Rule records above threshold.", pattern: "guard + webhooks + travel rule", tone: "bg-sun/25" },
  { title: "Stellar anchors", check: "SEP-6/24/31 flows with memo and muxed customers. Score the customer, not the omnibus.", pattern: "guard with memo / M…", tone: "bg-peacock-soft" },
  { title: "Payments & remittance", check: "Screen the recipient at quote and again at send. Above threshold, file a record.", pattern: "guard + travel rule", tone: "bg-card" },
  { title: "Merchants & checkout", check: "Screen the payer when payment arrives, before you fulfil the order.", pattern: "guard after receipt", tone: "bg-blush-soft" },
  { title: "DeFi front-ends", check: "Screen the connecting wallet through your proxy. Gate writes, never block reads.", pattern: "guard on connect", tone: "bg-iris-soft" },
  { title: "DAO & treasury payouts", check: "Screen every payee when the proposal is created, and again at execution.", pattern: "guard at propose + execute", tone: "bg-card" },
  { title: "Bridges", check: "Screen the depositor on the source chain and the recipient on the destination.", pattern: "guard + watch", tone: "bg-peacock-soft" },
  { title: "NFT marketplaces", check: "Screen buyer and seller at purchase, and every royalty or payout address.", pattern: "guard at purchase", tone: "bg-sun/25" },
  { title: "Payroll", check: "Screen payee wallets at onboarding, watch them for later exposure, and guard each run.", pattern: "guard + watch", tone: "bg-blush-soft" },
  { title: "Custodians", check: "Everything an exchange does, plus watching every client address and evidence PDFs for audits.", pattern: "watch + webhooks + reports", tone: "bg-iris-soft" },
];

export function WhoBuilds() {
  return (
    <Container aria-labelledby="who-builds" className="flex flex-col gap-[22px] py-10">
      <Reveal>
        <h2 id="who-builds" className="text-[clamp(34px,4.4vw,44px)] leading-none font-extrabold">
          Who builds with Hera
        </h2>
      </Reveal>
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map((a) => (
          <StaggerItem key={a.title} as="article" lift className={cn("flex flex-col gap-2 rounded-[16px] border-2 border-line p-[18px] shadow-hard", a.tone)}>
            <h3 className="text-xl font-bold">{a.title}</h3>
            <p className="flex-1 text-sm leading-normal text-ink/80">{a.check}</p>
            <span className="self-start rounded-md border-2 border-line bg-card px-1.5 font-mono text-xs">{a.pattern}</span>
          </StaggerItem>
        ))}
      </Stagger>
    </Container>
  );
}

/* ─── Errors + proxy ────────────────────────────────────── */

const ERRORS = [
  ["HeraValidationError", "Bad address, checksum or field. Thrown before any request; fields says where."],
  ["HeraBlockedError", "guard() said block. Carries the full screening."],
  ["HeraAuthError", "Key missing, revoked or missing a scope."],
  ["HeraRateLimitError", "Slow down; retryAfter tells you when."],
  ["HeraConnectionError", "Hera unreachable or slow. Apply your fail-open or fail-closed policy."],
  ["HeraWebhookSignatureError", "Delivery wasn't signed by Hera, or is stale. Respond 400."],
  ["HeraError", "Anything else, like not_found or invalid_transition. Check code."],
];

export function ErrorsAndProxy() {
  return (
    <Container aria-label="Errors and key safety" className="grid gap-5 py-10 lg:grid-cols-2">
      <Reveal className="brutal min-w-0 overflow-hidden rounded-[18px]">
        <h2 id="errors" className="border-b-2 border-line px-5 py-4 text-2xl font-extrabold">
          Errors you&apos;ll see
        </h2>
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-labelledby="errors">
          <table className="w-full min-w-[520px] border-collapse text-sm" aria-labelledby="errors">
            <thead className="sr-only">
              <tr>
                <th scope="col">Error class</th>
                <th scope="col">When it happens</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map(([name, when]) => (
                <tr key={name} className="border-t border-dashed border-line/25 first:border-0">
                  <th scope="row" className="px-5 py-[11px] text-left font-mono font-normal whitespace-nowrap">
                    {name}
                  </th>
                  <td className="px-5 py-[11px] text-ink-soft">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="min-w-0 overflow-hidden rounded-[18px] border-2 border-line shadow-[4px_4px_0_var(--blush)]">
        <div data-theme="dark" className="flex h-full flex-col gap-3 bg-paper p-5 text-ink sm:p-[22px]">
          <h2 className="text-2xl font-extrabold">Keep your key on the server</h2>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            The SDK refuses to run in a browser by default. Expose a narrow route instead: authenticate the user, rate-limit, forward only the address,
            and return only what the UI needs.
          </p>
          <CodeWindow filename="app/api/screen/route.ts" code={PROXY_SAMPLE} shadow="none" actions={<CopyButton value={PROXY_SAMPLE} label="Copy the proxy route" />} />
        </div>
      </Reveal>
    </Container>
  );
}

/* ─── API reference ─────────────────────────────────────── */

const ENDPOINTS = [
  ["POST", "/v1/screen", "screen"],
  ["GET", "/v1/screenings[/:id]", "read"],
  ["GET · POST · DELETE", "/v1/wallets…", "read / monitor"],
  ["GET · PATCH", "/v1/alerts…", "read / monitor"],
  ["GET · POST", "/v1/travel-rule/transfers…", "travel_rule"],
  ["GET · POST", "/v1/reports…", "read"],
  ["GET", "/v1/reports/verify?sha256=", "public"],
];

export function ApiReference() {
  return (
    <Container id="api" aria-labelledby="api-title" className="scroll-mt-20 pt-10 pb-24">
      <Reveal className="flex flex-col gap-6 rounded-[22px] border-2 border-line bg-paper-2 p-6 shadow-hard sm:p-9 lg:flex-row lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-1">
          <span className="eyebrow text-[13px]">REST · OpenAPI 3.1</span>
          <h2 id="api-title" className="text-[clamp(32px,4.4vw,44px)] leading-none font-extrabold">
            API reference
          </h2>
          <p className="text-[17px] leading-relaxed text-ink-soft">
            Prefer raw HTTP, or another language? Every endpoint, with request and response schemas, is in one OpenAPI document. Point your client
            generator or HTTP tool at it. Authenticate with <code className="font-mono text-[15px] text-ink">Authorization: Bearer hera_live_…</code>.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/api/v1/openapi.json" className={buttonStyles({ variant: "primary" })}>
              Open openapi.json <ExternalLink className="size-4" aria-hidden />
            </a>
          </div>
        </div>
        <div className="brutal min-w-0 overflow-hidden lg:flex-1">
          <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Main endpoints">
            <table className="w-full min-w-[440px] border-collapse text-sm">
              <caption className="border-b-2 border-line px-4 py-3 text-left font-mono text-xs tracking-[0.1em] text-ink-soft uppercase">
                Main endpoints · key scope
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Path</th>
                  <th scope="col">Scope</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(([method, path, scope]) => (
                  <tr key={path} className="border-t border-dashed border-line/25 first:border-0">
                    <td className="py-2.5 pr-2 pl-4 font-mono text-[11px] whitespace-nowrap text-ink-soft">{method}</td>
                    <th scope="row" className="px-2 py-2.5 text-left font-mono text-[13px] font-medium break-all">
                      {path}
                    </th>
                    <td className="py-2.5 pr-4 pl-2 text-right">
                      <span className={cn("rounded-md border-2 border-line px-1.5 font-mono text-[11px] whitespace-nowrap", scope === "public" ? "bg-peacock-soft" : "bg-card")}>
                        {scope}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-center gap-1.5 border-t-2 border-line px-4 py-3 text-[13px] text-ink-soft">
            <ArrowRight className="size-3.5" aria-hidden /> Webhooks and API keys are managed in the dashboard.
          </p>
        </div>
      </Reveal>
    </Container>
  );
}
