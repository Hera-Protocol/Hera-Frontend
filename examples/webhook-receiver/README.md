# Example: webhook receiver (plain Node `http`)

A Hera webhook receiver with no framework. It:

1. reads the **raw** body (bytes) and verifies it with `Hera.webhooks.constructEvent`
2. answers `200` straight away, then does the work, because slow or non-2xx responses are retried
3. deduplicates on `event.id`, because retries deliver the same event again
4. switches on `event.type`, with `data` typed for each event:
   - `alert.created`: logs, and for high or critical alerts pretends to page on-call
   - `report.ready`: downloads the PDF with `hera.reports.download(id)` (needs `HERA_API_KEY` with `read`)
   - the remaining events are logged

## Try it without a Hera account

```bash
pnpm install
pnpm --filter @hera/sdk build
pnpm --filter @hera/example-webhook-receiver demo
```

`demo` starts the receiver on a free port and runs `send-test-event` against it. The sender signs fake events with `signWebhookPayload` from `@hera/core`, the same function the API uses. It then checks each response:

```
ok   200 alert.created
ok   200 report.ready
ok   200 retry of the same alert (deduplicated)
ok   400 tampered body (rejected)
ok   400 wrong secret (rejected)
ok   400 replayed 10 minutes later (rejected)
```

Or use two terminals:

```bash
pnpm --filter @hera/example-webhook-receiver start            # listens on :4242/webhooks/hera
pnpm --filter @hera/example-webhook-receiver send-test-event
```

## With a real endpoint

1. In the dashboard, open Settings → Webhooks and add `https://your-host/webhooks/hera`. Use `http://localhost:…` only for local testing. Copy the `whsec_…` secret, which is shown once.
2. Put it in `.env` as `HERA_WEBHOOK_SECRET`. Optionally, set `HERA_API_KEY` (read scope) so `report.ready` can download PDFs.

## Raw bodies in other frameworks

The signature covers the exact bytes Hera sent. Parsing them as JSON and serializing them again changes whitespace, and the signature check fails with `mismatch`.

| Framework | Get the raw body |
|---|---|
| Node `http` | collect the `data` chunks (this example) |
| Express | `app.post("/webhooks/hera", express.raw({ type: "application/json" }), (req) => constructEvent(req.body, …))` |
| Next.js App Router / Workers / Deno / Bun | `await request.text()` |
| Fastify | `addContentTypeParser("application/json", { parseAs: "buffer" }, …)` on that route |

## Rotating the secret

`POST /v1/webhooks/:id/rotate-secret` (dashboard) invalidates the old secret **immediately**. For zero downtime, create a second endpoint with the same URL. While both exist, accept a delivery if it verifies with either secret: try `constructEvent` with the new secret, and fall back to the old one on `mismatch`. Then delete the old endpoint.
