# @hera/sdk

The TypeScript SDK for the [Hera](https://heralayer.com) compliance API: KYT screening, wallet monitoring, alerts, Travel Rule and compliance reports for Stellar and EVM chains.

- Typed with the same DTOs the API uses (`@hera/core`).
- Parses addresses locally first: Stellar `G…`, `M…` (muxed, SEP-23), `G…` with a memo, and EIP-55 `0x…`. Typos fail before any network call, with the message the API would return.
- Runs on Node 18 and later, Bun, Deno, Cloudflare Workers and other edge runtimes. It uses only `fetch`, `AbortController` and `TextEncoder`/`TextDecoder`.
- Retries with backoff and honors `Retry-After`. It never retries a request the server may already have acted on.

How Hera fits into your app, with patterns for wallets, exchanges, anchors and dApps: [docs/SDK.md](../../docs/SDK.md).

## Install

```bash
pnpm add @hera/sdk
```

## Quick start

```ts
import { Hera } from "@hera/sdk";

const hera = new Hera({ apiKey: process.env.HERA_API_KEY! }); // server-side only

const result = await hera.screen("MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK");
console.log(result.decision, result.score, result.band); // "allow" 8 "low"
for (const reason of result.reasons) console.log(`${reason.points} pts  ${reason.title}`);
```

`screen` accepts a string, or `{ address, chain?, memo? }`:

```ts
await hera.screen({ address: "GA5Z…KZVN", memo: { type: "id", value: "1234567" } }); // exchange deposit memo
await hera.screen({ address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96" });       // defaults to evm:1
await hera.screen({ address: "0x…", chain: "evm:8453" });                           // pick the EVM chain explicitly
```

On Stellar, a muxed `M…` address and a `G…` plus memo both point at a sub-account under a shared account, such as a customer at an exchange. Hera screens the base account and the sub-account together, and returns the decoded identity on `result.subject.sub`. Don't send a memo together with an `M…` address. The SDK rejects that combination, because the muxed address already carries the id.

## `guard`: the one-liner before you sign or credit

```ts
import { Hera, HeraBlockedError } from "@hera/sdk";

try {
  const verdict = await hera.guard(destination);           // throws if Hera says "block"
  if (verdict.needsReview) await queueForCompliance(verdict.screening);
  await signAndSubmit(tx);
} catch (error) {
  if (error instanceof HeraBlockedError) {
    showUser(`This address can't receive funds from us: ${error.screening.reasons[0]?.title}`);
  } else throw error;                                       // network or auth problem: fail closed or open, your call
}
```

| Option | Default | Meaning |
|---|---|---|
| `block` | `["block"]` | Decisions that stop the transaction |
| `review` | `"allow"` | `"throw"` treats `review` as blocked; `"allow"` lets it through with `needsReview: true` |
| `throwOnBlock` | `true` | `false` returns `{ allowed: false }` instead of throwing |
| `signal`, `timeoutMs`, `maxRetries` | client settings | Per-call overrides |

It returns `{ allowed, decision, needsReview, score, band, reasons, screening }`. `reasons` contains only the reasons that added points, highest first.

Decide up front what happens when Hera is unreachable. `guard` throws `HeraConnectionError` and leaves the choice to you. Most wallets fail open for small sends and closed for large ones. Exchanges usually fail closed.

## Resources

| Method | Endpoint | Key scope |
|---|---|---|
| `hera.screen(input)` / `hera.guard(input, opts)` | `POST /v1/screen` | `screen` |
| `hera.screenings.list({ limit })`, `.get(id)` | `GET /v1/screenings[/:id]` | `read` |
| `hera.wallets.list()` | `GET /v1/wallets` | `read` |
| `hera.wallets.watch(input)`, `.unwatch(id)`, `.refresh(id)` | `POST /v1/wallets`, `DELETE /v1/wallets/:id`, `POST /v1/wallets/:id/refresh` | see note |
| `hera.alerts.list({ status })`, `.get(id)` | `GET /v1/alerts[/:id]` | `read` |
| `hera.alerts.update(id, input)` | `PATCH /v1/alerts/:id` | see note |
| `hera.travelRule.create(input)`, `.list()`, `.get(id)`, `.transition(id, to, note?)` | `/v1/travel-rule/transfers…` | `travel_rule` |
| `hera.reports.create(input)`, `.list()`, `.get(id)` | `/v1/reports…` | `read` |
| `hera.reports.download(id)` → `Uint8Array` (PDF) | `GET /v1/reports/:id/pdf` | `read` |
| `hera.reports.snapshot(id)` → JSON | `GET /v1/reports/:id/json` | `read` |
| `hera.reports.waitUntilReady(id, { timeoutMs, intervalMs })` | polls `GET /v1/reports/:id` | `read` |

Watching, unwatching and refreshing wallets, and updating alerts, need an API key with the `monitor` scope (or a dashboard session, analyst or above). Webhook endpoints and API keys are managed in the dashboard only.

Reports: `screening_evidence` and `travel_rule` reports render synchronously (`201`, already `ready`). `audit` reports are queued (`202`) and need a dashboard session, and `travel_rule` reports also need the `travel_rule` scope. `waitUntilReady` works for both.

Every method takes an optional last argument, `{ signal, timeoutMs, maxRetries }`.

## Webhooks

Verify the raw body, before parsing it:

```ts
import { Hera, HERA_SIGNATURE_HEADER, HeraWebhookSignatureError } from "@hera/sdk";

// Node http / Express with express.raw({ type: "application/json" }) / Next.js `await req.text()`
const event = Hera.webhooks.constructEvent(rawBody, req.headers[HERA_SIGNATURE_HEADER], process.env.HERA_WEBHOOK_SECRET!);

switch (event.type) {
  case "alert.created":   page(event.data.severity, event.data.title); break;   // data: AlertDto
  case "wallet.activity": sync(event.data.wallet.id, event.data.newTransfers); break;
  case "report.ready":    await hera.reports.download(event.data.id); break;    // data: ReportDto
}
```

`constructEvent(rawBody: string | Uint8Array, header, secret, { toleranceSeconds = 300 })` checks the `Hera-Signature: t=…,v1=…` HMAC-SHA256 and the timestamp window. It returns an event typed by `type`, or throws `HeraWebhookSignatureError` with `reason` set to one of `malformed`, `expired`, `mismatch`, `invalid_payload` or `raw_body_required`. Respond `2xx` quickly and do the work afterwards. Deduplicate on `event.id` (also sent as the `Hera-Event-Id` header), because deliveries are retried.

Exported constants: `HERA_SIGNATURE_HEADER` (`"hera-signature"`), `HERA_EVENT_ID_HEADER` (`"hera-event-id"`) and `HERA_WEBHOOK_TOLERANCE_SECONDS`.

## Errors

Every error extends `HeraError` and carries `status`, `code`, `message`, `fields` and `requestId` (from the `x-request-id` header, when present).

| Class | When | What to do |
|---|---|---|
| `HeraValidationError` | `422`, or the same check failing locally | Show `fields` next to the inputs |
| `HeraAuthError` | `401` bad or revoked key; `403` missing scope or dashboard-only route | Check the key and its scopes |
| `HeraRateLimitError` | `429` after the retries are used up; `retryAfter` is in seconds | Back off, or ask for a higher limit |
| `HeraConnectionError` | Network failure or timeout (`code: "timeout"`) | Decide whether to fail open or closed |
| `HeraBlockedError` | `guard()` hit a blocked decision; `.screening` holds the full result | Stop the transaction and tell the user |
| `HeraWebhookSignatureError` | `constructEvent` couldn't verify the delivery; `.reason` says why | Respond `400` |
| `HeraError` | Anything else, e.g. `404 not_found` or `409 invalid_transition` | Check `code` |

### Retries

`maxRetries` defaults to 2, with exponential backoff (0.5 s, 1 s, 2 s and so on, capped at 8 s, with jitter). A `Retry-After` header of up to 60 s is honored exactly. A longer one is surfaced at once as `HeraRateLimitError`.

- `GET` and `DELETE` retry on network errors, timeouts, `408`, `429` and `5xx`.
- `POST` and `PATCH` retry only on connection failures (before any response) and on `429`. They never retry a `5xx` or a timeout, because the server may already have recorded the screening or the transfer.

## Security

- **The key stays on a server.** The constructor throws if it detects a browser (`window.document`). Put a narrow endpoint in front of Hera instead: see [the proxy pattern](../../docs/SDK.md#keep-the-key-on-a-server-the-proxy-pattern) and [`examples/nextjs-proxy`](../../examples/nextjs-proxy). `dangerouslyAllowBrowser: true` turns the check off. Don't.
- **The key is never logged.** `JSON.stringify(hera)`, `console.log(hera)` and `String(hera)` show `hera_live_<prefix>_****`, and error messages never include the key.
- **Use least privilege.** A checkout service needs only `screen`. A reporting job needs only `read`.

## Examples

- [`examples/stellar-wallet-guard`](../../examples/stellar-wallet-guard): a Stellar send flow with G, M and memo destinations
- [`examples/evm-presign-guard`](../../examples/evm-presign-guard): viem, decoding ERC-20 `transfer`/`transferFrom` to screen the real recipient
- [`examples/webhook-receiver`](../../examples/webhook-receiver): a plain Node `http` receiver plus a local test sender
- [`examples/nextjs-proxy`](../../examples/nextjs-proxy): an App Router route that keeps the key server-side

## Development

```bash
pnpm --filter @hera/sdk build       # tsup → ESM + CJS + d.ts
pnpm --filter @hera/sdk test        # unit tests with a mocked fetch; contract-drift check against apps/api/openapi.json
pnpm --filter @hera/sdk test:e2e    # builds and boots the real API on :4123 with a throwaway database
```
