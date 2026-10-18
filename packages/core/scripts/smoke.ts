/**
 * Live smoke test: screens a fixed set of real subjects against public Horizon
 * and Blockscout and prints score, band, decision, reasons and latency.
 *
 *   pnpm --filter @hera/core build
 *   node packages/core/scripts/smoke.ts            # Node >= 22.18 strips types natively
 *   node --experimental-strip-types packages/core/scripts/smoke.ts   # older Node 22
 *
 * It imports the built package (dist), so it exercises exactly what the API ships.
 * Pass subject names as arguments to run a subset, e.g. `smoke.ts vitalik ofac`.
 */
import { createLabelIndex, encodeMuxedAccount, parseSubject, SEED_LABELS, screenSubject } from "../dist/index.js";

const KRAKEN = "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM";

const SUBJECTS: { name: string; address: string; memo?: { type: "id" | "text" | "hash"; value: string } }[] = [
  { name: "circle-usdc-issuer", address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  { name: "kraken", address: KRAKEN },
  { name: "kraken-muxed", address: encodeMuxedAccount(KRAKEN, 1790254030022811771n) },
  { name: "kraken-memo", address: KRAKEN, memo: { type: "id", value: "1763579285836133015" } },
  { name: "vitalik", address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
  { name: "ofac-lazarus", address: "0x098B716B8Aaf21512996dC57EB0615e2383E2f96" },
  { name: "failed-txs", address: "0xcB4Ef0019663481E3Ab30EEf67e4dFfA9700896c" },
];

const labels = createLabelIndex(SEED_LABELS);
const only = process.argv.slice(2);

for (const s of SUBJECTS.filter((x) => only.length === 0 || only.some((o) => x.name.includes(o)))) {
  const parsed = parseSubject({ address: s.address, memo: s.memo });
  if (!parsed.ok) {
    console.log(`${s.name}: parse error: ${parsed.error}`);
    continue;
  }
  const started = performance.now();
  try {
    const r = await screenSubject(parsed.subject, { labels });
    const ms = Math.round(performance.now() - started);
    const p = r.profile as Record<string, unknown>;
    console.log(`\n${s.name}  score=${r.score} band=${r.band} decision=${r.decision}  ${ms} ms  engine=${r.engineVersion}`);
    console.log(
      `  view: ${r.stats.transfers} transfers (in ${r.stats.inbound} / out ${r.stats.outbound}), failed=${(r.stats as Record<string, unknown>).failed ?? "n/a"}, dust=${r.stats.dustFiltered}, observed=${r.profile.observedTransfers}, fullHistory=${r.profile.fullHistory}`,
    );
    if (p.window) console.log(`  window: ${JSON.stringify(p.window)}`);
    if (p.isContract !== undefined || p.delegatedTo) console.log(`  isContract=${p.isContract} delegatedTo=${p.delegatedTo ?? "-"}`);
    for (const reason of r.reasons) console.log(`  [${reason.code} +${reason.points} ${reason.severity}] ${reason.title}: ${reason.detail}`);
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    console.log(`\n${s.name}: ERROR after ${ms} ms: ${error instanceof Error ? error.message : String(error)}`);
  }
}
