/**
 * Code samples for the marketing pages. Every call here exists in @hera/sdk
 * (packages/sdk/README.md); keep them in sync when the SDK changes.
 */

export const INSTALL_COMMAND = "npm install @hera/sdk";

export const SCREEN_SAMPLE = `import { Hera } from "@hera/sdk";

// Server-side only: the SDK refuses to run in a browser.
const hera = new Hera({ apiKey: process.env.HERA_API_KEY! });

const result = await hera.screen({
  address: "MA5ZSEJY…AFJOYK", // muxed: decoded for you
});

if (result.decision === "block") {
  throw new Error(result.reasons[0]?.title);
}`;

export const GUARD_SAMPLE = `import { Hera, HeraBlockedError } from "@hera/sdk";

// Server-side, with a \`screen\`-scoped key.
const hera = new Hera({ apiKey: process.env.HERA_API_KEY! });

// Before signing a send in your wallet:
try {
  const verdict = await hera.guard({
    address: recipient,
    memo: { type: "id", value: memo },
  });
  if (verdict.needsReview) await flag(verdict.screening);
  await signAndSubmit(tx);
} catch (error) {
  if (error instanceof HeraBlockedError) {
    showWarning(error.screening.reasons[0]?.title);
  } else throw error; // network or auth: your policy
}`;

export const WEBHOOK_SAMPLE = `// app/api/hera/webhook/route.ts
import {
  Hera,
  HERA_SIGNATURE_HEADER,
  HeraWebhookSignatureError,
} from "@hera/sdk";

export async function POST(req: Request) {
  const raw = await req.text(); // exact bytes: don't re-serialize
  try {
    const event = Hera.webhooks.constructEvent(
      raw,
      req.headers.get(HERA_SIGNATURE_HEADER),
      process.env.HERA_WEBHOOK_SECRET!,
    );
    switch (event.type) {
      case "alert.created":
        await page(event.data.severity, event.data.title);
        break;
      case "report.ready":
        await archive(event.data.id);
        break;
    }
    return new Response(null, { status: 204 }); // dedupe on event.id
  } catch (error) {
    if (error instanceof HeraWebhookSignatureError) {
      return new Response(error.reason, { status: 400 });
    }
    throw error;
  }
}`;

export const TRAVEL_RULE_SAMPLE = `import { Hera } from "@hera/sdk";

// Server-side, with a \`travel_rule\`-scoped key.
const hera = new Hera({ apiKey: process.env.HERA_API_KEY! });

const transfer = await hera.travelRule.create({
  direction: "outgoing",
  chain: "stellar",
  asset: "USDC",
  amount: "2500",
  amountUsd: 2500,
  jurisdiction: "EU",
  originator: { type: "natural", firstName: "Ada", lastName: "Okafor",
                customerId: "c-10293" },
  originatorAccount: { address: senderAccount },
  beneficiary: { type: "natural", firstName: "Lena", lastName: "Fischer" },
  beneficiaryAccount: { address: "MA5ZSEJY…AFJOYK" },
  beneficiaryVasp: { name: "Anchor", domain: "anchor.example" },
});

if (transfer.check.required) {
  // Send the IVMS101 payload, then record the step:
  await hera.travelRule.transition(transfer.id, "awaiting_counterparty");
}

await hera.reports.create({ type: "travel_rule", transferId: transfer.id });`;

export const PROXY_SAMPLE = `export async function POST(req: Request) {
  const user = await requireUser(req); // no anonymous calls
  await rateLimit(user.id);
  const { address } = await req.json();
  const r = await hera.screen({ address });
  return Response.json({ decision: r.decision });
}`;
