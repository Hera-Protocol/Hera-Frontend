/**
 * A Hera webhook receiver with nothing but node:http.
 *
 * The rules that matter:
 *   1. Verify the RAW body. Parsing and re-serializing JSON changes the bytes and breaks the signature.
 *   2. Answer 2xx fast, then do the work. Hera retries non-2xx and slow responses.
 *   3. Deduplicate on event.id: retries deliver the same event more than once.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { Hera, HERA_SIGNATURE_HEADER, type HeraWebhookEvent, HeraWebhookSignatureError } from "@hera/sdk";
import { LOCAL_SECRET, PORT, WEBHOOK_PATH, WEBHOOK_SECRET } from "./config";

const MAX_BODY_BYTES = 1024 * 1024;

const apiKey = process.env.HERA_API_KEY?.trim();
const hera = apiKey ? new Hera({ apiKey, baseUrl: process.env.HERA_BASE_URL || undefined }) : null;

/** In production, use your database (a unique index on event id) instead of memory. */
const seen = new Set<string>();

function readRawBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    req.on("error", reject);
  });
}

async function handle(event: HeraWebhookEvent, log: (line: string) => void): Promise<void> {
  switch (event.type) {
    case "alert.created": {
      const alert = event.data;
      log(`alert.created  ${alert.severity.toUpperCase()} ${alert.title} on ${alert.subjectDisplay} (score ${alert.score})`);
      if (alert.severity === "high" || alert.severity === "critical") {
        // Replace with PagerDuty / Opsgenie / Slack.
        log(`  → paging on-call compliance: "${alert.title}" ${alert.txHash ? `tx ${alert.txHash}` : ""}`.trimEnd());
      }
      return;
    }
    case "alert.updated":
      log(`alert.updated  ${event.data.id} is now ${event.data.status}${event.data.disposition ? ` (${event.data.disposition})` : ""}`);
      return;
    case "report.ready": {
      const report = event.data;
      log(`report.ready   ${report.reference} "${report.title}" pdf sha256 ${report.pdfSha256?.slice(0, 12) ?? "?"}…`);
      if (!hera) {
        log("  → set HERA_API_KEY (read scope) to download the PDF");
        return;
      }
      const pdf = await hera.reports.download(report.id);
      await mkdir("reports", { recursive: true });
      await writeFile(`reports/${report.reference}.pdf`, pdf);
      log(`  → saved reports/${report.reference}.pdf (${pdf.byteLength} bytes)`);
      return;
    }
    case "screening.completed":
      log(`screening      ${event.data.display}: ${event.data.decision} (${event.data.score})`);
      return;
    case "wallet.activity":
      log(`wallet.activity ${event.data.wallet.label}: ${event.data.newTransfers} new transfer(s)`);
      return;
    case "travel_rule.updated":
      log(`travel_rule    ${event.data.reference} → ${event.data.status}`);
      return;
    default:
      // Newer event types still verify; ignore what you don't handle yet.
      log(`unhandled      ${(event as { type: string }).type}`);
  }
}

export function createReceiver(log: (line: string) => void = console.log): Server {
  return createServer(async (req, res) => {
    const reply = (status: number, body: Record<string, unknown>) => {
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.url !== WEBHOOK_PATH) return reply(404, { error: "not found" });

    let event: HeraWebhookEvent;
    try {
      const raw = await readRawBody(req);
      event = Hera.webhooks.constructEvent(raw, req.headers[HERA_SIGNATURE_HEADER], WEBHOOK_SECRET);
    } catch (error) {
      if (error instanceof HeraWebhookSignatureError) {
        log(`rejected       ${error.reason}: ${error.message}`);
        return reply(400, { error: error.reason });
      }
      return reply(413, { error: "body too large" });
    }

    if (seen.has(event.id)) {
      log(`duplicate      ${event.id} ignored`);
      return reply(200, { received: true, duplicate: true });
    }
    seen.add(event.id);
    reply(200, { received: true });

    // After the response: slow work never delays the acknowledgement.
    handle(event, log).catch((error: unknown) => log(`handler failed for ${event.id}: ${String(error)}`));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (WEBHOOK_SECRET === LOCAL_SECRET) console.warn("Using the local example secret. Set HERA_WEBHOOK_SECRET to your endpoint's whsec_… secret.");
  createReceiver().listen(PORT, () => console.log(`Listening on http://localhost:${PORT}${WEBHOOK_PATH}`));
}
