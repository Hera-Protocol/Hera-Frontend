/**
 * Pre-sign guard for EVM dApps and wallets.
 *
 *   DRY_RUN=1 (default): decode three transactions, screen the real recipient, print the decision.
 *   DRY_RUN=0 + PRIVATE_KEY: also send on Sepolia when Hera allows it.
 */
import { createWalletClient, encodeFunctionData, erc20Abi, http, parseEther, parseUnits, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { Hera, HeraBlockedError, HeraValidationError } from "@hera/sdk";
import { createDemoFetch } from "./demo-fetch";
import { guardedSendTransaction, type TxRequest } from "./guard";

try {
  process.loadEnvFile();
} catch {
  // no .env
}

const apiKey = process.env.HERA_API_KEY?.trim();
const dryRun = process.env.DRY_RUN !== "0";
const hera = new Hera({
  apiKey: apiKey || "hera_test_demodemo_offline-demo-key-not-a-real-secret",
  baseUrl: process.env.HERA_BASE_URL || undefined,
  fetch: apiKey ? undefined : createDemoFetch(),
  userAgent: "evm-presign-guard-example/0.0.0",
});

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const SANCTIONED = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
const FRIEND = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

const txs: { label: string; tx: TxRequest }[] = [
  {
    label: "USDC transfer to a sanctioned address (tx.to is the USDC contract)",
    tx: { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [SANCTIONED, parseUnits("250", 6)] }) },
  },
  {
    label: "USDC transferFrom to a regular address",
    tx: { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "transferFrom", args: [FRIEND, FRIEND, parseUnits("10", 6)] }) },
  },
  { label: "Native ETH send", tx: { to: FRIEND, value: parseEther("0.01") } },
  { label: "Lower-case typo with a bad checksum", tx: { to: "0x098b716b8Aaf21512996dC57EB0615e2383E2f96", value: 1n } },
];

let walletClient: WalletClient | undefined;
if (!dryRun) {
  const key = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) throw new Error("DRY_RUN=0 needs PRIVATE_KEY (a Sepolia key).");
  walletClient = createWalletClient({ account: privateKeyToAccount(key), chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL) });
}

console.log(`${apiKey ? "Hera API" : "Offline demo (simulated Hera)"} · ${dryRun ? "dry run: nothing is signed" : "live on Sepolia"}`);
for (const { label, tx } of txs) {
  console.log(`\n▸ ${label}`);
  try {
    const { target, verdict, hash } = await guardedSendTransaction(walletClient, tx, { hera, dryRun });
    console.log(`  screened ${target.kind} recipient ${target.recipient}`);
    console.log(`  ${verdict.decision.toUpperCase()} (score ${verdict.score}, ${verdict.band})${verdict.needsReview ? " · needs review" : ""}`);
    console.log(hash ? `  sent ${hash}` : "  dry run: would send now");
  } catch (error) {
    if (error instanceof HeraBlockedError) console.log(`  BLOCKED before signing: ${error.message}`);
    else if (error instanceof HeraValidationError) console.log(`  Rejected locally, no network call: ${error.message}`);
    else throw error;
  }
}
