/**
 * computeDiscount.ts
 *
 * Single canonical source for all discount calculations in the veNFT marketplace.
 *
 * ── Design goals ──────────────────────────────────────────────────────────────
 * 1. CONSERVATIVE — we only render discount percentages when we can compute
 *    them reliably without a trusted oracle. Cross-token listings (for example
 *    a veMEZO position priced in MUSD) should not show a guessed % based on
 *    stale reference prices because that can materially mislead users.
 *
 * 2. SINGLE SOURCE — all callers (useListing, useActivityFeed, BuyModal…) import
 *    from this file so there can never be a rounding or formula divergence.
 *
 * ── Formula ───────────────────────────────────────────────────────────────────
 *   discountBps = (intrinsicValue − listingPrice) / intrinsicValue × 10 000
 *
 * Positive bps = discount (buyer pays less than intrinsic).
 * Negative bps = premium (buyer pays more than intrinsic).
 */

// ── Token address constants ───────────────────────────────────────────────────
const BTC_ADDR  = "0x7b7c000000000000000000000000000000000000";
const MEZO_ADDR = "0x7b7c000000000000000000000000000000000001";

/**
 * Discounts are only safe to display when the listing currency matches the
 * locked asset denomination. Without a real oracle, cross-token discounts can
 * be wildly inaccurate and should render as "unknown" in the UI.
 */
export function canComputeDiscount(
  nftLockedToken: string,
  paymentToken: string,
): boolean {
  return nftLockedToken.toLowerCase() === paymentToken.toLowerCase();
}

/**
 * Compute discount in basis points (bps) when both values are denominated in
 * the same underlying token. Returns null when the comparison would require an
 * external price oracle.
 *
 * @param intrinsicValue    Raw 18-decimal wei amount locked in the veNFT
 * @param nftLockedToken    Address of the token locked (BTC or MEZO)
 * @param listingPrice      Raw 18-decimal wei listing price
 * @param paymentToken      Address of the payment token (BTC, MEZO, or MUSD)
 * @returns                 Discount in bps (bigint) or null if not safely computable.
 */
export function computeDiscountBps(
  intrinsicValue: bigint,
  nftLockedToken: string,
  listingPrice: bigint,
  paymentToken: string,
): bigint | null {
  if (intrinsicValue === 0n) return null;
  if (!canComputeDiscount(nftLockedToken, paymentToken)) return null;
  return ((intrinsicValue - listingPrice) * 10_000n) / intrinsicValue;
}

/**
 * Number (float) variant — useful in contexts where bigint is inconvenient
 * (e.g. activity feed, chart data).
 *
 * @returns Discount in bps as a number. Null if intrinsic is 0 or if the
 *          comparison is not safely computable.
 */
export function computeDiscountBpsNumber(
  intrinsicValue: bigint,
  nftLockedToken: string,
  listingPrice: bigint,
  paymentToken: string,
): number | null {
  if (intrinsicValue === 0n) return null;
  if (!canComputeDiscount(nftLockedToken, paymentToken)) return null;
  return Math.round((Number(intrinsicValue - listingPrice) / Number(intrinsicValue)) * 10_000);
}
