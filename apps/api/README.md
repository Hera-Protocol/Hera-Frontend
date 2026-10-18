# @hera/api

The Hera compliance API: screening, wallet monitoring, alerts, Travel Rule, teams and invites, webhooks, compliance PDF reports, API keys and a hash-chained audit log. It is a NestJS 11 app that implements the REST contract in `packages/core/src/contract.ts`. All risk logic (address parsing, chain adapters, scoring, Travel Rule checks, webhook signatures) comes from `@hera/core`. This package adds persistence, auth, email, delivery and HTTP.

## Running it

```bash
pnpm install
pnpm --filter @hera/core build        # the API consumes core's dist/
pnpm --filter @hera/api dev           # watch mode, http://localhost:4000/v1
```

You don't need a database or a mail server. Without `DATABASE_URL`, the API runs embedded Postgres ([PGlite](https://pglite.dev)) and keeps its data in `apps/api/.data/pg`. Outside production, email goes to `apps/api/.data/mail/` as `.html` and `.txt` files, and the links are logged. Report PDFs land in `apps/api/.data/reports/`. `.data` is gitignored; delete it to start over. Migrations run on every startup.

| Script | What it does |
|---|---|
| `dev` | `nest start --watch` |
| `build` | `nest build` (tsc, CommonJS) into `dist/` |
| `start` | `node dist/main.js` |
| `test` | vitest: e2e suites against in-memory PGlite with stubbed chain data, plus unit and type-level tests |
| `test:pg` | the same suite against a real Postgres 17 that [embedded-postgres](https://github.com/leinelissen/embedded-postgres) starts in a temp dir and removes afterwards; each test app gets a fresh database |
| `typecheck` | `tsc --noEmit` over src and tests (this is what enforces the OpenAPI drift tests) |
| `openapi` | builds, then writes `apps/api/openapi.json` (the SDK is generated from it) |
| `db:generate` | `drizzle-kit generate`: writes a new SQL migration to `drizzle/` from `src/db/schema.ts` |

To change the schema, edit `src/db/schema.ts`, run `pnpm --filter @hera/api db:generate`, and commit the generated files in `drizzle/`. When you change a route or a DTO, run `pnpm --filter @hera/api openapi` and commit `openapi.json`; a test fails if it's stale.

The web app proxies `/api/*` to `http://localhost:4000/*`, so in development the browser sees one origin.

## Environment

`main.ts` loads `apps/api/.env` if one exists (see `.env.example`). Every variable is optional in development.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` turns on secure cookies, SMTP mail, the webhook SSRF guard, and stops links from being logged. |
| `PORT` | `4000` | |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS origin (with credentials), and the base URL for links in email and report footers (`/verify/<reference>`). |
| `DATABASE_URL` | unset | Postgres via `pg`. When unset, PGlite is used. |
| `DATA_DIR` | `apps/api/.data` | Root for PGlite, mail drops and local report storage. |
| `PGLITE_DIR` | `$DATA_DIR/pg` | `memory://` gives an in-memory database. |
| `SESSION_COOKIE_NAME` | `hera_session` | |
| `COOKIE_SECURE` | `true` in production | |
| `API_KEY_PEPPER` | dev default | HMAC key for API key secrets. Set it in production: the server logs a loud warning when it falls back to the default. Changing it invalidates every key. |
| `MAIL_DRIVER` | `log`, or `smtp` in production | `log` writes each message to `$DATA_DIR/mail/`; `smtp` sends through `SMTP_URL`. |
| `SMTP_URL` | unset | e.g. `smtps://user:pass@smtp.example.com:465`. Required when the driver is `smtp`; startup fails without it. |
| `MAIL_FROM` | `Hera <no-reply@heralayer.com>` | |
| `WEBHOOK_SECRET_KEY` | dev default | 32 bytes, base64 (`openssl rand -base64 32`). AES-256-GCM key for webhook signing secrets at rest. Like the pepper, production logs a warning on the default, and changing it makes stored secrets unreadable (rotate every endpoint). |
| `WEBHOOK_DISPATCH_INTERVAL_MS` | `2000` | How often the outbox is polled. `0` disables the dispatcher. Always off in tests. |
| `REPORT_JOB_INTERVAL_MS` | `5000` | How often the report job runner polls for queued reports (it's also poked when one is queued). `0` disables it. |
| `MONITOR_INTERVAL_MS` | `120000` | How often watched wallets are rescreened. `0` disables the monitor. |
| `SCREEN_DEADLINE_MS` / `SCREEN_MAX_PAGES` | `8000` / `2` | Chain-data budget for screens a caller waits on (`POST /screen`, adding and refreshing a wallet). The monitor uses core's fuller defaults (Horizon 20 s, Blockscout 15 s). |
| `HORIZON_URL` | `https://horizon.stellar.org` | |
| `TRUST_PROXY` | `loopback` | Express `trust proxy`, so rate limits see the client IP behind the Next.js proxy. |
| `AUTH_RATE_LIMIT` / `SCREEN_RATE_LIMIT` / `VERIFY_RATE_LIMIT` | `10` / `60` / `30` | Requests per minute per IP. |

Node's server timeouts are set above the screening budget: `requestTimeout` 120 s, `headersTimeout` 60 s, `keepAliveTimeout` 65 s.

## Modules

```
src/
  main.ts, app.module.ts, app.setup.ts   bootstrap; app.setup is shared with the e2e tests
  config/        env → AppConfig, injected as APP_CONFIG
  db/            Drizzle schema, PGlite / node-postgres factory, migrations on startup
  common/        ApiError + global filter, ZodPipe, JSON-only middleware, x-request-id, Idempotency-Key, rate-limit groups
  auth/          signup/login/logout/me, email verification, password reset, org switching, sessions, AuthGuard
  mail/          MailerService over a MailTransport (log | smtp), and the email templates
  team/          invites (create, list, revoke, resend, lookup, accept) and member roles/removal
  api-keys/      key generation, HMAC storage, Bearer authentication
  audit/         append-only hash chain per org, list + verify, canonical JSON
  screening/     POST /screen, screenings history, ScreeningEngine (core + 60s LRU + budgets), LabelsService, FETCH token
  wallets/       watchlist, rescreening, alert creation, wallet.activity, MonitorService
  alerts/        alert list/detail/update, notes, dedupe, high/critical alert emails
  travel-rule/   IVMS101 transfers, threshold checks, status machine
  webhooks/      endpoints, encrypted secrets, outbox, WebhookDispatcher, SSRF guard
  reports/       snapshots, react-pdf templates, local storage, ReportJobs, public verify
  openapi/       documentation-only response schemas, route table, document builder, GET /openapi.json
  org/           org details and rename
  overview/      dashboard aggregates
  system/        /health and /chains
assets/fonts/    DM Sans and DM Mono (SIL OFL 1.1, licenses alongside), embedded in PDFs
```

Every tenant table carries `org_id`, and every query filters on it. A record from another org is a 404.

Request bodies and queries are validated with the zod schemas exported by `@hera/core`. Any validation failure returns 422:

```json
{ "error": { "code": "validation_failed", "message": "…", "fields": { "originator.firstName": "Required" } } }
```

Every error, including 404s, 429s and malformed JSON, comes back as `{ error: { code, message, fields? } }`. The codes in use: `unauthenticated`, `invalid_credentials`, `forbidden`, `not_found`, `email_taken`, `wallet_exists`, `invalid_transition`, `already_member`, `invite_pending`, `invite_accepted`, `invite_revoked`, `invite_expired` (410), `last_owner`, `report_not_ready`, `chain_not_live` (422), `idempotency_key_reused` (422), `idempotency_in_progress` (409), `unsupported_media_type`, `invalid_json`, `payload_too_large`, `validation_failed`, `rate_limited`, `chain_unavailable` (502), `internal_error`.

**Request ids.** Every response carries `x-request-id`: the caller's value if it sent a sane one (`[A-Za-z0-9._:-]`, up to 128 chars), otherwise a fresh uuid. Error log lines include it. CORS exposes it.

**Idempotency.** `POST /v1/screen` and `POST /v1/travel-rule/transfers` accept `Idempotency-Key`. The first request claims the key (per org and route), and its 2xx response is stored for 24 hours; repeats replay it with `Idempotent-Replayed: true`. The same key with a different body is 422 `idempotency_key_reused`; a repeat while the first is still running is 409 `idempotency_in_progress`. Errors aren't stored, so a failed request can be retried with the same key.

### Screening and monitoring

- `ScreeningEngine` calls `screenSubject` from core with the injected `FETCH` and the `LabelsService` index (today `SEED_LABELS`). Results are cached in memory per `subjectKey` for 60 seconds. A wallet refresh or monitor pass skips the cache. Request-path screens pass `deadlineMs`/`maxPages` (8 s, 2 pages); the monitor doesn't. A chain the registry knows but hasn't switched on (e.g. `evm:8453`) is 422 `chain_not_live` with `fields.chain`, before any network call. `ChainDataError` (an upstream failure or timeout) is 502 `chain_unavailable`.
- `POST /v1/screen` stores the full `ScreeningResult` as a screening row, audits `screening.created` and emits `screening.completed`. Wallet rescreens update the wallet but don't add screening rows, so the monitor doesn't flood the history.
- Each wallet screen (on create, on refresh, and from the monitor) opens an alert for every reason worth at least 25 points, deduplicated per org on `walletId:reasonCode:(txHash ?? counterparty ?? 'subject')`. Each new alert emits `alert.created`; new high and critical alerts email the org's owners and admins (unless they set `alertEmails: false`). A rescreen that sees a newer `last_activity_at` emits `wallet.activity` with the count of new transfers.
- `MonitorService` registers an interval with `@nestjs/schedule` and rescreens wallets whose `last_checked_at` is older than the interval, two at a time. It's off in tests and when the interval is `0`.

### Audit chain

`hash = sha256(prevHash + canonicalJSON({ seq, actor, action, target, metadata, createdAt }))`, with keys sorted at every depth. `prevHash` for seq 1 is 64 zeros. Each append locks the org row (`SELECT … FOR UPDATE`) and runs inside the same transaction as the change it records. `GET /v1/audit/verify` recomputes the whole chain and reports the first `seq` that doesn't match. The actor is the user's email, `api_key:hera_live_<prefix>` for API keys, or `system` for the dispatcher and job runner.

Audited actions include `user.signup`, `user.login`, `user.logout`, `user.email_verified`, `user.switched_org`, `user.notifications_updated`, `password.reset`, `invite.created|resent|revoked|accepted`, `member.role_changed|removed|left`, `screening.created`, `wallet.created|deleted`, `alert.updated`, `travel_rule.created|transitioned`, `api_key.created|revoked`, `webhook.created|updated|deleted|secret_rotated|tested|redelivered|disabled`, `report.requested|generated|failed` and `org.updated`.

### Email

`MailerService` sends rendered templates through a `MailTransport`: `LogMailTransport` (one log line, plus the full message as `.html` and `.txt` in `$DATA_DIR/mail/`) or `SmtpMailTransport` (nodemailer). Delivery failures are logged, never thrown, and sends happen after the transaction commits. Templates (`src/mail/templates.ts`): verify email, password reset, team invite, alert notification, report ready. They are table-based with inline CSS in Hera's look (paper `#FFF5E8`, ink `#17130F`, 2px ink borders, sun `#FFC93C` buttons), use no images (the logo is an ink square beside a bold wordmark), escape all user content, and each has a plain-text twin.

### Teams

- Signup emails a verification link (`/verify-email?token=…`, 24 h). `POST /v1/auth/verify-email` confirms it; `POST /v1/auth/resend-verification` sends a new one (a no-op once verified). `UserDto.emailVerified` reflects `users.email_verified_at`. Login is not blocked while unverified.
- Invites last 7 days and are stored as token hashes. One pending invite per email per org (409 `invite_pending`); members can't be re-invited (409 `already_member`). Accepting creates the account (name plus a password that meets core's `passwordSchema`) or, for an existing account, checks its current password (401 otherwise) and adds the membership. Either way the email counts as verified and a session starts in the inviting org. Expired, revoked or used invites are 410 `invite_expired`; resending issues a new token and kills the old link.
- Owners can set any role. Admins can't change owners or make anyone an owner. The last owner can never be demoted or removed (409 `last_owner`). Anyone can leave. A removed member's sessions for that org are deleted.
- A user can belong to several orgs. `GET /v1/me/orgs` lists them; `POST /v1/auth/switch-org` re-points the session (403 if not a member). Login picks the oldest membership.

### Webhooks

- Endpoints store the `whsec_…` signing secret encrypted with AES-256-GCM (random IV, the endpoint id as associated data); only `secretPrefix` (first 12 chars) is ever shown again. The secret appears once, on create and on rotate.
- Events are written to an outbox (`webhook_events` + one `webhook_deliveries` row per subscribed, enabled endpoint) in the same transaction as the change. The envelope is `WebhookEvent` from core; the exact JSON body is stored so redeliveries are byte-identical.
- `WebhookDispatcher` polls every `WEBHOOK_DISPATCH_INTERVAL_MS`. It claims due deliveries with `FOR UPDATE SKIP LOCKED` and a 2-minute lease (safe across instances; PGlite has one connection, so it never contends), then POSTs with `Content-Type: application/json`, `User-Agent: Hera-Webhooks/1.0`, `hera-signature` (`signWebhookPayload` from core) and `hera-event-id`. 10 s timeout, redirects not followed, any 2xx is success, the first 1 KB of an error body is kept.
- Retries wait 30 s, 2 m, 10 m, 30 m, 1 h, 2 h, 4 h, 8 h and 8 h: 10 attempts over about 24 hours, then `failed`. `failureCount` counts consecutive failed attempts and resets on success; at 20 the endpoint is disabled and `webhook.disabled` is audited. Re-enabling resets the count. Pending deliveries for a disabled endpoint wait.
- SSRF: in production, every address the socket connects to is checked (via a custom `lookup`, so DNS rebinding can't slip through), and IP literals are checked directly. Refused: 0/8, 10/8, 100.64/10, 127/8, 169.254/16 (cloud metadata), 172.16/12, 192.0.0/24, 192.168/16, 198.18/15, multicast and reserved, `::`, `::1`, fc00::/7, fe80::/10, ff00::/8, and IPv4-mapped/NAT64 forms of all of those. Saving an endpoint also checks up front (422). Outside production nothing is blocked, so `http://localhost` receivers work.

### Reports

- `screening_evidence` and `travel_rule` render synchronously (201, `ready`); `audit` is queued (202) and rendered by `ReportJobs` (`queued → rendering → ready | failed`), which claims work with `FOR UPDATE SKIP LOCKED`. Tests call `tick()`.
- Every report is built **snapshot first**: a JSON snapshot from the database (the audit report holds counts only, never IVMS101 data), serialised with the audit module's canonical JSON and hashed. The PDF is rendered from that snapshot alone. Both files go to `ReportStorage` (local disk under `$DATA_DIR/reports/<org>/<report>.{pdf,json}` today; an S3 implementation slots in behind the same interface). `GET /reports/:id/json` serves the exact canonical bytes, so `sha256(file) == jsonSha256`.
- `report.generated` is audited with both hashes in the same transaction that marks the report ready, which also emits `report.ready`. Async reports email the requester.
- `GET /v1/reports/verify?sha256=` is public (30/min per IP), matches either hash of a ready report, and returns only reference, type, org name, date and which artifact matched.
- PDFs use `@react-pdf/renderer` with TSX templates in `src/reports/templates/` (on Node 24 the ESM package loads through `require(esm)`; tsconfig uses `module: node20` so TypeScript allows it). DM Sans and DM Mono are embedded from `assets/fonts/` (Helvetica/Courier if missing). Every page footer has the reference, the JSON SHA-256, `Verify: <WEB_ORIGIN>/verify/<reference>` and "Page x of y". Long identifiers are shortened in narrow cells; the snapshot keeps them in full.

### OpenAPI

`GET /v1/openapi.json` serves an OpenAPI 3.1 document generated with `@asteasolutions/zod-to-openapi` v7 (the zod 3 line). Request schemas are the ones in `@hera/core`. Response DTOs are TypeScript interfaces in core, so `src/openapi/schemas.ts` defines documentation-only zod schemas, and `schemas.types.test.ts` asserts with `expectTypeOf` that each `z.infer` equals the core type: `pnpm typecheck` fails the moment core changes shape. `src/openapi/routes.ts` lists every route with its auth; an e2e test checks it against the controllers' decorators in both directions (path, method, public, minimum role, API key scope). The document covers cookie and bearer auth, per-route scopes (`x-hera-api-key-scope`, `x-hera-min-role`), error bodies, `x-request-id`, `Idempotency-Key`, and the webhook payloads as 3.1 `webhooks`.

## Auth model

**Sessions.** On signup, login or invite acceptance the server issues 32 random bytes (base64url) in an `HttpOnly; SameSite=Lax; Path=/` cookie, `Secure` per config. The database stores only the token's SHA-256. Sessions last 30 days and slide: the expiry and the cookie are refreshed at most once an hour. Logout deletes the session. A password reset deletes all of the user's sessions. Login runs argon2id (19 MiB, t=2), and an unknown email is checked against a dummy hash so response time doesn't reveal which accounts exist.

**CSRF.** Every POST/PUT/PATCH/DELETE must send `Content-Type: application/json`, including requests with no body; anything else gets a 415. Combined with SameSite=Lax, this blocks cross-site form posts. Requests that carry an `Authorization` header are exempt, since they aren't cookie-authenticated.

**API keys.** Keys look like `hera_live_<8-char prefix>_<32-byte base64url secret>`. The database stores the prefix and `HMAC-SHA256(API_KEY_PEPPER, secret)`. The secret appears only once, in the create response. Send it as `Authorization: Bearer <key>`. A Bearer header always takes precedence over the cookie. An invalid or revoked key returns 401. `last_used_at` is updated at most once a minute.

| Scope | Allows |
|---|---|
| `screen` | `POST /v1/screen` |
| `read` | `GET` wallets, alerts, screenings, overview; reports: create `screening_evidence`, list, get, download |
| `monitor` | `POST /v1/wallets`, `DELETE /v1/wallets/:id`, `POST /v1/wallets/:id/refresh`, `PATCH /v1/alerts/:id` |
| `travel_rule` | every `/v1/travel-rule/*` endpoint; with `read`, also creating and downloading `travel_rule` reports (they contain IVMS101 data) |

API keys get 403 on every other route, including keys, audit, org, team, webhooks and me, which require a dashboard session. Audit reports can be downloaded with `read` but only created from a session.

**Roles (RBAC).** These apply to session callers. A denied request returns 403 `forbidden`.

| Role | Can |
|---|---|
| viewer | read everything except invites and webhooks; download reports; leave the org |
| analyst | + screen, add, remove and refresh wallets, update alerts, create and transition Travel Rule transfers, generate reports, view webhooks and deliveries |
| admin | + API keys, invites, member roles (not owners), removing members (not owners), webhooks, renaming the org |
| owner | + any role change, including making and removing owners (signup makes you owner) |

**Rate limits.** `signup`, `login`, `forgot-password`, `reset-password`, `verify-email`, `resend-verification`, `invites/lookup` and `invites/accept` share a budget of 10 requests per minute per IP. `/v1/screen` allows 60 per minute. `/v1/reports/verify` allows 30. The limiter uses in-memory storage, so each instance counts separately.

## Endpoints not covered by the contract

- `PATCH /v1/me/notifications` takes `{ alertEmails: boolean }` and returns it. Its schema lives in `src/auth/auth.controller.ts` until `@hera/core` exports one.
- `POST /v1/auth/forgot-password` and `/resend-verification` → `202 { ok: true }`. `/reset-password` and `/verify-email` → `200 { ok: true }`.
- `POST /v1/auth/logout`, `DELETE /v1/wallets/:id`, `/keys/:id`, `/invites/:id`, `/webhooks/:id` and `/org/members/:userId` → `204`, no body.
- `PATCH /v1/org/members/:userId` → `MemberDto`. `POST /v1/invites/:id/resend` → `InviteDto`. `POST /v1/webhooks/:id/test` and `/webhooks/deliveries/:id/redeliver` → `202 WebhookDeliveryDto`.
- `GET /v1/screenings?limit=` (default 50, max 200), `GET /v1/audit?limit=` (default 100, max 500), `GET /v1/webhooks/:id/deliveries?limit=` (default 50, max 200). `GET /v1/reports` returns the newest 100.
- `GET /v1/reports/:id/pdf` and `/json` → 409 `report_not_ready` until the report is ready.
