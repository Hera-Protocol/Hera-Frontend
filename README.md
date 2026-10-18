# Hera

Compliance for teams that move value on **Stellar** and **EVM chains**: wallet screening, KYT monitoring, AML risk scores with reasons, the Travel Rule, and signed compliance reports. Hera uses its own chain ingestion and its own labels. No resold vendor data.

```
apps/web        Next.js 16 · marketing site + dashboard
apps/api        NestJS 11 · REST API, auth, screening, webhooks, reports
packages/core   @hera/core · SEP-23 / EIP-55, chain adapters, risk engine, Travel Rule, API contract
packages/sdk    @hera/sdk · TypeScript client for apps and dApps
examples/       Stellar wallet guard, EVM pre-sign guard, webhook receiver, Next.js proxy
docs/           PLAN, ENGINE, SDK, WEB_GUIDE
```

## Run it locally

Requirements: Node 22+ and pnpm 10 (`corepack enable`). No Docker needed: in development the API uses an embedded Postgres (PGlite) stored in `apps/api/.data`.

```bash
pnpm install
pnpm dev            # core (watch), API on :4000, web on :3000
```

Open http://localhost:3000, sign up, and screen an address. Emails (verification, password reset, invites) are written to `apps/api/.data/mail/` in development, so you can click the links from there.

To use a real Postgres instead, set `DATABASE_URL` in `apps/api/.env`. See `apps/api/.env.example` for every option (SMTP, webhook secret key, monitor interval, and more).

## Checks

```bash
pnpm typecheck
pnpm test                               # core, api, sdk
pnpm --filter @hera/api test:pg         # API suite against a real (embedded) Postgres
pnpm --filter @hera/sdk test:e2e        # SDK against a freshly started API (uses live chain data)
node packages/core/scripts/smoke.ts     # live screening smoke test
```

## Deploying

- **Web:** Vercel with the project root set to `apps/web`. Set `HERA_API_URL` to the API's URL; the web app proxies `/api/*` to it, so session cookies stay first-party.
- **API:** any Node 22+ host (container image or ECS). Set `NODE_ENV=production`, `DATABASE_URL`, `WEB_ORIGIN`, `API_KEY_PEPPER`, `WEBHOOK_SECRET_KEY`, `MAIL_DRIVER=smtp`, `SMTP_URL` and `MAIL_FROM`, plus `TRUST_PROXY` when it runs behind a load balancer (so per-IP rate limits see real client IPs). Migrations run on startup.

## Docs

- [docs/PLAN.md](docs/PLAN.md): product scope, architecture, roadmap.
- [docs/ENGINE.md](docs/ENGINE.md): how screening and scoring work, and their limits.
- [docs/SDK.md](docs/SDK.md): integrating Hera into wallets, exchanges, anchors and dApps.
- [apps/api/README.md](apps/api/README.md): API modules, auth model, webhooks and reports.
- [docs/WEB_GUIDE.md](docs/WEB_GUIDE.md): conventions for building pages in the web app.
