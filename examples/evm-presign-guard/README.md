# Example: EVM pre-sign guard (viem)

`guardedSendTransaction(walletClient, tx, { hera })` screens the party that actually receives value, then sends.

The trap it avoids: for an ERC-20 transfer, `tx.to` is the **token contract** (USDC, for example), not the recipient. Screening `tx.to` would pass every token transfer, because USDC is not sanctioned. The guard decodes the calldata instead:

| Calldata | Screened party |
|---|---|
| none / `0x` (native send) | `tx.to` |
| `transfer(to, amount)` | `to` |
| `transferFrom(from, to, amount)` | `to` |
| `approve(spender, amount)` | `spender` (drainer approvals are a common phishing vector) |
| anything else | `tx.to`, the contract being called |

`resolveTarget(tx)` is exported on its own, so you can show "You're sending 250 USDC to 0x098B…" in your confirm sheet.

## Run it

```bash
pnpm install
pnpm --filter @hera/sdk build
pnpm --filter @hera/example-evm-presign-guard dry-run
```

The dry run decodes four transactions, screens each recipient and prints the decision. It never touches a wallet. Without `HERA_API_KEY`, Hera's responses are simulated (offline demo), while EIP-55 checksum validation runs locally for real. Expected output:

```
▸ USDC transfer to a sanctioned address (tx.to is the USDC contract)
  BLOCKED before signing: Hera blocked 0x098B…2f96 (score 100, severe): Sanctioned address (OFAC SDN).
▸ USDC transferFrom to a regular address
  ALLOW (score 6, low)
▸ Native ETH send
  ALLOW (score 6, low)
▸ Lower-case typo with a bad checksum
  Rejected locally, no network call: Checksum mismatch: …
```

To use the real API, set `HERA_API_KEY` (with the `screen` scope) and, optionally, `HERA_BASE_URL` in `.env`. To send for real on Sepolia, set `DRY_RUN=0` and `PRIVATE_KEY` (a Sepolia key only) and run `pnpm start`.

## Chains

Hera screens Ethereum mainnet live today. Base, Arbitrum, Optimism and Polygon are recognized but not live yet. `heraChainFor(walletClient.chain)` maps the wallet's chain to a Hera chain id. It falls back to `evm:1` for chains Hera doesn't cover (testnets, for example), which means "screen this address's mainnet identity". Pass `heraChain` to override.

## Where it runs

Run the guard on your backend, or in a wallet's privileged background process. Never put the key in a dApp bundle. For a dApp front-end, call your own endpoint ([`examples/nextjs-proxy`](../nextjs-proxy)), which calls Hera.
