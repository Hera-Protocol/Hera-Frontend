import { type Address, type Chain, decodeFunctionData, erc20Abi, type Hash, type Hex, type WalletClient } from "viem";
import type { ChainId, GuardOptions, GuardResult, Hera } from "@hera/sdk";

/** Chains Hera knows. Anything else (e.g. testnets) is screened under Ethereum mainnet identity. */
const HERA_EVM_CHAINS = new Set([1, 8453, 42161, 10, 137]);

export interface TxRequest {
  to: Address;
  data?: Hex;
  value?: bigint;
}

export type Target =
  | { kind: "native"; recipient: Address; amount: bigint }
  | { kind: "erc20.transfer" | "erc20.transferFrom"; recipient: Address; token: Address; amount: bigint; from?: Address }
  | { kind: "erc20.approve"; recipient: Address; token: Address; amount: bigint }
  | { kind: "contract_call"; recipient: Address };

/**
 * Who actually receives value. For an ERC-20 transfer, `tx.to` is the token
 * contract (USDC, say), which is never the risky party: the recipient is in
 * the calldata. Screening `tx.to` would wave every token transfer through.
 */
export function resolveTarget(tx: TxRequest): Target {
  if (!tx.data || tx.data === "0x") return { kind: "native", recipient: tx.to, amount: tx.value ?? 0n };
  try {
    const call = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    switch (call.functionName) {
      case "transfer":
        return { kind: "erc20.transfer", recipient: call.args[0], token: tx.to, amount: call.args[1] };
      case "transferFrom":
        return { kind: "erc20.transferFrom", from: call.args[0], recipient: call.args[1], token: tx.to, amount: call.args[2] };
      case "approve":
        // Approvals to drainers are a top phishing vector: the spender is the counterparty.
        return { kind: "erc20.approve", recipient: call.args[0], token: tx.to, amount: call.args[1] };
    }
  } catch {
    // Not ERC-20 calldata.
  }
  return { kind: "contract_call", recipient: tx.to };
}

export function heraChainFor(chain: Pick<Chain, "id"> | undefined): ChainId {
  return chain && HERA_EVM_CHAINS.has(chain.id) ? `evm:${chain.id}` : "evm:1";
}

export interface GuardedSendOptions {
  hera: Hera;
  /** Overrides the chain Hera screens on. Defaults to the wallet's chain, or evm:1 for chains Hera doesn't cover. */
  heraChain?: ChainId;
  /** Print the decision, never send. */
  dryRun?: boolean;
  guard?: GuardOptions;
}

export interface GuardedSendResult {
  target: Target;
  verdict: GuardResult;
  hash?: Hash;
}

/**
 * Screens the real recipient, then sends. Throws `HeraBlockedError` before
 * anything is signed if Hera blocks the recipient.
 */
export async function guardedSendTransaction(walletClient: WalletClient | undefined, tx: TxRequest, options: GuardedSendOptions): Promise<GuardedSendResult> {
  const target = resolveTarget(tx);
  const verdict = await options.hera.guard(
    { address: target.recipient, chain: options.heraChain ?? heraChainFor(walletClient?.chain) },
    { review: "allow", ...options.guard },
  );
  if (options.dryRun) return { target, verdict };
  if (!walletClient?.account) throw new Error("guardedSendTransaction needs a wallet client with an account (or dryRun: true).");
  const hash = await walletClient.sendTransaction({ ...tx, account: walletClient.account, chain: walletClient.chain });
  return { target, verdict, hash };
}
