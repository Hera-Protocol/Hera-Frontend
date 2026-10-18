# Example: Stellar wallet guard

A Stellar wallet's send flow that calls `hera.guard()` on the destination before signing. It builds a real payment with `@stellar/stellar-sdk` on **TESTNET** and signs it. It submits only if you ask it to.

It walks through the destination forms a user can type:

| Destination | What goes to Hera | What goes in the transaction |
|---|---|---|
| `G…` | `{ address: "G…" }` | `payment.destination = G…` |
| `M…` (SEP-23 muxed) | `{ address: "M…" }`. Hera decodes it into base account + muxed id | `payment.destination = M…` (the id travels inside the operation) |
| `G…` + memo | `{ address: "G…", memo: { type: "id", value: "1234567" } }` | `payment.destination = G…` and `Memo.id("1234567")` |
| a typo | nothing: the SDK rejects the checksum locally | nothing |

The memo the user typed goes into both the screen call and the transaction, so Hera screens the same recipient the payment reaches. A `G…` exchange account screened without its memo often comes back as `review` with `SHARED_ACCOUNT_NO_SUBACCOUNT`. That is the "did you forget the memo?" warning.

## Run it

```bash
pnpm install
pnpm --filter @hera/sdk build
pnpm --filter @hera/example-stellar-wallet-guard start
```

Without `HERA_API_KEY`, the example runs an **offline demo**. Hera's responses are simulated, but the SDK's local validation (checksums, the muxed-plus-memo rule) is real. To screen for real, copy `.env.example` to `.env` and set:

| Variable | |
|---|---|
| `HERA_API_KEY` | A key with the `screen` scope |
| `HERA_BASE_URL` | Optional, e.g. `http://localhost:4000/v1` for a local API |
| `STELLAR_SECRET` | Optional TESTNET secret. Without it, a random keypair signs and nothing is submitted |
| `SUBMIT=1` | Submit to testnet. Needs a funded `STELLAR_SECRET`, and a destination that exists on testnet |

Hera screens **mainnet** history. Testnet is used here only so that no real funds can move.

## The pattern

```ts
try {
  const verdict = await hera.guard({ address, memo }, { review: "allow" });
  if (verdict.needsReview) await askUserToConfirm(verdict.reasons);
  sign(tx);
} catch (e) {
  if (e instanceof HeraBlockedError) return refuse(e.screening);
  if (e instanceof HeraConnectionError) return failClosedOrOpen(amount);
  throw e;
}
```

In a production wallet, `guard` runs on your backend, and the app calls your backend. The API key never ships in the app. See [docs/SDK.md](../../docs/SDK.md#keep-the-key-on-a-server-the-proxy-pattern).
