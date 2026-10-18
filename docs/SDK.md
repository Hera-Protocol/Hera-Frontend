# How Hera fits into your app

Hera is a compliance API for teams that move value on **Stellar** and **EVM chains**. It covers KYT screening, wallet monitoring, alerts, the Travel Rule and audit-ready reports. Every score comes from Hera's own chain ingestion and its own labels, and it always comes with its reasons. We don't resell another vendor's data.

This page is for engineers at wallets, exchanges, anchors and dApps who are deciding where Hera goes in their stack. The SDK reference is in [`packages/sdk/README.md`](../packages/sdk/README.md). Runnable examples are in [`examples/`](../examples).

## Quick start

```ts
import { Hera, HeraBlockedError } from "@hera/sdk";

const hera = new Hera({ apiKey: process.env.HERA_API_KEY! }); // server-side, `screen` scope

export async function beforeSend(destination: string, memo?: string) {
  try {
    const verdict = await hera.guard(memo ? { address: destination, memo: { type: "id", value: memo } } : destination);
    if (verdict.needsReview) await flagForCompliance(verdict.screening.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof HeraBlockedError) return { ok: false, reason: error.screening.reasons[0]?.title };
    throw error; // network or auth: apply your fail-open or fail-closed policy
  }
}
```

`guard` accepts `G…`, `M…` (muxed), `G…` plus a memo, and `0x…` addresses. It validates them locally, then screens them.

---

## How it works

```
 your server                        Hera API                                  data
┌─────────────┐  POST /v1/screen   ┌──────────────────────────────┐
│ guard(addr) │ ─────────────────▶ │ parse subject (SEP-23, EIP-55)│
│             │  Bearer hera_live… │ fetch live history ───────────┼──▶ Horizon (Stellar)
│             │                    │                               │──▶ Blockscout (EVM)
│             │                    │ match Hera labels ────────────┼──▶ Hera label set (sanctions,
│             │                    │ score: direct + 1st-hop       │     scams, mixers, exchanges…)
│             │ ◀───────────────── │   exposure + behavior         │
└─────────────┘  { decision,       │ store screening + audit entry │
                   score, band,    └──────────────────────────────┘
                   reasons[] }
```

1. **Parse.** The address becomes a structured subject. `M…` is decoded into a base account and a muxed id, a memo is attached as a sub-account, and EVM addresses are checksum-verified. The SDK runs the same parser before the request, so typos never leave your server.
2. **Fetch.** Hera pulls the subject's recent history from the chain: payments, path payments, merges and token transfers.
3. **Label.** The subject and every counterparty are matched against Hera's label set. Each label records its source.
4. **Score.** The score runs from 0 to 100, with a band (`low` <25, `medium` <50, `high` <75, `severe`) and a decision (`allow`, `review` or `block`). Each reason says how many points it added and why. A direct sanctions hit always forces 100 and `block`.
5. **Record.** The screening is stored (`result.id`) and written to the org's hash-chained audit log. You can export it later as a PDF evidence report.

### Three integration patterns

| Pattern | When | Calls | Latency |
|---|---|---|---|
| **1. Pre-transaction guard** (sync) | Before you sign, broadcast or credit | `hera.guard(counterparty)` | One HTTP round trip plus a chain fetch. Hot subjects are cached for 60 s |
| **2. Post-transaction monitoring** (async) | Addresses you hold or that pay you, over time | `wallets.watch` (needs the `monitor` scope), then `alert.created` and `wallet.activity` webhooks | Rescreened every 2 min by default |
| **3. Travel Rule exchange** | VASP-to-VASP transfers above a jurisdiction's threshold | `travelRule.create` → `.transition(...)` → `reports.create({ type: "travel_rule" })` | Synchronous record and threshold check |

Most production setups combine pattern 1 on the money path with pattern 2 on everything you custody. Regulated VASPs add pattern 3.

### Muxed IDs and memos

On Stellar, one `G…` account often serves thousands of customers. Exchanges, anchors and custodians tell customers apart with a **muxed address** (`M…`, SEP-23) or a **memo**. Hera treats each customer as its own subject:

- `screen("M…")`: Hera decodes the address into `{ account: "G…", sub: { kind: "muxed", id } }`. It screens the base account and the sub-account's own activity, and adds `SUBACCOUNT_RESOLVED`.
- `screen({ address: "G…", memo: { type: "id", value: "1234567" } })`: the same idea for memo-routed accounts. Use exactly the memo you will put on the transaction.
- `screen("G…")` on an account that is clearly shared adds `SHARED_ACCOUNT_NO_SUBACCOUNT`. That is the "you probably forgot the memo" signal, and also a sign that funds may not reach the intended customer.
- Don't combine `M…` with a memo. The SDK rejects it, because the muxed address already carries the id.

The sub-account survives everywhere: in alerts, Travel Rule records, reports and the audit log.

---

## Which apps can use it

| App | The check | Pattern |
|---|---|---|
| Self-custody wallet | Screen the recipient before signing a send | 1 |
| Exchange / on- and off-ramp | Screen the sender before crediting a deposit, the destination before a withdrawal, and file Travel Rule records | 1 + 2 + 3 |
| Stellar anchor (SEP-6/24/31) | Screen the customer's account (with memo or muxed id) at deposit and withdrawal, and the counterparty anchor on SEP-31 | 1 + 2 + 3 |
| Payment / remittance app | Screen the recipient at quote and again at send | 1 (+ 3) |
| Merchant / checkout | Screen the payer when payment arrives, before fulfilling | 1 (post-receipt) |
| DeFi front-end | Screen the connecting wallet; gate write actions only | 1 via proxy |
| DAO / treasury payouts | Screen every payee at proposal and again at execution | 1 |
| Bridge | Screen the depositor on the source chain and the recipient on the destination chain | 1 + 2 |
| NFT marketplace | Screen buyer and seller at purchase, and payout addresses | 1 |
| Payroll | Screen payee wallets at onboarding, monitor them, and guard each run | 1 + 2 |
| Custodian | Everything an exchange does, plus watch every customer address and export reports | 1 + 2 + 3 |

### Self-custody wallets

Run the check when the user taps **Send**, before signing. Screen the destination exactly as it will appear in the transaction: `M…` as-is, or `G…` with the memo. Show `review` as a warning the user can accept, and `block` as a hard stop that names the top reason. Wallets usually fail open on network errors below a small amount and closed above it. The key lives on your backend, so the app calls your endpoint ([proxy pattern](#keep-the-key-on-a-server-the-proxy-pattern)). See [`examples/stellar-wallet-guard`](../examples/stellar-wallet-guard).

### Exchanges and on/off-ramps

- **Deposits:** when a deposit lands on a customer's address or memo, screen the **sender** (`from`, which may itself be muxed) before crediting. `block` means the deposit stays uncredited and is frozen for review. `review` means credit it but hold withdrawals.
- **Withdrawals:** guard the destination with its memo before you broadcast. Use `guard(dest, { review: "throw" })` when your operations team prefers manual approval over auto-send.
- **Travel Rule:** above the jurisdiction's threshold, record the transfer with `travelRule.create`. The response's `check` field says whether data is required, and whether a self-hosted wallet needs proof of control.
- **Monitoring:** watch hot wallets and deposit accounts, and subscribe to `alert.created`.

### Stellar anchors (SEP-6, SEP-24, SEP-31)

Anchors route customers by memo or muxed id on a shared distribution account. Screen at the sub-account level:

- **Deposit** (the anchor sends to the user): screen the user's destination account before paying out.
- **Withdrawal** (the user sends to the anchor's account with the memo you issued): screen the incoming payment's source account, and watch `{ address: distributionAccount, memo }` for that customer.
- **SEP-31** (cross-border, anchor to anchor): screen the sending anchor's account, and file a Travel Rule record with the IVMS101 data you collected through SEP-12. The beneficiary VASP's `domain` is the counterparty's home domain from stellar.toml.

### Payment and remittance apps

Screen the recipient when you show the quote, so the user learns early, and again right before you send, because a lot can change in between. Many remittance payouts go to anchors or exchanges with a memo, so always screen with the memo. Above Travel Rule thresholds, file a record.

### Merchants and checkout

You can't stop an incoming transaction, but you can decide whether to fulfill the order. When payment is detected, screen the payer. On `block`, hold the order and follow your refund policy. If customers connect a wallet before paying, screen it at that point too, through your proxy.

### DeFi front-ends

Screen the **connecting** wallet once per session through your proxy, and cache the decision server-side. Gate **write** actions (swap, deposit, borrow) on it. **Don't block reads**: pages, prices and positions stay visible, and only signing is gated. Re-screen on account change. Remember that a front-end check is a UX layer, and a determined user can bypass it. Where the protocol needs enforcement, enforce it where you control execution, for example in a relayer or an allowlisted router.

### DAO and treasury payouts

Screen every payee when the proposal is created and attach the screening ids to the proposal. Screen again in the executor right before release. Treasuries can afford a human in the loop, so use `guard(payee, { block: ["block", "review"] })`. A screening evidence PDF per payee makes the audit trail easy.

### Bridges

Screen the depositor on the source chain before you mint or release on the destination, and screen the destination recipient. Watch your bridge's custody addresses to catch exposure that arrives later. Hera scores Ethereum and Stellar live today. Other EVM chains are recognized but not yet live (see [Limits](#limits-and-honest-caveats)).

### NFT marketplaces

Screen both the buyer and the seller at purchase, and every royalty or payout address when it is configured. Block listings from blocked sellers. A sanctioned buyer must not be able to settle a trade.

### Payroll

Screen each payee wallet when it is added. Watch payee wallets so that later exposure triggers an alert, and guard each payroll run in bulk. Employees often get paid into exchange accounts, so collect and screen the memo.

### Custodians

Everything in the exchange section applies. In addition, watch every customer address, route `alert.created` into your case tool, and use reports (screening evidence and Travel Rule records) for auditors and banking partners. Every PDF carries SHA-256 hashes that anyone can check at `GET /v1/reports/verify?sha256=…`.

---

## Security

### Keep the key on a server: the proxy pattern

An API key in a browser or mobile bundle is a public key. The SDK refuses to start when it detects a browser. Instead, expose a narrow endpoint of your own:

```
browser ──POST /api/screen { address, memo }──▶ your server ──Bearer key──▶ Hera
        ◀── { decision, band, score, reasons[{code,title}] } ───┘
```

Your endpoint should:

- **authenticate your user**, so anonymous traffic never reaches Hera
- **rate-limit per user**
- **accept only the fields it forwards**, so the key can't be used for anything else
- **return a narrow result**, keeping transfers, counterparties and label sources on your server

[`examples/nextjs-proxy`](../examples/nextjs-proxy) is a complete App Router handler. The browser check is for UX. Run the authoritative `guard` again server-side when you sign or credit.

### Webhooks: verify the raw body

```ts
const event = Hera.webhooks.constructEvent(rawBody, req.headers["hera-signature"], process.env.HERA_WEBHOOK_SECRET!);
```

- The signature (`Hera-Signature: t=…,v1=HMAC-SHA256(secret, "t.rawBody")`) covers the **exact bytes** Hera sent. Read the raw body (`await req.text()`, `express.raw()`, or collected chunks). Parsing and re-serializing JSON breaks the signature.
- Signatures older than 5 minutes are rejected, which blocks replays. Keep your clock in sync.
- Respond `2xx` within 10 s and process afterwards. Failed deliveries retry after 30 s, 2 min, 10 min and up to 8 h, about 10 attempts over roughly 24 h. An endpoint auto-disables after 20 consecutive failures.
- Deduplicate on `event.id`, which is also sent as `Hera-Event-Id`. Redeliveries reuse it.
- See [`examples/webhook-receiver`](../examples/webhook-receiver). It includes a local sender, so you can test without an account.

### Rotating secrets

- **API keys:** create a new key, deploy it, then revoke the old one (Settings → API keys). Both work during the overlap. Revocation takes effect immediately.
- **Webhook secrets:** `rotate-secret` invalidates the old secret **immediately**. For zero downtime, add a second endpoint with the same URL, verify against both secrets for a deploy cycle (try the new secret, and fall back to the old one on `mismatch`), then delete the old endpoint.

### Least-privilege scopes

| Scope | Allows | Give it to |
|---|---|---|
| `screen` | `POST /v1/screen` | Wallet backends, checkout, withdrawal services |
| `read` | screenings, wallets, alerts, overview; reports create/list/get/download | Dashboards, reporting jobs, webhook receivers that download PDFs |
| `travel_rule` | `/v1/travel-rule/*`; `travel_rule` reports also need it | Compliance back office |

Use one key per service, so revoking one key doesn't take everything down. Key management, webhook management, audit export and org settings are dashboard-only.

---

## Limits and honest caveats

**What phase 1 scores:**

- **Direct exposure:** labels on the subject itself, such as sanctions, stolen funds, ransomware, darknet, mixers, scams, gambling and high-risk exchanges.
- **First-hop counterparty exposure:** value received from or sent to labeled counterparties, weighted by severity and share.
- **Behavior:** fresh accounts, high velocity, rapid in-and-out, structuring, shared accounts without a sub-account, unverified home domains, clawback-enabled assets and smart-contract subjects.

**What it doesn't do yet:**

- **Multi-hop exposure.** Funds that passed through two or more intermediaries are not traced. This is planned for phase 2, behind the same reason codes, so your integration won't change.
- **More EVM chains.** Ethereum mainnet (`evm:1`) is live. Base, Arbitrum, Optimism and Polygon are recognized ids but not live, so screening them returns `chain_unavailable`. Testnets aren't screened.
- **Full history for very active accounts.** Hera scores a recent window. `profile.fullHistory: false` tells you the window didn't reach the account's creation.
- **Amount-aware screening.** `/v1/screen` takes the subject only. Direction, asset and amount inputs for threshold rules are planned.
- **Counterparty Travel Rule messaging.** Hera records IVMS101 data, applies jurisdiction thresholds and tracks the lifecycle. Delivering the payload to the counterparty VASP (Hera-to-Hera network, then TRP) comes in a later phase. Today you send it over your existing channel and record the result with `transition`.
- **Rate limits.** `POST /v1/screen` allows 60 requests a minute per client IP by default. Talk to us about higher limits for batch jobs.

**Results support a decision. They don't replace one.** A score is evidence: what Hera saw on-chain and which labels matched, with sources. Your compliance program decides what `review` means, what to block, and when to file. Thresholds and label policy should be reviewed with counsel before go-live.

---

## Errors

Every SDK error extends `HeraError` (`status`, `code`, `message`, `fields`, `requestId`).

| Class | HTTP | Typical `code` | Meaning | Do this |
|---|---|---|---|---|
| `HeraValidationError` | 422 (or local) | `validation_failed` | Bad address, checksum, memo, or body field. `fields` maps paths to messages | Show the message next to the input |
| `HeraAuthError` | 401 | `unauthenticated` | Missing, invalid or revoked key | Check `HERA_API_KEY` |
| `HeraAuthError` | 403 | `forbidden` | Key lacks the scope, or the route is dashboard-only | Add the scope or use the dashboard |
| `HeraRateLimitError` | 429 | `rate_limited` | Too many requests. `retryAfter` is in seconds | Back off. The SDK already retried |
| `HeraConnectionError` | – | `connection_error`, `timeout` | Hera unreachable or slow | Apply your fail-open or fail-closed policy |
| `HeraBlockedError` | – | `blocked` | `guard()` hit a decision you block. `.screening` has everything | Stop, and tell the user the top reason |
| `HeraWebhookSignatureError` | – | `webhook_signature_*` | Delivery not from Hera, tampered, or replayed. `.reason` says which | Respond 400 |
| `HeraError` | 404 | `not_found` | Unknown id, or not in your org | – |
| `HeraError` | 409 | `invalid_transition`, `wallet_exists` | State conflict | Read the message |
| `HeraError` | 5xx | `chain_unavailable`, `internal_error` | Upstream chain data or a Hera fault | Retry later. Idempotent calls were already retried |

The SDK retries network errors, `429` and `5xx` with backoff. It never retries a `POST` that may already have been processed, meaning a `5xx` or a timeout after the request was sent.
