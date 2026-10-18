# How Hera's engine works

This document describes the compliance engine in `packages/core` (`@hera/core`), engine version **2026.10.2**. It is written for two readers: engineers who change the engine, and compliance officers who need to know what a Hera score means and where it stops meaning anything.

Hera screens Stellar accounts and EVM addresses. It decodes the subject, reads live chain data, and returns a risk score from 0 to 100. Every score comes with reasons. Hera uses its own intelligence: its own labels and heuristics, read from public chain data. It does not resell third-party risk data, and the engine ignores the reputation tags and scam flags that Blockscout serves.

---

## 1. The pipeline

```
parse → fetch → normalize → narrow to sub-account → label → score → explain
```

| Step | Where | What happens |
|---|---|---|
| Parse | `subject.ts` `parseSubject` | User or API input becomes a `SubjectRef`. `M…` addresses are decoded (SEP-23) at this point, so nothing downstream ever treats a muxed strkey as an ordinary account. EVM input is validated against EIP-55. Memo ids are canonicalized (no leading zeros) and hash memos are lowercased, so equal memos get equal keys. Never throws on any input string; this is property-tested. |
| Fetch | `adapters/horizon.ts`, `adapters/blockscout.ts` | Live data is read from Horizon or Blockscout v2. Reads are paged within a page budget and a time budget (section 4). |
| Normalize | same | Raw records become chain-agnostic `Transfer`s. Dust is removed and counted (`stats.dustFiltered`). Failed transactions are kept but marked `successful: false`. |
| Narrow | `risk.ts` `transfersForSubject` | For a muxed or memo subject, only that customer's transfers are kept (section 2). |
| Label | `labels.ts` `LabelIndex` | Each counterparty, and the subject itself, is looked up in Hera's label set. |
| Score | `risk.ts` `scoreSubject` | Rules fire and add points; the formula in section 7 turns them into one score, a band and a decision. |
| Explain | same | Every rule that fires emits a `Reason` with a code, its points, a severity, a plain-English detail, and evidence (the label, transaction hashes, the counterparty). |

`screenSubject` (in `screen.ts`) runs fetch through explain. `scoreSubject` is the pure part: given the same input and the same `now`, it returns the same output.

---

## 2. Subjects: why muxed and memo identities matter

```ts
type SubjectRef =
  | { chain: "stellar"; account: string /* G… */; sub?: StellarSubAccount }
  | { chain: `evm:${number}`; address: `0x${string}` /* EIP-55 */ };

type StellarSubAccount =
  | { kind: "muxed"; id: string /* uint64 as decimal */; muxed: string /* M… */ }
  | { kind: "memo"; type: "id" | "text" | "hash"; value: string };
```

On Stellar, one `G…` account often holds the funds of thousands of customers. Exchanges and anchors tell them apart with a **muxed id** (an `M…` address that wraps the `G…` key and a 64-bit id) or a **memo** on the payment. If you screen the bare `G…`, you are screening the exchange, not the customer. Two customers of the same exchange can carry very different risk.

So the subject is always structured, and the sub-account survives every step.

- **Muxed view.** These are transfers where the `M…` address (same base account *and* same id) is the sender or the receiver. A payment from customer 42 to customer 7 of the same exchange is an outflow to a counterparty, not a self-transfer.
- **Memo view.** These are payments *into* the account that carry that memo. Outbound payments are excluded on purpose: the memo routes a payment to the *destination's* customer, so a memo on an outbound payment names someone else's customer.
  - Id memos are matched numerically, so `0042` matches `42`.
  - Text memos are matched exactly.
  - A `hash` subject matches both `hash` and `return` memos. Both are 32 bytes, and whoever typed the hex rarely knows which type the sender chose.
- **Base view with omnibus traffic.** Screening an account that looks like it serves many customers, without a sub-account, adds `SHARED_ACCOUNT_NO_SUBACCOUNT` (section 6.3).
- The muxed or memo view is always a subset of the base view. This is property-tested.

`subjectKey()` gives a stable cache and database key for each `(account, sub)` pair.

---

## 3. Data sources

### Stellar: Horizon (`adapters/horizon.ts`)

All of these requests run in parallel. The default host is `horizon.stellar.org`, and `horizonUrl` overrides it.

| Request | Purpose |
|---|---|
| `GET /accounts/{G}` | Existence, `home_domain`, flags (auth required/revocable, clawback), XLM balance. A 404 means the account was never seen. |
| `GET /accounts/{G}/payments?limit=200&order=desc&join=transactions&include_failed=false` | Payments, path payments, `create_account`, `account_merge`, and Soroban SAC transfers (`invoke_host_function` balance changes), with the transaction memo. Paged through `_links.next`, up to 3 pages. The next link is re-based onto the configured host, in case Horizon sits behind a proxy. |
| `GET /accounts/{G}/operations?limit=1&order=asc&include_failed=false` | The oldest retained operation. If it is this account's `create_account`, that is the creation time. Otherwise creation is unknown (never guessed). |
| `GET /accounts/{G}/effects?limit=200&order=desc` | Finds `claimable_balance_claimed` and `claimable_balance_created` effects. |
| `GET /claimable_balances/{id}/operations?join=transactions` | For up to 10 balances, in parallel. Resolves each claim into a transfer: from the creator, to the claimant, at claim time, for the created amount and asset, with the memo of the creating transaction. Unclaimed balances, and balances reclaimed by their creator, are not transfers. |
| `GET https://{home_domain}/.well-known/stellar.toml` | SEP-1. The domain claim is `verified` only if the toml lists this account back. |

Normalization keeps:

- muxed ids on every party (`from_muxed_id`, `to_muxed_id`, `funder_muxed_id`, `account_muxed_id`, `into_muxed_id`)
- the source asset and amount of path payments (`Transfer.sourceAsset`, `Transfer.sourceAmount`), so a path payment funded with a risky asset is visible
- hash and return memos, converted to lowercase hex.

### EVM: Blockscout v2 (`adapters/blockscout.ts`)

These run in parallel against `https://eth.blockscout.com/api/v2` for Ethereum. Other chains are configured in `chains.ts` but are not live yet.

| Request | Purpose |
|---|---|
| `GET /addresses/{a}` | Existence, balance, ENS name, `is_contract`, `proxy_type`, `implementations`. |
| `GET /addresses/{a}/transactions` | Top-level native value. `status: "error"` (reverted) and `null` (pending) are marked unsuccessful. |
| `GET /addresses/{a}/internal-transactions` | Native value moved by contracts, such as mixer withdrawals. `delegatecall` and `staticcall` are skipped, because they cannot move value. Calls with `success: false`, or inside a reverted transaction, are marked unsuccessful. |
| `GET /addresses/{a}/token-transfers` | ERC-20, ERC-721 and ERC-1155 transfers. Logs inside a reverted transaction are marked unsuccessful. |
| `GET /smart-contracts/{a}` | Fallback only, when the address has code but no `proxy_type` and no creation transaction. Used to read the bytecode prefix (below). |

The three list endpoints are paged through `next_page_params`, up to 2 pages of 50 each.

**EIP-7702.** An EOA that delegates its code (for example vitalik.eth delegates to `AmbireAccount7702`) has code, so Blockscout reports `is_contract: true`. Its code is only the 23-byte designator `0xef0100 ‖ delegate`, and the account is still controlled by a private key. Hera detects delegation in two ways:

- `proxy_type: "eip7702"` (primary), with the delegate taken from `implementations[0]`
- `deployed_bytecode` starting with `0xef0100` (fallback).

A delegated account gets `profile.isContract: false`, `profile.delegatedTo`, and the `EIP7702_DELEGATED` reason. Only real deployed contracts get `SMART_CONTRACT`.

### Dust (`dust.ts`)

Dust costs nothing to send, and anyone can send it to anyone. It is dropped before scoring and counted in `stats.dustFiltered`.

| Asset | Dust if amount is below |
|---|---|
| XLM | 0.001 |
| Known USD stablecoin (any chain, by issuer) | 0.01 |
| Other Stellar asset | 0.00001 (value unknown, so only obvious dust) |
| Any EVM transfer | exactly 0 (address poisoning uses zero-value token transfers) |

Merges, account creations and NFTs are never dust.

### USD values

Only stablecoins from known issuers count as dollars (`amount.ts` `USD_STABLECOINS`):

- Stellar: Circle USDC.
- Ethereum: USDC, USDT, DAI, PYUSD, USDP, TUSD, FDUSD and USDe. Every contract address was checked against the explorer.

A spam token named "USDC" is not dollars. No price feed is used for anything else.

---

## 4. Window, budgets and latency

Public Horizon and Blockscout are slow and uneven. On 2026-10-18 we measured:

- 4 to 15 s for one 200-record Horizon page on a busy account
- 2 to 6 s per Blockscout page
- one Blockscout page (vitalik.eth internal transactions, page 2) that returned HTTP 524 after 125 s.

The adapters therefore work to a budget.

| Option | Horizon default | Blockscout default | Meaning |
|---|---|---|---|
| `maxPages` | 3 (× 200) | 2 (× 50) per endpoint | Page budget per paged endpoint |
| `deadlineMs` | 20 000 | 15 000 | Wall-clock budget for the whole adapter call |
| `timeoutMs` | 15 000 | 15 000 | Per request, never beyond the deadline |
| `claimBudget` | 10 | n/a | Claimable balances resolved per screen |

The first page of each source is mandatory: if it fails, the screen fails with `ChainDataError`, and the API returns 502 `chain_unavailable`. Later pages are best-effort. A late or failed page is dropped and the screen goes ahead on what was read.

A fast transient failure (connection reset, 429, 502, 503, 504) is retried once, within the same request budget. Timeouts are not retried.

`profile.window` records what was actually read:

```json
{ "pages": { "payments": 3, "effects": 1 }, "records": 800, "truncatedBy": "page_budget",
  "claimsResolved": 0, "claimsSkipped": 0, "oldest": "2026-09-22T14:31:13Z" }
```

`profile.fullHistory` is true only when every source reported its last page, all seen claims were resolved, and (on Stellar) the account's own `create_account` is still within Horizon's retention. `FRESH_ACCOUNT` fires only on an observed creation time, never on the oldest record of a truncated window.

---

### 4.1 Partial data: never fail open

Each data source (Horizon account, payments, first operation; Blockscout address, transactions, internal transactions, token transfers) is settled on its own within the deadline.

- **Some sources answered:** the result is scored on what arrived, with `profile.dataStatus: "partial"`, `profile.window.missing` listing the sources that didn't answer, and an informational `CHAIN_DATA_PARTIAL` reason (0 points) that says to rescreen.
- **No source answered, but the subject has direct labels:** it is scored on the labels alone, with `dataStatus: "unavailable"`. A sanctions label still gives 100 / block. A slow chain API can never let a sanctioned address through.
- **No source answered and no labels:** `screenSubject` throws `ChainDataError` with `kind: "timeout" | "http" | "network" | "malformed"`. The API maps it to 502 `chain_unavailable`.

Timeouts race the request and the JSON body read, so a fetch that ignores its abort signal can't hang a screen past its deadline. The API's synchronous `/v1/screen` uses `deadlineMs: 8000, maxPages: 2`; the background monitor uses the defaults.

## 5. Labels and provenance

A label says what an address is: `{ chain, address, category, entity, source, sourceUrl?, confidence, addedAt, note? }`.

The rules:

1. **Every label names its source.** A label with no source is not loaded. The source, and the confidence as a percentage, appear in the reason detail, so an analyst can always answer "why did Hera say this?".
2. **Public record or first-party only.** Allowed sources are:
   - OFAC SDN and the UN, EU and UK lists
   - SEP-1 tomls that list the account back
   - issuer docs and on-chain issuer actions
   - published incident reports
   - Hera analyst work, with the method recorded.
3. **Matching is exact.** EVM addresses are compared case-insensitively. Stellar strkeys are compared case-sensitively. A muxed address is labeled through its base `G…`.
4. **Risk categories** have a severity of 40 or more and raise scores. The other categories (exchange, anchor, issuer, bridge, defi) inform and lower the baseline.

| Category | Severity | Risk? |
|---|---:|---|
| sanctions, terrorist_financing | 100 | yes |
| stolen_funds, ransomware | 90 | yes |
| darknet | 85 | yes |
| mixer | 75 | yes |
| scam | 70 | yes |
| high_risk_exchange | 50 | yes |
| gambling | 40 | yes |
| bridge, defi | 10 | no |
| exchange, anchor, issuer | 5 | no |

The **seed set** (`SEED_LABELS`) is five hand-verified labels:

- the Lazarus/Ronin OFAC address
- Tornado Cash Router (mixer; delisted by OFAC on 2025-03-21 but still a mixer)
- two exchange hot wallets
- Circle's Stellar USDC issuer.

In production the API replaces it with ingested lists (PLAN §5.1).

---

## 6. Reason codes

`points` is what the reason contributes before the formula in section 7 combines them. Informational reasons are 0 points.

| Code | Points | Severity | Fires when | Example detail |
|---|---:|---|---|---|
| `SANCTIONS_DIRECT` | 100 | critical | The subject itself carries a `sanctions` label. Forces score 100 and `block`. | "Lazarus Group (Ronin Bridge exploiter), listed on OFAC SDN list. Transactions with this address are prohibited." |
| `CATEGORY_DIRECT` | category severity (40–100) | high if ≥ 75, else medium | The subject carries another risk label. | "Tornado Cash: Router (source: Contract metadata (Hera analyst))." |
| `KNOWN_ENTITY` | 0 | info | The subject carries a non-risk label, or its home domain is verified. | "Attributed by Circle developer docs: USDC issuer addresses with 100% confidence." |
| `COUNTERPARTY_EXPOSURE` | `round(sev × (0.5 + 0.5·min(1, 5·share)) × 0.85)`, so 17 to 85 | critical ≥ 75, high ≥ 50, else medium | Successful first-hop transfers with a risk-labeled counterparty. One reason per category (formula in section 7). | "1 of 20 transfers (5%) involve Lazarus Group (Ronin Bridge exploiter)." |
| `EIP7702_DELEGATED` | 0, or `round(sev × 0.85)` if the delegate has a risk label | info, or by points | The EOA delegates its code under EIP-7702. | "A key-controlled wallet that delegates its code to 0x5A7F…6f6d. Treated as a wallet, not a contract." |
| `FRESH_ACCOUNT` | 15 | medium | Creation was *observed* less than 7 days before `now`. | "Created Sat, 17 Oct 2026 00:00:00 GMT. Fresh accounts are common in fraud and layering." |
| `HIGH_VELOCITY` | 10 | low | 50 or more successful transfers in the 24 h before `now`. | "190 transfers in the last 24 hours." |
| `RAPID_IN_OUT` | 15 | medium | At least 3 inflows, and at least 50% of them left again within 1 h in the same asset (code and issuer) at 90–100% of their value. Matched one-to-one, so one large withdrawal cannot explain many deposits. | "3 of 3 inbound transfers left again within an hour at 90% or more of their value." |
| `STRUCTURING` | 20 | high | 3 or more known-stablecoin transfers in [0.9·T, T) within 24 h, for T = $3,000 or $10,000. | "3 transfers just under $10,000 within 24 hours." |
| `SHARED_ACCOUNT_NO_SUBACCOUNT` | 5 | low | A Stellar base account that looks like an omnibus was screened without a sub-account (section 6.3). | "503 of 529 inbound payments (95%) carry a muxed ID or memo ID, across 221 distinct customers…" |
| `SUBACCOUNT_RESOLVED` | 0 | info | A muxed or memo subject was narrowed. | "Scored muxed ID 1790254030022811771 under GA5X…GKTM: 26 of 596 recent transfers belong to this customer." |
| `UNVERIFIED_HOME_DOMAIN` | 10 | medium | The home domain's toml was read but does not list the account (possible impersonation). An unreachable toml is not penalized. | "The account claims x.com, but that domain's stellar.toml doesn't list it…" |
| `CLAWBACK_ENABLED` | 0 | info | The account's issued assets can be clawed back. | "Assets issued by this account can be clawed back…" |
| `NO_HISTORY` | 0 | info | The account does not exist, or there are no successful non-self transfers in the window. Unknown is not clean. | "There is nothing recent to score against. Treat as unknown rather than clean." |
| `SMART_CONTRACT` | 0 | info | A deployed contract (not a 7702-delegated EOA). | "This is a contract, not a wallet. Check who controls it…" |
| `FAILED_RISKY_ATTEMPT` | 0 | info | A *failed* transfer involved a risk-labeled counterparty. It is not scored, but the attempt is surfaced for review. | "1 failed transfer involved Lazarus Group (sanctioned). Failed transactions move no value and are not scored…" |

### 6.1 What is excluded from scoring

The following are excluded from all scoring maths: exposure shares, counterparties, velocity, pass-through, structuring, the baseline and `NO_HISTORY`.

- **Failed transfers.** They are kept in `transfers` for display and counted in `stats.failed`.
- **Self-transfers.** For a muxed subject, a self-transfer means the same base account and the same id.
- **Dust.** It is dropped at ingest and counted in `stats.dustFiltered`.

### 6.2 Stats

- `stats.transfers` counts the subject's view, failed transfers included.
- `inbound + outbound = transfers`.
- `failed` counts the unsuccessful transfers in the view.
- `firstSeen` and `lastSeen` span the view.

### 6.3 The shared-account (omnibus) rule

Implemented in `stellar/omnibus.ts`. A base account is treated as an omnibus account when either of these holds:

- it is labeled `exchange` or `anchor`
- it is **not** labeled `issuer`, **and** all of the following are true:
  - at least **10** eligible inbound payments
  - at least **50%** of them carry a routing identifier
  - at least **5 distinct** routing identifiers.

An inbound payment is **eligible** when all of these are true:

- successful
- not dust
- a payment, path payment or claim
- from another account
- not the account's own asset coming back to it. That is a burn: Circle's issuer receives thousands of USDC redemptions, all with the text memo "internal".

A **routing identifier** is a muxed id, an id memo, or a text memo that looks like an identifier: it contains a digit, has no spaces, and is at most 28 bytes. Many users type their exchange deposit id into a text memo. Spam text memos are sentences ("Buy NXR & Earn Native XLM!"). Hash and return memos identify payments, not customers.

Why: before this rule, Circle's USDC issuer was flagged as a shared account because 99% of its inbound payments carried a memo. They were burns plus spam.

---

## 7. Scoring formula, bands and decisions

```
direct    = max points of SANCTIONS_DIRECT, CATEGORY_DIRECT                 (0 if none)
exposure  = max points of COUNTERPARTY_EXPOSURE, EIP7702_DELEGATED          (0 if none)
behavior  = min(30, Σ points of FRESH_ACCOUNT, HIGH_VELOCITY, RAPID_IN_OUT,
                     STRUCTURING, SHARED_ACCOUNT_NO_SUBACCOUNT, UNVERIFIED_HOME_DOMAIN)
baseline  = 2   if the subject has a non-risk label or a verified home domain
            10  else if there are no scored transfers
            5   otherwise

score     = 100 if SANCTIONS_DIRECT fired
            min(100, max(direct, exposure, behavior + baseline)) otherwise
```

**Exposure share.** For risk category *c* with severity *s(c)*:

```
share(c)  = (# scored transfers whose counterparty's highest risk severity ≥ s(c)) / (# scored transfers)
points(c) = round( s(c) × (0.5 + 0.5 × min(1, 5 × share(c))) × 0.85 )
```

- Any contact with a category is worth half its severity.
- Contact on 20% or more of activity is worth the full severity.
- The first-hop decay is 0.85.

The share is **cumulative**: contact with a sanctioned party also counts towards the share for mixers. This makes the score monotone, so adding a transfer with a sanctioned counterparty can never lower the score. The earlier per-category share broke this. For example, with 20 mixer transfers in 100, adding one sanctioned transfer diluted the mixer share and dropped the score from 64 to 63.

Exposure is weighted by **count** of transfers, not by value, because no price feed exists for most assets. PLAN §5.3 describes value weighting and multi-hop decay. Both are phase 2, and they will slot in behind the same reason codes.

| Band | Score | Decision |
|---|---|---|
| low | 0–24 | allow |
| medium | 25–49 | allow |
| high | 50–74 | review |
| severe | 75–100 | block |

A direct sanctions hit forces `block` whatever else is true.

---

## 8. Determinism and versioning

- `scoreSubject` is a pure function of its input and `now`.
- The subject's view is sorted newest first, with ties broken by id, before anything else is computed. The output therefore does not depend on the order transfers arrive in. This is property-tested by shuffling.
- `screenedAt` is `now`, and `engineVersion` is `ENGINE_VERSION`. Both are stored with every result.
- **Bump `ENGINE_VERSION` whenever the same input can produce a different score, band, decision or reason set.** The current version is `2026.10.2`, which adds partial-data scoring (§4.1) and the `CHAIN_DATA_PARTIAL` reason. Changes in `2026.10.1` from `2026.10.0`:
  - failed transfers and self-transfers excluded from scoring
  - cumulative-severity exposure
  - one-to-one pass-through matching
  - issuer-aware USD valuation
  - the omnibus rule above
  - inbound-only memo views
  - EIP-7702 handling
  - claimable-balance claims
  - per-asset dust.
- Fetched data is not deterministic: chains move and public APIs truncate. `profile.window` records what was read, so a stored result can be explained later.

---

## 9. Test strategy

Run with `pnpm --filter @hera/core test` (98 tests, about 5 s). Files run one at a time, so the benchmark measures the engine rather than CPU contention.

**Golden fixtures** (`src/golden.test.ts`, `src/__fixtures__/*.json`)

- Real Horizon and Blockscout responses for six subjects, recorded on 2026-10-18 by `scripts/record-fixtures.ts`:
  - Circle's USDC issuer
  - the Kraken Stellar omnibus, plus one muxed and one memo customer of it
  - an account that claims claimable balances
  - vitalik.eth (EIP-7702)
  - the OFAC-listed Lazarus address
  - an address with 100 reverted transactions.
- Responses are trimmed to the fields the adapters read (about 0.9 MB in total).
- They are served through an injected `fetch` with `now` fixed to the recording time. Any request that was not recorded fails the test.
- Scores, reason codes and details, stats and the data window are snapshotted. The key outcomes also have explicit assertions:
  - no shared-account flag on the issuer
  - a delegated wallet, not a contract
  - failures not scored, and they *would* have fired `HIGH_VELOCITY` if they were
  - claims resolved into transfers
  - the paging budget respected.
- To refresh: `pnpm --filter @hera/core build && node packages/core/scripts/record-fixtures.ts`, then review the snapshot diff and run `vitest -u` deliberately.

**Property tests** (`src/properties.test.ts`, fast-check)

- strkey `G…` and `M…` round-trips for random keys and any uint64 id
- any single-character substitution in a valid `G…` or `M…` is rejected
- `parseSubject` never throws on arbitrary strings
- `formatUnits` agrees with BigInt arithmetic, both ways
- risk invariants:
  - the score is in [0, 100] and the band follows from it
  - a sanctioned subject always scores 100 and is blocked
  - adding a sanctioned-counterparty transfer never lowers the score
  - failed transfers never change the score
  - the same input gives the same output, under any permutation
  - muxed and memo views are subsets of the base view.

**Unit tests** cover:

- memo encodings (hash and return, base64 and hex)
- path-payment source assets, muxed fields on all operations, and claim normalization
- dust thresholds and the omnibus rule
- Blockscout failure flags and `delegatecall` skipping
- both 7702 signals
- paging budget, deadline and error handling, and one retry
- regression cases for each rule.

**Performance** (`src/perf.test.ts`): `scoreSubject` over 10,000 adversarial synthetic transfers must finish in under 100 ms. The measured median is 26 to 29 ms on an Apple-silicon laptop.

**Live smoke** (`scripts/smoke.ts`): `node packages/core/scripts/smoke.ts` (Node 22.18 or later, or add `--experimental-strip-types`). It screens the fixture subjects live through the built package and prints score, band, decision, reasons, data window and latency.

---

## 10. Limitations

Read these before relying on a score.

- **First hop only.** Exposure counts direct counterparties. Funds that passed through one intermediary before reaching the subject are invisible. Multi-hop exposure is phase 2.
- **Recent window only.**
  - A Stellar screen reads at most 600 payments and one page of effects.
  - An EVM screen reads at most 100 transactions, 100 internal transactions and 100 token transfers.
  - On busy accounts that is hours to days of history (about 3 days for Kraken, about 4 weeks for Circle's issuer).
  - Older exposure is not seen. `profile.window.truncatedBy` and `fullHistory: false` say so on every such result.
- **Horizon retention.** Public Horizon does not keep all history. Creation dates are reported only when the `create_account` is still retained, and older claimable balances cannot be resolved (they count in `claimsSkipped`).
- **Claimable balances.** Up to 10 per screen, from the newest page of effects. A busy account's effects page can cover less time than its payments.
- **Account merges** appear with amount 0, because Horizon's payments feed does not include the merged balance.
- **Blockscout is a phase-1 source.**
  - It is a third-party public instance with uneven latency, and sometimes pages do not return.
  - Token-transfer events are only as honest as the token contract. A spam contract can emit a `Transfer` "from" any address, including a sanctioned one. Zero-value transfers are dropped, but forged non-zero events from unknown tokens are still counted.
  - Phase 2 moves to Hera's own nodes and traces (PLAN §4).
- **Exposure is weighted by count, not value.** Only known stablecoins have a USD value, which the structuring rule uses.
- **Behavior rules on omnibus accounts.** On a shared exchange account, velocity reflects the whole customer base. Screen the sub-account for a customer-level view.
- **The seed label set is five labels.** Until the API loads ingested lists (OFAC SDN and the others), only those addresses carry labels. A clean score against the seed set means "nothing Hera knows about", not "clean".
- **No clustering yet** (phase 3). A new address controlled by a sanctioned actor scores as an unknown wallet until it is labeled or touches a labeled one.
