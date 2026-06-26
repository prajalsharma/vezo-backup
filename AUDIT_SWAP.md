# Cross-Currency Swap — Security Audit Report

Audited with the [pashov/skills `solidity-auditor`](https://github.com/pashov/skills)
methodology (economic-security, execution-trace, trust-gap, oracle passes) over the
swap stack, cross-checked against live mainnet state.

**Scope:** `SwapRouter`, `QuoteRouter`, `PriceOracleHub` (the deployed stack),
`SwapPaymentRouter` (in repo, not deployed), and the frontend swap surface.

---

## TL;DR — the swap feature does not work, and the UI says it does

The deployed swap stack is **non-functional at every layer**, the frontend **never
calls it**, yet `BuyModal` shows a note telling users they can pay in any token. On top
of being bricked, the deployed `SwapRouter` has a **critical design flaw** that must
never reach a funded/live state.

### Live mainnet state (confirmed via `cast`)

| Check | Value | Meaning |
|---|---|---|
| `SwapRouter.dexAdapter()` | `0x0` | no DEX — cross-token conversion is a stub |
| `SwapRouter.paymentRouter()` | `0xA409…` | the marketplace's router (auth mismatch ↓) |
| `SwapRouter.authorisedCallers(marketplace)` | `true` | marketplace *may* enter SwapRouter… |
| `QuoteRouter.tokenSymbol(MUSD)` | `0x0` | no tokens registered → `getQuote` reverts |
| `Oracle.getRegisteredSymbols()` | `[]` | no price feeds → `getPrice` reverts |
| Frontend `executeSwap`/`getQuote`/`swapAndBuy` | none | swap is never called from the app |

---

## Findings

### S-1 · Critical · `SwapRouter.executeSwap` trusts a fully attacker-supplied quote
`executeSwap` takes `quote` as **calldata** and consumes it verbatim — it only checks
`expiry` and `maxPaymentAmount`, and **never** re-derives the quote from `QuoteRouter`
or the oracle (the `immutable quoteRouter` is set in the constructor and never read).
Because settlement (`routePayment`) moves `settToken` **out of SwapRouter's own
balance**, an authorized caller can submit
`{paymentAmount: 1 wei, settlementAmount: <SwapRouter balance>, swapFeeAmount: 0}` and
drain whatever the router holds. `quote.valid` is never checked either.
**Mitigating reality:** SwapRouter currently holds ~0 tokens and nothing calls
`executeSwap`, so this is a latent design flaw, not live theft — but it must be fixed
before the contract ever holds value.
**Fix:** recompute on-chain — `q = quoteRouter.getQuote(settToken, settAmt, payToken)` —
and require `q.paymentAmount == quote.paymentAmount && q.settlementAmount ==
quote.settlementAmount`; or build the quote internally from `(settlementToken,
settlementAmount, paymentToken)` and never accept amounts from the caller.

### S-2 · Critical (DoS) · `executeSwap` settlement reverts — same `routePayment` auth bug as bidding
`executeSwap` settles via `paymentRouter.routePayment(address(this), seller, …)`, but
`routePayment` is `onlyMarketplace` and `PaymentRouter.marketplace` is bound **one-time**
to `VeNFTMarketplace` (deploy script `setMarketplace(marketplaceAddress)`). So
`msg.sender == SwapRouter != marketplace` → **every swap reverts `Unauthorized`**. This
is the *identical* failure `VeNFTBidding` documents engineering around; `SwapRouter`
repeats it. The deployed cross-currency entrypoint is 100% bricked.
**Fix:** settle the fee split directly (read `calculateFee`/`feeRecipient`, `safeTransfer`
to seller + treasury) exactly like the patched `VeNFTBidding.acceptBid` — do not reuse
the one-time marketplace slot.

### S-3 · High (DoS / latent leak) · phantom settlement token in the stub path
With `dexAdapter == 0` and `payToken != settToken`, the stub sets
`receivedSettlementAmount = settAmt` **without any swap**, then routes `settToken` the
contract never received. It holds only `payToken`, so `routePayment`'s
`safeTransferFrom(address(this), seller, …)` of `settToken` reverts. Worse: if SwapRouter
is ever pre-funded with `settToken`, it would pay sellers from those reserves at a
fabricated 1:1 rate while keeping `payAmt − feeAmt` of `payToken` — a reserve leak.
**Fix:** in the no-adapter branch with `payToken != settToken`, `revert SwapFailed()`;
only settle `settToken` actually received from a real swap.

### S-4 · High (latent) · `QuoteRouter.getQuote` assumes every token is 18-decimals
`rawPayAmount = settlementAmount * settPriceUsd / payPriceUsd` does no `decimals()`
scaling. Latent today (BTC/MEZO/MUSD are all 18-dec on Mezo) but a 6/8-dec token would
be mispriced by orders of magnitude (e.g. an 8-dec BTC settlement quotes a $60k BTC at
~$0.000006). Rounding itself is fine (truncates ≤1 wei in the buyer's favour); decimals
are the defect.
**Fix:** normalize by token decimals: `rawPay = settAmt * 10**payDec * settPrice /
(10**settDec * payPrice)`; store/validate `decimals` at `registerToken`.

### S-5 · Medium · `QuoteRouter.registerToken` doesn't validate the symbol against the oracle
`tokenSymbol[token] = symbol` accepts any `bytes32` with no `oracle.hasFeed(symbol)`
check. Owner-only, so admin-trust — but a wrong mapping (`MUSD → "BTC"`) misprices by
~5 orders of magnitude, and a feedless symbol DoSes quotes for that token.
**Fix:** require `oracle.hasFeed(symbol)` in `registerToken`; consider cross-checking the
token's on-chain `symbol()`.

### S-6 · Low · oracle staleness window of `0` disables the heartbeat
`PriceOracleHub.getPrice` is otherwise sound — it reverts on zero price and on stale
prices (so QuoteRouter can never div-by-zero). But `registerFeed`/`updateFeed` accept
`staleness == 0` ("no check"), which lets a feed (e.g. an unmaintained `MockPriceAdapter`)
serve indefinitely-old prices. **Fix:** forbid `staleness == 0` (or enforce a max) for
production feeds.

### S-7 · High (UX / trust) · the frontend advertises a swap that doesn't exist
`BuyModal`'s `SwapNote` tells buyers *"the on-chain swap router lets you pay with any
token … it swaps automatically and clips a 1.5% swap fee."* No swap is wired anywhere in
the app, and the deployed stack can't execute one. The quoted **1.5%** also contradicts
`QuoteRouter.swapFeeBps = 50` (0.5%). **Fix:** remove the note (or gate it behind a real,
working swap path).

---

## `SwapPaymentRouter` (in repo, NOT deployed — the better design)

Unlike `SwapRouter`, this routes through `marketplace.buyNFT()` (so it avoids the
`routePayment` auth wall) and uses a real Uniswap-V2 router. If swaps are to be enabled,
this is the path to build on — after fixing:

- **S-8 · Medium · native overpay stuck.** For `buyToken == BTC`, `msg.value − maxAmountIn`
  is never refunded and there's no BTC sweep → silent user loss. Refund the remainder.
- **S-9 · Low · misleading slippage floor.** `_swap` allows `amountOutMin < required`
  (when `maxSlippageBps > 0`), so a swap can succeed yet always revert at settlement
  (needs `required`). Use `floor = required`.
- **S-10 · Low · full-balance refund.** Surplus refund sends
  `balanceOf(this)` rather than `actualOut − required`, sweeping any residual/donated
  quoteToken to the next caller. Use a balance delta.

---

## What's sound
- `PriceOracleHub.getPrice` validates zero + staleness (no div-by-zero reaches callers).
- CEI / atomicity holds across `SwapRouter` — the bricked paths revert cleanly with **no
  fund loss or stranded dust**.
- `SwapPaymentRouter` correctly settles via `buyNFT`, sidestepping the auth bug.

## Recommendation
The deployed swap stack is bricked and unconfigured (no feeds, no symbols, no adapter)
and the UI oversells it. Two coherent directions:
1. **Disable & stop advertising (low effort, ship now):** remove the `SwapNote`; mark the
   swap contracts experimental/undeployed in docs. The marketplace already supports BTC /
   MEZO / MUSD listings directly.
2. **Enable real swaps (feature build):** build on `SwapPaymentRouter` (fix S-8…S-10),
   register oracle feeds + token symbols, deploy a DEX adapter, and either retire
   `SwapRouter` or rebuild it with on-chain quote validation (S-1) and direct fee
   settlement (S-2/S-3). Only then is the `SwapNote` truthful.

---

## Update — direction chosen: enable real swaps

The chosen path is **`SwapPaymentRouter`** as the live swap entrypoint: a buyer calls
`swapAndBuy()`, it swaps their token → the listing currency via a Uniswap-V2 DEX, then
calls the **existing** marketplace's `buyNFT()` and forwards the NFT. This works with the
already-deployed marketplace (no marketplace redeploy, no `routePayment` auth wiring) and
matches the UI's "pay with any token" promise.

### Done in code (verified — `npx hardhat test`, 46 passing)
- **`SwapPaymentRouter`** — fixed S-8 (refund unspent native BTC), S-9 (slippage floor =
  `required`), S-10 (refund `actualOut − required`, not full balance).
- **`SwapRouter`** — hardened anyway for safety: S-1 (re-derive quote from `QuoteRouter`
  on-chain; reject forged quotes), S-2 (settle the fee split directly via
  `calculateFee`/`feeRecipient` instead of the un-authorized `routePayment`), S-3 (revert
  when no DEX adapter instead of phantom-settling). *Note:* `SwapRouter` remains
  architecturally stranded (nothing calls `executeSwap`); `SwapPaymentRouter` is the
  recommended path.
- **Tests** — `test/Swap.test.ts` + `contracts/mocks/MockDex.sol` (mock DEX adapter +
  mock Uniswap-V2 router): valid settlement, forged-quote rejection, no-adapter revert,
  full swap-and-buy with fee split + surplus refund, and the slippage-floor guard.
- **Frontend** — `useSwapAndBuy` hook (approve + `swapAndBuy`), `contracts.swapPaymentRouter`
  config (env `NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_*`, default zero), and the `SwapNote` is now
  **gated on deployment** + no longer states a wrong fee (S-7 fixed — it stays hidden until
  the router is deployed).
- **Deploy script** — `deploy-v2-modules.ts` now deploys `SwapPaymentRouter` and configures
  its DEX router from `DEX_ROUTER`/`WBTC` env, and prints the address + verify command.

---

## Update 2 — real DEX found and wired (Velodrome v2 on Mezo)

The "needs a DEX" dependency is **resolved**: Mezo's on-chain DEX is a **Velodrome-v2
fork** (the same vote-escrow system whose veNFTs this marketplace trades), and it already
has a **liquid BTC/MUSD pool**. No API key, no off-chain service, no cost to you — swaps
are 100% on-chain and the buyer pays gas.

**Confirmed on-chain (Mezo mainnet):**
- Velodrome **PoolFactory** = `0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248` (30 pools)
- **vAMM-BTC/MUSD** pool = `0x52e604c44417233b6CcEDDDc0d640A405Caacefb`, reserves
  ≈ **1.27 BTC / 76,457 MUSD** (~$76k/side); `getAmountOut(0.01 BTC)` ≈ 597 MUSD (BTC ≈ $59.7k).
- **BTC at `0x7b7C…0000` is a real ERC-20** (decimals 18, `balanceOf`/`transfer` work), so
  swaps treat it as a normal token.
- **No MEZO pool exists** (`getPool(MEZO, *) = 0x0`) → MEZO positions **cannot** be swapped.

**`SwapPaymentRouter` was rewritten to swap pool-direct against Velodrome** (`factory.getPool`
→ `pool.getAmountOut` → `pool.swap`) — no router, no Uniswap-V2. It pulls the buyer's token,
swaps to the listing's ERC-20 quote token, calls the existing `buyNFT`, forwards the NFT,
and refunds surplus. Tested with a mock Velodrome pool+factory (`MockDex.sol`).

**Scope of the working swap:** the listing's quote token must be ERC-20 (MUSD); the pay
token must have a Velodrome pool to it (BTC, mUSDC, mUSDT). The headline case — **pay BTC
for a MUSD-priced listing** — works. MEZO-priced listings and BTC-quoted (native-settled)
listings are not swap-eligible.

### Remaining (your action — no infra/keys needed, the DEX already exists)
1. **Deploy `SwapPaymentRouter`:** `npx hardhat run scripts/deploy-v2-modules.ts --network
   mezomainnet` — it auto-uses the mainnet PoolFactory above (override with `POOL_FACTORY`).
2. **Set `NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_MAINNET`** to the deployed address — the gated UI
   then activates (`NEXT_PUBLIC_POOL_FACTORY_MAINNET` already defaults to the real factory).
3. **Final BuyModal wiring:** add a pay-token picker that calls `useSwapAndBuy` — use
   `quoteSwap()` (reads the live pool rate) to derive `maxAmountIn`/`amountOutMin` with a
   slippage buffer. The hook is ready; this UI step is best verified in a browser against
   the live pool.
4. **Recommended before mainnet:** a forked-mainnet integration test against the real
   BTC/MUSD pool (the unit tests use a 1:1 mock; a fork test confirms real-liquidity math
   and the BTC-as-ERC-20 transfer path).
