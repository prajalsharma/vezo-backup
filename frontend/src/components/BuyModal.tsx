"use client";

import { useState, useEffect } from "react";
import { formatEther, maxUint256 } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { useMarketplace, Listing } from "@/hooks/useMarketplace";
import { useNetwork } from "@/hooks/useNetwork";
import { useReadContract, useWaitForTransactionReceipt, useAccount, useBalance, useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

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

// ─── Constants ────────────────────────────────────────────────────────────────

// On Mezo, BTC at ...0000 is the native gas token — paid via msg.value.
// MEZO at ...0001 and MUSD are standard ERC-20s — need approve + transferFrom.
const BTC_ADDRESS = "0x7b7c000000000000000000000000000000000000";

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing | null;
  onSuccess?: (listing: Listing) => void;
}

type BuyStep = "confirm" | "approving" | "buying" | "done" | "error";

// ─── Error message parser ──────────────────────────────────────────────────────
// Maps raw contract revert strings, custom error names, and wallet errors to
// user-friendly messages.  Custom errors from VeNFTMarketplace and PaymentRouter
// are decoded by wagmi when they appear in the ABI; their names show up in the
// error message so we match on them here.
function parseError(raw: string): string {
  const msg = raw.toLowerCase();
  // Wallet / user rejection
  if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected"))
    return "You rejected the transaction in your wallet.";
  // Contract custom errors (name appears in wagmi decoded message)
  if (msg.includes("selfpurchase"))
    return "You cannot buy your own listing.";
  if (msg.includes("listingnotactive"))
    return "This listing is no longer active — it may have been sold or cancelled.";
  if (msg.includes("expiredvenft"))
    return "This veNFT's lock has expired and cannot be traded.";
  if (msg.includes("notowner"))
    return "The seller no longer owns this NFT — the listing is stale.";
  if (msg.includes("notapproved") || msg.includes("not approved") || msg.includes("erc721insufficientapproval") || msg.includes("caller is not token owner or approved"))
    return "The seller has not approved the marketplace to transfer this NFT. The listing is stale — the seller needs to re-list.";
  if (msg.includes("insufficientpayment"))
    return "Insufficient payment sent. Please try again.";
  if (msg.includes("invalidamount") || msg.includes("invalid amount"))
    return "Payment amount mismatch. Please try again.";
  if (msg.includes("transferfailed") || msg.includes("transfer failed"))
    return "Token transfer failed. Check your MEZO/MUSD allowance and balance.";
  if (msg.includes("paused"))
    return "The marketplace is currently paused. Please try again later.";
  if (msg.includes("unauthorized"))
    return "Unauthorized contract call. Please contact support.";
  if (msg.includes("unsupportedtoken"))
    return "This payment token is not supported by the marketplace.";
  // ERC-20 allowance / balance failures (from SafeERC20 or ERC20InsufficientAllowance)
  if (msg.includes("allowance") || msg.includes("erc20insufficientallowance"))
    return "Insufficient token allowance. Please approve the router and try again.";
  if (msg.includes("erc20insufficientbalance") || msg.includes("insufficient balance"))
    return "Insufficient token balance to complete this purchase.";
  // Generic fallbacks
  if (msg.includes("insufficient funds"))
    return "Your wallet doesn't have enough balance to pay for this NFT.";
  if (msg.includes("network") || msg.includes("rpc") || msg.includes("fetch"))
    return "Network error — please check your connection and try again.";
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BuyModal({ isOpen, onClose, listing, onSuccess }: BuyModalProps) {
  const { contracts } = useNetwork();
  const { address: buyerAddress } = useAccount();
  const wagmiConfig = useConfig();
  const {
    buyListing,
    approveTokenForBuy,
    executeBuy,
    isPending,
    isConfirming,
  } = useMarketplace();

  // Waits for an approval tx to mine before proceeding to the buy step.
  const waitForApproval = (hash: `0x${string}`) =>
    waitForTransactionReceipt(wagmiConfig, { hash });

  const [step, setStep] = useState<BuyStep>("confirm");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // sessionHash: set directly from writeContractAsync's resolved value — no
  // effects, no race between step state and hash arrival.
  const [sessionHash, setSessionHash] = useState<`0x${string}` | undefined>(undefined);
  const [phase, setPhase] = useState<"approve" | "buy">("approve");

  const { isSuccess: txConfirmed, isError: txFailed, error: txError } =
    useWaitForTransactionReceipt({ hash: sessionHash });

  // BTC is the only native (msg.value) payment token on Mezo.
  // MEZO (...0001) and MUSD are ERC-20s and require approve + transferFrom.
  const paymentLower = listing?.paymentToken.toLowerCase() ?? "";
  const isNative = paymentLower === BTC_ADDRESS.toLowerCase();

  const routerAddress = contracts.router as `0x${string}`;
  const isRouterReady =
    !!routerAddress &&
    routerAddress !== "0x0000000000000000000000000000000000000000";

  // ── Native BTC balance ────────────────────────────────────────────────────
  const { data: nativeBalance } = useBalance({
    address: buyerAddress,
    query: { enabled: isNative && !!buyerAddress },
  });

  // ── ERC-20 balance (MEZO / MUSD) ─────────────────────────────────────────
  const { data: erc20Balance } = useReadContract({
    address: listing?.paymentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: buyerAddress ? [buyerAddress] : undefined,
    query: { enabled: !isNative && !!listing && !!buyerAddress },
  });

  // ── NFT approval checks — detects stale listings where seller lost approval ──
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
        ? [listing.seller as `0x${string}`, (contracts.marketplace as `0x${string}`)]
        : undefined,
    query: { enabled: !!listing },
  });

  const isNftApproved =
    listing == null ||
    (nftApproved as string | undefined)?.toLowerCase() ===
      contracts.marketplace.toLowerCase() ||
    nftApprovedForAll === true;

  // ── ERC-20 allowance (skip for native BTC) ────────────────────────────────
  const { data: currentAllowance } = useReadContract({
    address: listing?.paymentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      buyerAddress && routerAddress
        ? [buyerAddress, routerAddress]
        : undefined,
    query: {
      enabled: !isNative && !!listing && !!buyerAddress && isRouterReady,
    },
  });

  const alreadyApproved =
    !isNative &&
    listing != null &&
    currentAllowance != null &&
    (currentAllowance as bigint) >= listing.price;

  // ── Balance check ─────────────────────────────────────────────────────────
  const hasEnoughBalance = (() => {
    if (!listing) return true; // don't block before listing loads
    if (isNative) {
      if (!nativeBalance) return true; // still loading — don't block
      return nativeBalance.value >= listing.price;
    } else {
      if (!erc20Balance) return true; // still loading — don't block
      return (erc20Balance as bigint) >= listing.price;
    }
  })();

  // Resolve payment symbol network-aware so MUSD vs MEZO vs BTC is always correct.
  const paymentSymbol = listing
    ? (() => {
        const lower = listing.paymentToken.toLowerCase();
        if (lower === "0x7b7c000000000000000000000000000000000000") return "BTC";
        if (lower === "0x7b7c000000000000000000000000000000000001") return "MEZO";
        // Any other address is treated as MUSD (the only other supported payment token)
        return "MUSD";
      })()
    : "";
  const formattedPrice = listing
    ? parseFloat(formatEther(listing.price)).toFixed(6)
    : "0";

  // ── On-chain confirmation or revert ──────────────────────────────────────
  useEffect(() => {
    if (txConfirmed && step === "buying") {
      setStep("done");
      // Notify parent so it can immediately remove the stale listing from the UI
      if (listing) onSuccess?.(listing);
    }
  }, [txConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (txFailed && (step === "approving" || step === "buying")) {
      console.error("[BuyModal] tx failed:", txError);
      const msg = txError?.message ?? "Transaction reverted on-chain.";
      setErrorMsg(parseError(msg));
      setStep("error");
    }
  }, [txFailed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset when modal opens
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
      setErrorMsg(
        `Insufficient ${paymentSymbol} balance. You need ${formattedPrice} ${paymentSymbol} to buy this listing.`
      );
      setStep("error");
      return;
    }

    if (!isNftApproved) {
      setErrorMsg(
        "The seller has not approved the marketplace to transfer this NFT. The listing is stale — the seller needs to re-approve or re-list."
      );
      setStep("error");
      return;
    }

    try {
      if (isNative) {
        // ── Native BTC: single tx ────────────────────────────────────────────
        setPhase("buy");
        setStep("buying");
        const h = await buyListing(listing.listingId, listing.price, true);
        setSessionHash(h);
      } else if (alreadyApproved) {
        // ── ERC-20, already approved: single tx ─────────────────────────────
        setPhase("buy");
        setStep("buying");
        const h = await executeBuy(listing.listingId);
        setSessionHash(h);
      } else {
        // ── ERC-20: approve first, then buy ──────────────────────────────────
        // Approve MaxUint256 so the router can pull sellerAmount + fee in two
        // separate transferFrom calls without running out of allowance.
        setPhase("approve");
        setStep("approving");
        const approveHash = await approveTokenForBuy(listing.paymentToken, maxUint256);
        setSessionHash(approveHash);
        // Wait for approval to mine
        await waitForApproval(approveHash);
        // Now execute the buy
        setPhase("buy");
        setStep("buying");
        setSessionHash(undefined); // clear while new hash arrives
        const buyHash = await executeBuy(listing.listingId);
        setSessionHash(buyHash);
      }
    } catch (err: unknown) {
      setErrorMsg(parseError(err instanceof Error ? err.message : String(err)));
      setStep("error");
    }
  }

  if (!listing) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={step === "done" || step === "confirm" || step === "error" ? handleClose : undefined}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-mezo-background border border-mezo-border rounded-[2.5rem] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-8 border-b border-mezo-border flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">
                  Buy {listing.collection}{" "}
                  <span className="text-mezo-primary">#{listing.tokenId.toString()}</span>
                </h2>
                <p className="text-mezo-muted text-sm mt-1">
                  {isNative
                    ? "Single transaction — pay and receive NFT atomically."
                    : alreadyApproved
                    ? "Allowance ready — one transaction to purchase."
                    : "Two steps: approve token spend, then purchase."}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-mezo-muted" />
              </button>
            </div>

            <div className="p-8 space-y-5">
              {/* Price summary */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-mezo-muted">You pay</span>
                  <span className="font-bold text-white">
                    {formattedPrice} {paymentSymbol}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-mezo-muted">Discount</span>
                  <span className="font-bold text-mezo-success">
                    {listing.discountBps === null
                      ? "—"
                      : `${(Number(listing.discountBps) / 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-mezo-muted">Protocol fee</span>
                  <span className="font-bold text-mezo-muted">2%</span>
                </div>
              </div>

              {/* Stale approval warning */}
              {!isNftApproved && step === "confirm" && (
                <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-400">Listing no longer valid</p>
                    <p className="text-xs text-mezo-muted mt-0.5">
                      The seller's NFT approval for the marketplace has been revoked. This purchase will fail until the seller re-approves or re-lists.
                    </p>
                  </div>
                </div>
              )}

              {/* Balance warning */}
              {!hasEnoughBalance && step === "confirm" && (
                <div className="flex gap-3 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                  <Wallet className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-yellow-400">Insufficient balance</p>
                    <p className="text-xs text-mezo-muted mt-0.5">
                      You need {formattedPrice} {paymentSymbol}. Add funds to your wallet before buying.
                    </p>
                  </div>
                </div>
              )}

              {/* Step indicators for ERC-20 (only when there's more than one step) */}
              {!isNative && !alreadyApproved && (
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
                      step === "approving"
                        ? "bg-mezo-primary/20 text-mezo-primary"
                        : step === "buying" || step === "done"
                        ? "bg-mezo-success/20 text-mezo-success"
                        : "bg-white/5 text-mezo-muted"
                    }`}
                  >
                    {(step === "buying" || step === "done") ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : step === "approving" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[8px]">1</span>
                    )}
                    Approve {paymentSymbol}
                  </div>
                  <div className="h-px flex-1 bg-mezo-border" />
                  <div
                    className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${
                      step === "buying"
                        ? "bg-mezo-primary/20 text-mezo-primary"
                        : step === "done"
                        ? "bg-mezo-success/20 text-mezo-success"
                        : "bg-white/5 text-mezo-muted"
                    }`}
                  >
                    {step === "done" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : step === "buying" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-current flex items-center justify-center text-[8px]">2</span>
                    )}
                    Purchase NFT
                  </div>
                </div>
              )}

              {/* Security note */}
              <div className="flex gap-3 p-4 rounded-2xl bg-mezo-primary/5 border border-mezo-primary/20">
                <ShieldCheck className="w-5 h-5 text-mezo-primary shrink-0 mt-0.5" />
                <p className="text-xs text-mezo-muted leading-relaxed">
                  NFT transfers to you before payment is routed. If the seller
                  moves the NFT before you buy, the transaction reverts automatically.
                </p>
              </div>

              {/* Error */}
              {step === "error" && errorMsg && (
                <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400 leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {/* Success */}
              {step === "done" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 p-4 rounded-2xl bg-mezo-success/10 border border-mezo-success/20"
                >
                  <CheckCircle2 className="w-5 h-5 text-mezo-success shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-mezo-success">Purchase complete!</p>
                    <p className="text-xs text-mezo-muted mt-0.5">
                      {listing.collection} #{listing.tokenId.toString()} is now in your wallet.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Action button */}
              {step === "done" ? (
                <button
                  onClick={handleClose}
                  className="w-full btn-primary py-4 rounded-2xl font-bold"
                >
                  Close
                </button>
              ) : step === "error" ? (
                <button
                  onClick={() => { setStep("confirm"); setPhase("approve"); setErrorMsg(null); }}
                  className="w-full py-4 rounded-2xl font-bold bg-white/5 hover:bg-white/10 transition-all"
                >
                  Try Again
                </button>
              ) : (
                <button
                  onClick={handleBuy}
                  disabled={step !== "confirm" || !hasEnoughBalance || !isNftApproved}
                  className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {step === "approving" || step === "buying" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
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
                      <Wallet className="w-5 h-5" />
                      Insufficient {paymentSymbol}
                    </>
                  ) : (
                    <>
                      {isNative || alreadyApproved
                        ? "Buy Now"
                        : `1. Approve ${paymentSymbol}`}
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
