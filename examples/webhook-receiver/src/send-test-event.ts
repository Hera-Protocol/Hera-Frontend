/**
 * Signs fake events the way Hera does and posts them to the receiver, so you
 * can try it without a Hera account:
 *
 *   pnpm start                # terminal 1
 *   pnpm send-test-event      # terminal 2
 */
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { signWebhookPayload } from "@hera/core";
import { HERA_EVENT_ID_HEADER, HERA_SIGNATURE_HEADER, type HeraWebhookEvent } from "@hera/sdk";
import { PORT, WEBHOOK_PATH, WEBHOOK_SECRET } from "./config";

const now = () => new Date().toISOString();

function alertCreated(): HeraWebhookEvent {
  return {
    id: `evt_${randomUUID()}`,
    type: "alert.created",
    createdAt: now(),
    orgId: randomUUID(),
    data: {
      id: randomUUID(),
      walletId: randomUUID(),
      walletLabel: "Hot wallet 2",
      chain: "stellar",
      subjectDisplay: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK",
      reasonCode: "COUNTERPARTY_EXPOSURE",
      title: "Received funds from a sanctioned counterparty",
      detail: "1 inbound payment from an address on the OFAC SDN list.",
      severity: "critical",
      status: "open",
      score: 100,
      txHash: "3389e9f0f1a65f19736cacf544c2e825313e8447f569233bb8db39aa607c8889",
      notes: [],
      createdAt: now(),
      updatedAt: now(),
    },
  };
}

function reportReady(): HeraWebhookEvent {
  return {
    id: `evt_${randomUUID()}`,
    type: "report.ready",
    createdAt: now(),
    orgId: randomUUID(),
    data: {
      id: randomUUID(),
      reference: "RPT-2026Q4-TEST",
      type: "screening_evidence",
      title: "Screening evidence: GA5Z…KZVN",
      status: "ready",
      jsonSha256: "a".repeat(64),
      pdfSha256: "b".repeat(64),
      requestedBy: "analyst@example.com",
      createdAt: now(),
      readyAt: now(),
    },
  };
}

interface Delivery {
  label: string;
  body: string;
  signature: string;
  eventId: string;
  expect: number;
}

function signed(label: string, event: HeraWebhookEvent, expect = 200): Delivery {
  const body = JSON.stringify(event);
  return { label, body, signature: signWebhookPayload(WEBHOOK_SECRET, body), eventId: event.id, expect };
}

export async function sendTestEvents(url = `http://localhost:${PORT}${WEBHOOK_PATH}`): Promise<boolean> {
  const alert = signed("alert.created", alertCreated());
  const deliveries: Delivery[] = [
    alert,
    signed("report.ready", reportReady()),
    { ...alert, label: "retry of the same alert (deduplicated)" },
    { ...alert, label: "tampered body (rejected)", body: alert.body.replace('"critical"', '"low"'), expect: 400 },
    { ...alert, label: "wrong secret (rejected)", signature: signWebhookPayload("whsec_wrong", alert.body), expect: 400 },
    {
      ...alert,
      label: "replayed 10 minutes later (rejected)",
      signature: signWebhookPayload(WEBHOOK_SECRET, alert.body, Math.floor(Date.now() / 1000) - 600),
      expect: 400,
    },
  ];

  let ok = true;
  for (const d of deliveries) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", [HERA_SIGNATURE_HEADER]: d.signature, [HERA_EVENT_ID_HEADER]: d.eventId },
      body: d.body,
    });
    const pass = res.status === d.expect;
    ok &&= pass;
    console.log(`${pass ? "ok  " : "FAIL"} ${res.status} ${d.label} ${await res.text()}`);
  }
  return ok;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const ok = await sendTestEvents(process.argv[2]);
  process.exitCode = ok ? 0 : 1;
}
