/**
 * A Stellar wallet's "send" flow with a Hera pre-sign check.
 *
 *   1. The user enters a destination (G…, M… or G… + memo) and an amount.
 *   2. Before signing, the wallet backend calls hera.guard() on the destination.
 *   3. Blocked → stop. Review → warn and ask for confirmation. Allow → sign.
 *
 * Builds on TESTNET. Nothing is submitted unless SUBMIT=1 and STELLAR_SECRET are set.
 */
import { Account, Asset, BASE_FEE, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { Hera, HeraBlockedError, HeraConnectionError, HeraValidationError, type GuardResult, type SubjectInput } from "@hera/sdk";
import { createDemoFetch } from "./demo-fetch";

try {
  process.loadEnvFile();
} catch {
  // no .env: use the real environment
}

const TESTNET_HORIZON = "https://horizon-testnet.stellar.org";
const apiKey = process.env.HERA_API_KEY?.trim();
const demo = !apiKey;

// In a real wallet this runs on your backend, never in the app bundle: the key must stay server-side.
const hera = new Hera({
  apiKey: apiKey || "hera_test_demodemo_offline-demo-key-not-a-real-secret",
  baseUrl: process.env.HERA_BASE_URL || undefined,
  fetch: demo ? createDemoFetch() : undefined,
  userAgent: "stellar-wallet-guard-example/0.0.0",
});

interface Destination {
  label: string;
  address: string;
  memo?: { type: "id" | "text" | "hash"; value: string };
}

const EXCHANGE = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const destinations: Destination[] = [
  { label: "Plain G… account", address: EXCHANGE },
  { label: "Muxed M… address (SEP-23)", address: "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAAFJOYK" },
  { label: "G… plus memo (exchange deposit)", address: EXCHANGE, memo: { type: "id", value: "1234567" } },
  { label: "Typo in the address", address: `${EXCHANGE.slice(0, -1)}A` },
];

/** The memo the user typed goes into the screen call AND the transaction, so both describe the same recipient. */
function toScreenInput(d: Destination): SubjectInput {
  return d.memo ? { address: d.address, memo: d.memo } : { address: d.address };
}

function describe(verdict: GuardResult): string {
  // Hera returns the decoded identity: the muxed id or memo survives into the result (and alerts, reports, audit).
  const subject = verdict.screening.subject;
  let who = "base account only";
  if (subject.chain === "stellar" && subject.sub?.kind === "muxed") who = `muxed id ${subject.sub.id} under ${subject.account.slice(0, 6)}…`;
  else if (subject.chain === "stellar" && subject.sub?.kind === "memo") who = `memo ${subject.sub.type} ${subject.sub.value}`;
  const lines = [`  Hera: ${verdict.decision.toUpperCase()} (score ${verdict.score}/100, ${verdict.band}) · screened as ${who}`];
  for (const r of verdict.screening.reasons) lines.push(`    - ${r.title}${r.points ? ` (+${r.points})` : ""}`);
  return lines.join("\n");
}

async function loadSource(): Promise<{ keypair: Keypair; account: Account; live: boolean }> {
  const secret = process.env.STELLAR_SECRET?.trim();
  if (!secret) {
    const keypair = Keypair.random();
    return { keypair, account: new Account(keypair.publicKey(), "0"), live: false };
  }
  const keypair = Keypair.fromSecret(secret);
  const loaded = await new Horizon.Server(TESTNET_HORIZON).loadAccount(keypair.publicKey());
  return { keypair, account: new Account(keypair.publicKey(), loaded.sequenceNumber()), live: true };
}

async function send(d: Destination, amount: string): Promise<void> {
  console.log(`\n▸ ${d.label}\n  to ${d.address}${d.memo ? `  memo ${d.memo.type}=${d.memo.value}` : ""}`);

  let verdict: GuardResult;
  try {
    verdict = await hera.guard(toScreenInput(d), { review: "allow" });
  } catch (error) {
    if (error instanceof HeraBlockedError) {
      console.log(`  BLOCKED. Not signing. ${error.screening.reasons[0]?.title ?? ""}`);
      console.log("  Tell the user: \"We can't send to this address. Contact support if you think this is wrong.\"");
      return;
    }
    if (error instanceof HeraValidationError) {
      console.log(`  Rejected before any network call: ${error.message}`);
      return;
    }
    if (error instanceof HeraConnectionError) {
      // Policy decision: this demo fails closed. Many wallets fail open below a small amount.
      console.log("  Hera unreachable. Failing closed: not signing.");
      return;
    }
    throw error;
  }

  console.log(describe(verdict));
  if (verdict.needsReview) console.log("  Warn the user and ask them to confirm before signing (e.g. \"Exchanges usually need a memo. Add one?\").");

  const { keypair, account, live } = await loadSource();
  let builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    // M… destinations are accepted directly; the muxed id travels inside the operation.
    .addOperation(Operation.payment({ destination: d.address, asset: Asset.native(), amount }))
    .setTimeout(180);
  if (d.memo) builder = builder.addMemo(d.memo.type === "id" ? Memo.id(d.memo.value) : d.memo.type === "text" ? Memo.text(d.memo.value) : Memo.hash(d.memo.value));
  const tx = builder.build();
  tx.sign(keypair);
  console.log(`  Signed TESTNET tx ${Buffer.from(tx.hash()).toString("hex").slice(0, 16)}… (${tx.operations.length} op${d.memo ? `, memo ${d.memo.type}` : ""})`);

  if (process.env.SUBMIT === "1" && live) {
    const res = await new Horizon.Server(TESTNET_HORIZON).submitTransaction(tx);
    console.log(`  Submitted: ${res.hash}`);
  } else {
    console.log("  Not submitted (set SUBMIT=1 and STELLAR_SECRET to submit on testnet).");
  }
}

console.log(demo ? "Offline demo: Hera responses are simulated. Set HERA_API_KEY to screen against the real API." : `Screening against ${hera.toJSON().baseUrl}`);
for (const d of destinations) await send(d, "10");
