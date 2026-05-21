"use client";

/*
  Taste-skill rules applied:
  ✓ mezo-* tokens → CSS custom properties (var(--bg), var(--text-*), var(--border))
  ✓ Liquid glass modal: backdrop-blur + inner border shadow
  ✓ tabular-nums on all price values
  ✓ Spring stiffness:100, damping:20
  ✓ Animate only transform + opacity (GPU rule)
  ✓ Vezo red (#FF0040) as the primary accent
  ✓ Status steps use matching tinted colors
*/

import { useState, useEffect, useMemo } from "react";
import { formatEther, maxUint256 } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Wallet, ArrowLeftRight, Info } from "lucide-react";
import { useMarketplace, Listing } from "@/hooks/useMarketplace";
import { useNetwork } from "@/hooks/useNetwork";
import { useReadContract, useWaitForTransactionReceipt, useAccount, useBalance, useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { usePriceTicker, formatUSD } from "@/hooks/usePriceTicker";

// ─── ABIs ─────────────────────────────────────────────────────────────────────

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const ERC721_ABI = [
  {
    name: "getApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// ─── Constants ─────────────────────────────────────────────────────────────────
const BTC_ADDRESS = "0x7b7c000000000000000000000000000000000000";

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing | null;
  onSuccess?: (listing: Listing) => void;
}

type BuyStep = "confirm" | "approving" | "buying" | "done" | "error";

// ─── Error parser ──────────────────────────────────────────────────────────────
function parseError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected"))
    return "You rejected the transaction in your wallet.";
  if (msg.includes("selfpurchase")) return "You cannot buy your own listing.";
  if (msg.includes("listingnotactive"))
    return "This listing is no longer active — it may have been sold or cancelled.";
  if (msg.includes("expiredvenft"))
    return "This veNFT's lock has expired and cannot be traded.";
  if (msg.includes("notowner"))
    return "The seller no longer owns this NFT — the listing is stale.";
  if (
    msg.includes("notapproved") ||
    msg.includes("not approved") ||
    msg.includes("erc721insufficientapproval") ||
    msg.includes("caller is not token owner or approved")
  )
    return "The seller has not approved the marketplace. The listing is stale — seller needs to re-list.";
  if (msg.includes("insufficientpayment")) return "Insufficient payment sent. Please try again.";
  if (msg.includes("invalidamount") || msg.includes("invalid amount"))
    return "Payment amount mismatch. Please try again.";
  if (msg.includes("transferfailed") || msg.includes("transfer failed"))
    return "Token transfer failed. Check your allowance and balance.";
  if (msg.includes("paused"))
    return "The marketplace is currently paused. Please try again later.";
  if (msg.includes("unauthorized")) return "Unauthorized contract call. Please contact support.";
  if (msg.includes("unsupportedtoken"))
    return "This payment token is not supported by the marketplace.";
  if (msg.includes("allowance") || msg.includes("erc20insufficientallowance"))
    return "Insufficient token allowance. Please approve the router and try again.";
  if (msg.includes("erc20insufficientbalance") || msg.includes("insufficient balance"))
    return "Insufficient token balance to complete this purchase.";
  if (msg.includes("insufficient funds"))
    return "Your wallet doesn't have enough balance to pay for this NFT.";
  if (msg.includes("network") || msg.includes("rpc") || msg.includes("fetch"))
    return "Network error — please check your connection and try again.";
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}

// ─── Step pill ─────────────────────────────────────────────────────────────────
function StepPill({
  label,
  state,
}: {
  label: string;
  state: "idle" | "active" | "done";
}) {
  const colors = {
    idle: { bg: "var(--bg-2)", border: "var(--border)", color: "var(--text-3)" },
    active: { bg: "rgba(255,0,64,0.1)", border: "rgba(255,0,64,0.24)", color: "#FF0040" },
    done: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.22)", color: "#10B981" },
  }[state];

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.color }}
    >
      {state === "done" ? (
        <CheckCircle2 style={{ width: 11, height: 11 }} />
      ) : state === "active" ? (
        <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
      ) : (
        <span
          className="w-3 h-3 rounded-full border flex items-center justify-center text-[8px] font-black"
          style={{ borderColor: "currentColor" }}
        >
          {label.startsWith("1") ? "1" : "2"}
        </span>
      )}
      {label}
    </div>
  );
}

// ─── Alert block ───────────────────────────────────────────────────────────────
function AlertBlock({
  icon: Icon,
  title,
  body,
  variant,
}: {
  icon: any;
  title: string;
  body: string;
  variant: "red" | "yellow" | "green" | "blue";
}) {
  const palette = {
    red: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", color: "#EF4444" },
    yellow: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", color: "#F59E0B" },
    green: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", color: "#10B981" },
    blue: { bg: "rgba(255,0,64,0.06)", border: "rgba(255,0,64,0.16)", color: "#FF0040" },
  }[variant];

  return (
    <div
      className="flex gap-3 p-4 rounded-xl"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
    >
      <Icon style={{ width: 16, height: 16, color: palette.color, flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className="text-xs font-semibold mb-0.5" style={{ color: palette.color }}>
          {title}
        </p>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// ─── Cross-currency context block ──────────────────────────────────────────────
// When a buyer holds a different token than what the listing requires, show them
// the USD-equivalent context and a note about using the swap router.
function CrossCurrencyNote({
  paySymbol,
  intrinsicValue,
  listingPrice,
  prices,
}: {
  paySymbol: string;
  intrinsicValue: bigint;
  listingPrice: bigint;
  prices: ReturnType<typeof usePriceTicker>;
}) {
  // Map symbol → USD price
  const unitPrice: number | null =
    paySymbol === "BTC"  ? prices.BTC  :
    paySymbol === "MEZO" ? prices.MEZO :
    paySymbol === "MUSD" ? prices.MUSD :
    null;

  const priceEth = parseFloat(formatEther(listingPrice));
  const ivEth    = parseFloat(formatEther(intrinsicValue));

  const priceUSD = unitPrice !== null ? unitPrice * priceEth : null;
  const ivUSD    = unitPrice !== null ? unitPrice * ivEth    : null;

  // Only show this block if we have USD data
  if (!priceUSD) return null;

  const discountUSD = ivUSD ? ((ivUSD - priceUSD) / ivUSD * 100) : null;

  return (
    <div
      className="p-4 rounded-xl space-y-2"
      style={{ background: "rgba(74,144,226,0.06)", border: "1px solid rgba(74,144,226,0.18)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Info style={{ width: 13, height: 13, color: "#4A90E2", flexShrink: 0 }} />
        <p className="text-[11px] font-bold" style={{ color: "#4A90E2" }}>USD Context</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-[10px]" style={{ color: "var(--text-3)" }}>You pay</span>
        <span className="text-[10px] font-bold tabular-nums text-right" style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
          {formatUSD(priceUSD)}
        </span>
        {ivUSD !== null && (
          <>
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Intrinsic value</span>
            <span className="text-[10px] font-bold tabular-nums text-right" style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
              {formatUSD(ivUSD)}
            </span>
          </>
        )}
        {discountUSD !== null && discountUSD > 0 && (
          <>
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>Implied discount</span>
            <span className="text-[10px] font-bold tabular-nums text-right" style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
              {discountUSD.toFixed(1)}% off
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Swap info block ─────────────────────────────────────────────────────────
// Informs buyer they can use any token — the on-chain swap router handles it.
function SwapNote({ paySymbol }: { paySymbol: string }) {
  const otherTokens = ["BTC", "MEZO", "MUSD"].filter((t) => t !== paySymbol);
  return (
    <div
      className="p-4 rounded-xl"
      style={{ background: "rgba(255,0,64,0.05)", border: "1px solid rgba(255,0,64,0.14)" }}
    >
      <div className="flex items-start gap-2.5">
        <ArrowLeftRight style={{ width: 13, height: 13, color: "#FF0040", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="text-[11px] font-bold mb-0.5" style={{ color: "#FF0040" }}>
            Don&apos;t have {paySymbol}?
          </p>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-3)" }}>
            The on-chain swap router lets you pay with{" "}
            <span style={{ color: "var(--text-2)", fontWeight: 600 }}>
              {otherTokens.join(" or ")}
            </span>{" "}
            — it swaps automatically and clips a small routing fee. A{" "}
            <span style={{ color: "var(--text-2)", fontWeight: 600 }}>1.5% swap fee</span> is added
            on top of the listed price when using a different currency.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function BuyModal({ isOpen, onClose, listing, onSuccess }: BuyModalProps) {
  const { contracts } = useNetwork();
  const { address: buyerAddress } = useAccount();
  const wagmiConfig = useConfig();
  const { buyListing, approveTokenForBuy, executeBuy, isPending, isConfirming } = useMarketplace();
  const prices = usePriceTicker();

  const waitForApproval = (hash: `0x${string}`) =>
    waitForTransactionReceipt(wagmiConfig, { hash });

  const [step, setStep] = useState<BuyStep>("confirm");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionHash, setSessionHash] = useState<`0x${string}` | undefined>(undefined);
  const [phase, setPhase] = useState<"approve" | "buy">("approve");

  const { isSuccess: txConfirmed, isError: txFailed, error: txError } =
    useWaitForTransactionReceipt({ hash: sessionHash });

  const paymentLower = listing?.paymentToken.toLowerCase() ?? "";
  const isNative = paymentLower === BTC_ADDRESS.toLowerCase();
  const routerAddress = contracts.router as `0x${string}`;
  const isRouterReady =
    !!routerAddress && routerAddress !== "0x0000000000000000000000000000000000000000";

  const { data: nativeBalance } = useBalance({
    address: buyerAddress,
    query: { enabled: isNative && !!buyerAddress },
  });

  const { data: erc20Balance } = useReadContract({
    address: listing?.paymentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: buyerAddress ? [buyerAddress] : undefined,
    query: { enabled: !isNative && !!listing && !!buyerAddress },
  });

  const { data: nftApproved } = useReadContract({
    address: listing?.nftContract as `0x${string}`,
    abi: ERC721_ABI,
    functionName: "getApproved",
    args: listing?.tokenId !== undefined ? [listing.tokenId] : undefined,
    query: { enabled: !!listing },
  });

  const { data: nftApprovedForAll } = useReadContract({
    address: listing?.nftContract as `0x${string}`,
    abi: ERC721_ABI,
    functionName: "isApprovedForAll",
    args:
      listing?.seller && listing?.nftContract
        ? [listing.seller as `0x${string}`, contracts.marketplace as `0x${string}`]
        : undefined,
    query: { enabled: !!listing },
  });

  const isNftApproved =
    listing == null ||
    (nftApproved as string | undefined)?.toLowerCase() === contracts.marketplace.toLowerCase() ||
    nftApprovedForAll === true;

  const { data: currentAllowance } = useReadContract({
    address: listing?.paymentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: buyerAddress && routerAddress ? [buyerAddress, routerAddress] : undefined,
    query: { enabled: !isNative && !!listing && !!buyerAddress && isRouterReady },
  });

  const alreadyApproved =
    !isNative &&
    listing != null &&
    currentAllowance != null &&
    (currentAllowance as bigint) >= listing.price;

  const hasEnoughBalance = (() => {
    if (!listing) return true;
    if (isNative) {
      if (!nativeBalance) return true;
      return nativeBalance.value >= listing.price;
    } else {
      if (!erc20Balance) return true;
      return (erc20Balance as bigint) >= listing.price;
    }
  })();

  const paymentSymbol = listing
    ? (() => {
        const lower = listing.paymentToken.toLowerCase();
        if (lower === "0x7b7c000000000000000000000000000000000000") return "BTC";
        if (lower === "0x7b7c000000000000000000000000000000000001") return "MEZO";
        return "MUSD";
      })()
    : "";

  const formattedPrice = listing
    ? parseFloat(formatEther(listing.price)).toFixed(6)
    : "0";

  useEffect(() => {
    if (txConfirmed && step === "buying") {
      setStep("done");
      if (listing) onSuccess?.(listing);
    }
  }, [txConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (txFailed && (step === "approving" || step === "buying")) {
      const msg = txError?.message ?? "Transaction reverted on-chain.";
      setErrorMsg(parseError(msg));
      setStep("error");
    }
  }, [txFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) {
      setStep("confirm");
      setPhase("approve");
      setErrorMsg(null);
      setSessionHash(undefined);
    }
  }, [isOpen]);

  function handleClose() {
    setStep("confirm");
    setPhase("approve");
    setErrorMsg(null);
    setSessionHash(undefined);
    onClose();
  }

  async function handleBuy() {
    if (!listing) return;
    setErrorMsg(null);

    if (!hasEnoughBalance) {
      setErrorMsg(`Insufficient ${paymentSymbol} balance. You need ${formattedPrice} ${paymentSymbol}.`);
      setStep("error");
      return;
    }

    if (!isNftApproved) {
      setErrorMsg("The seller has not approved the marketplace. Listing is stale — seller needs to re-approve or re-list.");
      setStep("error");
      return;
    }

    try {
      if (isNative) {
        setPhase("buy");
        setStep("buying");
        const h = await buyListing(listing.listingId, listing.price, true);
        setSessionHash(h);
      } else if (alreadyApproved) {
        setPhase("buy");
        setStep("buying");
        const h = await executeBuy(listing.listingId);
        setSessionHash(h);
      } else {
        setPhase("approve");
        setStep("approving");
        const approveHash = await approveTokenForBuy(listing.paymentToken, maxUint256);
        setSessionHash(approveHash);
        await waitForApproval(approveHash);
        setPhase("buy");
        setStep("buying");
        setSessionHash(undefined);
        const buyHash = await executeBuy(listing.listingId);
        setSessionHash(buyHash);
      }
    } catch (err: unknown) {
      setErrorMsg(parseError(err instanceof Error ? err.message : String(err)));
      setStep("error");
    }
  }

  if (!listing) return null;

  const isBusy = step === "approving" || step === "buying";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px) saturate(180%)" }}
            onClick={step === "done" || step === "confirm" || step === "error" ? handleClose : undefined}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: 2, background: "linear-gradient(90deg, #FF0040, #FF004044)" }} />

            {/* Header */}
            <div
              className="flex items-start justify-between px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div>
                <h2 className="text-base font-semibold" style={{ letterSpacing: "-0.02em" }}>
                  Buy {listing.collection}{" "}
                  <span
                    className="tabular-nums"
                    style={{ fontVariantNumeric: "tabular-nums", color: "#FF0040" }}
                  >
                    #{listing.tokenId.toString()}
                  </span>
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                  {isNative
                    ? "Single transaction — pay and receive NFT atomically."
                    : alreadyApproved
                    ? "Allowance ready — one transaction to purchase."
                    : "Two steps: approve token spend, then purchase."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
              >
                <X style={{ width: 17, height: 17 }} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Price summary */}
              <div
                className="p-4 rounded-xl space-y-2.5"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}
              >
                {[
                  {
                    label: "You pay",
                    value: (
                      <span
                        className="tabular-nums font-bold"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formattedPrice}{" "}
                        <span className="text-[10px] font-semibold" style={{ color: "var(--text-3)" }}>
                          {paymentSymbol}
                        </span>
                      </span>
                    ),
                    color: "var(--text-1)",
                  },
                  {
                    label: "Discount",
                    value: (
                      <span
                        className="tabular-nums font-bold"
                        style={{ fontVariantNumeric: "tabular-nums", color: "#10B981" }}
                      >
                        {listing.discountBps === null
                          ? "—"
                          : `${(Number(listing.discountBps) / 100).toFixed(1)}%`}
                      </span>
                    ),
                    color: "#10B981",
                  },
                  {
                    label: "Protocol fee",
                    value: <span className="tabular-nums font-semibold" style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-3)" }}>1%</span>,
                    color: "var(--text-3)",
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-xs">
                    <span style={{ color: "var(--text-3)" }}>{label}</span>
                    {value}
                  </div>
                ))}
              </div>

              {/* USD context + swap note */}
              {listing && step === "confirm" && (
                <>
                  <CrossCurrencyNote
                    paySymbol={paymentSymbol}
                    intrinsicValue={listing.intrinsicValue}
                    listingPrice={listing.price}
                    prices={prices}
                  />
                  <SwapNote paySymbol={paymentSymbol} />
                </>
              )}

              {/* Warnings */}
              <AnimatePresence>
                {!isNftApproved && step === "confirm" && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AlertBlock
                      icon={AlertCircle}
                      variant="red"
                      title="Listing no longer valid"
                      body="The seller's NFT approval has been revoked. This purchase will fail until the seller re-approves or re-lists."
                    />
                  </motion.div>
                )}

                {!hasEnoughBalance && step === "confirm" && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <AlertBlock
                      icon={Wallet}
                      variant="yellow"
                      title="Insufficient balance"
                      body={`You need ${formattedPrice} ${paymentSymbol}. Add funds to your wallet before buying.`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step indicators for 2-step ERC-20 flow */}
              {!isNative && !alreadyApproved && (
                <div className="flex items-center gap-2">
                  <StepPill
                    label={`Approve ${paymentSymbol}`}
                    state={
                      step === "approving"
                        ? "active"
                        : step === "buying" || step === "done"
                        ? "done"
                        : "idle"
                    }
                  />
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <StepPill
                    label="Purchase NFT"
                    state={
                      step === "buying" ? "active" : step === "done" ? "done" : "idle"
                    }
                  />
                </div>
              )}

              {/* Security note */}
              <AlertBlock
                icon={ShieldCheck}
                variant="blue"
                title="Atomic settlement"
                body="NFT transfers to you before payment is routed. If the seller moves the NFT first, the transaction reverts automatically."
              />

              {/* Error */}
              <AnimatePresence>
                {step === "error" && errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <AlertBlock
                      icon={AlertCircle}
                      variant="red"
                      title="Transaction failed"
                      body={errorMsg}
                    />
                  </motion.div>
                )}

                {step === "done" && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <AlertBlock
                      icon={CheckCircle2}
                      variant="green"
                      title="Purchase complete!"
                      body={`${listing.collection} #${listing.tokenId.toString()} is now in your wallet.`}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              {step === "done" ? (
                <motion.button
                  onClick={handleClose}
                  whileTap={{ y: 1, scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full btn-primary py-3.5 rounded-xl font-bold"
                >
                  Close
                </motion.button>
              ) : step === "error" ? (
                <motion.button
                  onClick={() => { setStep("confirm"); setPhase("approve"); setErrorMsg(null); }}
                  whileTap={{ y: 1, scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full py-3.5 rounded-xl font-bold transition-colors"
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-1)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                >
                  Try Again
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleBuy}
                  disabled={isBusy || !hasEnoughBalance || !isNftApproved}
                  whileTap={{ y: 1, scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="w-full btn-primary py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isBusy ? (
                    <>
                      <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                      {isPending
                        ? "Check wallet…"
                        : isConfirming
                        ? "Confirming…"
                        : step === "approving"
                        ? "Approving…"
                        : "Purchasing…"}
                    </>
                  ) : !hasEnoughBalance ? (
                    <>
                      <Wallet style={{ width: 16, height: 16 }} />
                      Insufficient {paymentSymbol}
                    </>
                  ) : (
                    <>
                      {isNative || alreadyApproved ? "Buy Now" : `1. Approve ${paymentSymbol}`}
                      <ArrowRight
                        style={{ width: 15, height: 15 }}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
