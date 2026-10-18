# Example: Next.js proxy route (keep the key server-side)

A browser must never hold a Hera API key: anyone can open dev tools and read it. This example is one file, [`app/api/screen/route.ts`](app/api/screen/route.ts). Drop it into any Next.js App Router project. It exposes a narrow endpoint to your own front-end:

```
Browser ──POST /api/screen { address, memo? }──▶ your route ──Bearer key──▶ Hera /v1/screen
        ◀── { decision, band, score, display, reasons[{code,title}] } ──┘
```

What the route does:

- **Authenticates the caller** with your session. Anonymous traffic never reaches Hera. Replace `currentUserId()` with NextAuth, Clerk or your own cookie check.
- **Rate-limits per user**: 20 a minute in memory. Use Redis or Upstash when you run more than one instance.
- **Accepts only `address` and `memo`**, so the browser can't use your key to call other endpoints.
- **Returns a narrow result**: decision, band, score and short reasons. Transfers, counterparties and label provenance stay on your server.
- **Maps errors**: a validation problem returns `422` with the SDK's message (a typo never leaves your server, because the SDK checks it locally). Auth, network and server failures return a generic `502`, and the details are logged on your side with Hera's `requestId`.

## Use it

```bash
# in your Next.js app
pnpm add @hera/sdk
cp app/api/screen/route.ts <your-app>/app/api/screen/route.ts
echo 'HERA_API_KEY=hera_live_…' >> .env.local   # NOT NEXT_PUBLIC_
```

From the browser:

```ts
const res = await fetch("/api/screen", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ address, memo }),
});
const verdict = await res.json(); // { decision: "allow" | "review" | "block", band, score, reasons }
if (verdict.decision === "block") disableSendButton(verdict.reasons[0]?.title);
```

Use a key with only the `screen` scope. The route runs on the Node.js runtime, or on Edge if you add `export const runtime = "edge"`. The SDK needs only `fetch`.

## Check it here

```bash
pnpm --filter @hera/example-nextjs-proxy typecheck
HERA_API_KEY=… HERA_BASE_URL=http://localhost:4000/v1 pnpm --filter @hera/example-nextjs-proxy smoke
```

`smoke.ts` calls the exported `POST` handler directly, with no Next.js server. It shows the 401 for a missing session, the local 422 for a typo, and the narrow response for a muxed address.

## Where the real decision happens

This endpoint is for **UX**: warn early and disable the button. The check that actually protects you must run again on your server, at the moment you sign or credit, because a browser can skip your UI. See [docs/SDK.md](../../docs/SDK.md).
