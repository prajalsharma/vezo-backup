"use client";

import { useState, useEffect } from "react";
import { formatEther, maxUint256 } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowRight, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Wallet,
  Zap, TrendingDown, Tag, Clock,
} from "lucide-react";
import { useMarketplace, Listing } from "@/hooks/useMarketplace";
import { useNetwork } from "@/hooks/useNetwork";
import { useReadContract, useWaitForTransactionReceipt, useAccount, useBalance, useConfig } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { getPaymentTokenSymbol } from "@/lib/tokens";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { CountdownCompact } from "./CountdownTimer";

// ─── Adapter ABI (minimal) ────────────────────────────────────────────────────
const ADAPTER_ABI_BUY = [
  {
    name: "isExpired",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

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

const BTC_ADDRESS = "0x7b7c000000000000000000000000000000000000";

interface BuyModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing | null;
  onPurchaseSuccess?: () => void;
}

type BuyStep = "confirm" | "approving" | "buying" | "done" | "error";

function parseError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("user rejected") || msg.includes("user denied") || msg.includes("rejected"))
    return "You rejected the transaction in your wallet.";
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

export function BuyModal({ isOpen, onClose, listing, onPurchaseSuccess }: BuyModalProps) {
  const { contracts } = useNetwork();
  const { address: buyerAddress } = useAccount();
  const wagmiConfig = useConfig();
  const {
    buyListing,
    approveTokenForBuy,
    executeBuy,
    refetchCount,
    refetchUserListings,
    adapterAddress,
    isPending,
    isConfirming,
  } = useMarketplace();

  const waitForApproval = (hash: `0x${string}`) =>
    waitForTransactionReceipt(wagmiConfig, { hash });

  const [step, setStep] = useState<BuyStep>("confirm");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionHash, setSessionHash] = useState<`0x${string}` | undefined>(undefined);
  const [phase, setPhase] = useState<"approve" | "buy">("approve");
  const [showCurrencies, setShowCurrencies] = useState(false);

  const { isSuccess: txConfirmed, isError: txFailed, error: txError } =
    useWaitForTransactionReceipt({ hash: sessionHash });

  const paymentLower = listing?.paymentToken.toLowerCase() ?? "";
  const isNative = paymentLower === BTC_ADDRESS.toLowerCase();

  const routerAddress = contracts.router as `0x${string}`;
  const isRouterReady =
    !!routerAddress &&
    routerAddress !== "0x0000000000000000000000000000000000000000";

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
        ? [listing.seller as `0x${string}`, (contracts.marketplace as `0x${string}`)]
        : undefined,
    query: { enabled: !!listing },
  });

  const isNftApproved =
    listing == null ||
    (nftApproved as string | undefined)?.toLowerCase() ===
      contracts.marketplace.toLowerCase() ||
    nftApprovedForAll === true;

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

  const isAdapterReady =
    !!adapterAddress &&
    adapterAddress !== "0x0000000000000000000000000000000000000000";

  const { data: expiredResult } = useReadContract({
    address: adapterAddress as `0x${string}`,
    abi: ADAPTER_ABI_BUY,
    functionName: "isExpired",
    args:
      listing?.nftContract && listing?.tokenId !== undefined
        ? [listing.nftContract as `0x${string}`, listing.tokenId]
        : undefined,
    query: {
      enabled: isAdapterReady && !!listing,
    },
  });

  const isVeNFTExpired = expiredResult === true;

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

  const paymentSymbol = listing ? getPaymentTokenSymbol(listing.paymentToken) : "";
  const formattedPrice = listing
    ? parseFloat(formatEther(listing.price)).toFixed(6)
    : "0";

  const { prices, toUSD, source: priceSource } = useTokenPrices();
  const priceUSD = listing
    ? toUSD(listing.price, paymentSymbol as "BTC" | "MEZO" | "MUSD")
    : "—";
  const intrinsicUSD = listing
    ? toUSD(listing.intrinsicValue, (listing.collection === "veBTC" ? "BTC" : "MEZO") as "BTC" | "MEZO" | "MUSD")
    : "—";
  const usdDiscountPct = listing && listing.intrinsicValue > 0n && listing.price < listing.intrinsicValue
    ? (Number(listing.discountBps) / 100).toFixed(1)
    : null;

  const feeAmount = listing
    ? parseFloat(formatEther((listing.price * 100n) / 10000n)).toFixed(6)
    : "0";

  // Cross-currency conversion — only compute when prices are live
  const crossCurrency = (() => {
    if (!listing || !prices.BTC || !prices.MEZO || priceSource !== "live") return null;
    const priceUSDNum = (Number(listing.price) / 1e18) * prices[paymentSymbol as "BTC" | "MEZO" | "MUSD"];
    const ivToken = listing.collection === "veBTC" ? "BTC" : "MEZO";
    const ivUSDNum = (Number(listing.intrinsicValue) / 1e18) * prices[ivToken];
    if (priceUSDNum === 0) return null;

    const rows = [
      { sym: "BTC",  usdPerToken: prices.BTC,  dec: 8 },
      { sym: "MEZO", usdPerToken: prices.MEZO, dec: 4 },
      { sym: "MUSD", usdPerToken: 1,           dec: 2 },
    ].map(({ sym, usdPerToken, dec }) => {
      const amt = (priceUSDNum / usdPerToken).toFixed(dec);
      const ivInThis = usdPerToken > 0 ? ivUSDNum / usdPerToken : 0;
      const amtNum = priceUSDNum / usdPerToken;
      const disc = ivInThis > 0 && amtNum < ivInThis
        ? (((ivInThis - amtNum) / ivInThis) * 100).toFixed(1)
        : null;
      return { sym, amt, disc, isSame: sym === paymentSymbol };
    });

    const bestIdx = rows.reduce(
      (b, r, i) => r.disc !== null && (b === -1 || parseFloat(r.disc) > parseFloat(rows[b].disc ?? "0")) ? i : b,
      -1
    );
    return { rows, bestIdx };
  })();

  useEffect(() => {
    if (txConfirmed && step === "buying") {
      refetchCount();
      refetchUserListings();
      onPurchaseSuccess?.();
      setStep("done");
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

  useEffect(() => {
    if (isOpen) {
      setStep("confirm");
      setPhase("approve");
      setErrorMsg(null);
      setSessionHash(undefined);
      setShowCurrencies(false);
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

    if (isVeNFTExpired) {
      setErrorMsg("This veNFT's lock has expired and cannot be traded. The listing should be cancelled by the seller.");
      setStep("error");
      return;
    }

    if (!hasEnoughBalance) {
      setErrorMsg(`Insufficient ${paymentSymbol} balance. You need ${formattedPrice} ${paymentSymbol} to buy this listing.`);
      setStep("error");
      return;
    }

    if (!isNftApproved) {
      setErrorMsg("The seller has not approved the marketplace to transfer this NFT. The listing is stale — the seller needs to re-approve or re-list.");
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

  const isVeBTC     = listing.collection === "veBTC";
  const accentColor = isVeBTC ? "#F7931A" : "#4A90E2";
  const accentBg    = isVeBTC ? "rgba(247,147,26,0.08)" : "rgba(74,144,226,0.08)";
  const accentBord  = isVeBTC ? "rgba(247,147,26,0.18)" : "rgba(74,144,226,0.18)";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={step === "done" || step === "confirm" ? handleClose : undefined}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative w-full max-w-md bg-[#0a0a0a] border border-white/[0.08] rounded-[2rem] overflow-hidden shadow-2xl"
          >
            {/* Top accent line */}
            <div
              className="h-[2px]"
              style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44, transparent)` }}
            />

            {/* Header */}
            <div className="px-7 pt-7 pb-5 border-b border-white/[0.06]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: accentBg, border: `1px solid ${accentBord}` }}
                    >
                      <Zap className="w-4 h-4" style={{ color: accentColor }} />
                    </div>
                    <span
                      className="text-[10px] font-black tracking-[0.12em] uppercase px-2 py-0.5 rounded-md"
                      style={{ color: accentColor, background: accentBg }}
                    >
                      {listing.collection}
                    </span>
                  </div>
                  <h2 className="text-[21px] font-bold tracking-tight">
                    Purchase{" "}
                    <span style={{ color: accentColor }}>#{listing.tokenId.toString()}</span>
                  </h2>
                  <p className="text-white/32 text-[12.5px] mt-1">
                    {isNative
                      ? "Single transaction — pay and receive NFT atomically."
                      : alreadyApproved
                      ? "Allowance ready — one transaction to purchase."
                      : "Two steps: approve token spend, then purchase."}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors text-white/32 hover:text-white mt-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-7 pb-7 pt-5 space-y-4">

              {/* ── Price breakdown ── */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.055] overflow-hidden">
                {/* Intrinsic value row */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-white/28" />
                    <span className="text-[12px] text-white/38 font-medium">Intrinsic Value</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12.5px] font-bold text-white/52">
                      {listing.intrinsicValue > 0n
                        ? `${parseFloat(formatEther(listing.intrinsicValue)).toFixed(5)} ${listing.collection === "veBTC" ? "BTC" : "MEZO"}`
                        : "—"}
                    </span>
                    <p className="text-[10px] text-white/22 font-mono">{intrinsicUSD}</p>
                  </div>
                </div>

                {/* Ask price row */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[12px] text-white/38 font-medium">Ask Price</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12.5px] font-bold text-white">
                      {formattedPrice} {paymentSymbol}
                    </span>
                    <p className="text-[10px] text-white/22 font-mono">
                      {priceUSD}
                      {priceSource === "fallback" && <span className="text-white/15"> (est.)</span>}
                    </p>
                  </div>
                </div>

                {/* Fee row */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-white/22" />
                    <span className="text-[12px] text-white/38 font-medium">Protocol Fee (1%)</span>
                  </div>
                  <span className="text-[12.5px] font-medium text-white/32">
                    {feeAmount} {paymentSymbol}
                  </span>
                </div>

                {/* Discount row */}
                {usdDiscountPct && (
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] bg-emerald-500/[0.04]">
                    <span className="text-[12px] text-emerald-400/75 font-medium">Discount vs IV</span>
                    <span className="text-[12.5px] font-bold text-emerald-400">
                      {usdDiscountPct}% below IV
                    </span>
                  </div>
                )}

                {/* Cross-currency toggle — only shown when live prices available */}
                {crossCurrency && (
                  <>
                    <button
                      onClick={() => setShowCurrencies(v => !v)}
                      className="w-full flex items-center justify-between px-5 py-2 text-[11px] font-semibold text-white/30 hover:text-white/50 hover:bg-white/[0.015] transition-colors border-b border-white/[0.04]"
                    >
                      <span>View in other currencies</span>
                      <span className={`transition-transform duration-200 text-[9px] ${showCurrencies ? "rotate-180" : ""}`}>▼</span>
                    </button>
                    <AnimatePresence>
                      {showCurrencies && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-b border-white/[0.04]"
                        >
                          <div className="px-5 py-3 space-y-1.5">
                            {crossCurrency.rows.map((row, i) => (
                              <div key={row.sym} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                                i === crossCurrency.bestIdx ? "bg-emerald-500/[0.06] border border-emerald-500/15" :
                                row.isSame ? "bg-white/[0.025]" : ""
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-white/45 w-8">{row.sym}</span>
                                  {i === crossCurrency.bestIdx && <span className="text-[8px] font-black text-emerald-400 uppercase">best</span>}
                                  {row.isSame && <span className="text-[8px] text-white/18 uppercase">quoted</span>}
                                </div>
                                <div className="text-right">
                                  <span className="text-[12px] font-bold tabular-nums">{row.amt}</span>
                                  {row.disc && <p className="text-[9.5px] text-emerald-400 font-bold">{row.disc}% below IV</p>}
                                </div>
                              </div>
                            ))}
                            <p className="text-[9px] text-white/18 pt-0.5">Spot prices. Payment still settles in the listed currency.</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {/* Total row */}
                <div className="flex items-center justify-between px-5 py-4 bg-white/[0.025]">
                  <span className="text-[13.5px] font-bold text-white">You Pay</span>
                  <div className="text-right">
                    <span className="text-[15px] font-bold text-white">
                      {formattedPrice} {paymentSymbol}
                    </span>
                    <p className="text-[10px] text-white/22 font-mono">{priceUSD}</p>
                  </div>
                </div>
              </div>

              {/* Lock status */}
              {listing.lockEnd > 0n && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <Clock className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11.5px] text-white/32">Lock expires:</span>
                    <CountdownCompact lockEnd={listing.lockEnd} />
                  </div>
                </div>
              )}

              {/* Expired veNFT warning */}
              {isVeNFTExpired && step === "confirm" && (
                <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12.5px] font-bold text-red-400">Lock expired</p>
                    <p className="text-[11.5px] text-white/32 mt-0.5 leading-relaxed">
                      This veNFT's lock period has ended. Expired positions cannot be traded.
                    </p>
                  </div>
                </div>
              )}

              {/* Stale approval warning */}
              {!isNftApproved && step === "confirm" && (
                <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12.5px] font-bold text-red-400">Listing no longer valid</p>
                    <p className="text-[11.5px] text-white/32 mt-0.5 leading-relaxed">
                      The seller's NFT approval has been revoked. The seller needs to re-list.
                    </p>
                  </div>
                </div>
              )}

              {/* Balance warning */}
              {!hasEnoughBalance && step === "confirm" && (
                <div className="flex gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <Wallet className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12.5px] font-bold text-amber-400">Insufficient balance</p>
                    <p className="text-[11.5px] text-white/32 mt-0.5 leading-relaxed">
                      You need {formattedPrice} {paymentSymbol}. Add funds before buying.
                    </p>
                  </div>
                </div>
              )}

              {/* Step indicators for ERC-20 two-step */}
              {!isNative && !alreadyApproved && (
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                      step === "approving"
                        ? "bg-[#F7931A]/20 text-[#F7931A]"
                        : step === "buying" || step === "done"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/[0.05] text-white/32"
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
                  <div className="h-px flex-1 bg-white/[0.07]" />
                  <div
                    className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                      step === "buying"
                        ? "bg-[#F7931A]/20 text-[#F7931A]"
                        : step === "done"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/[0.05] text-white/32"
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
              <div className="flex gap-3 p-4 rounded-2xl bg-[#F7931A]/[0.04] border border-[#F7931A]/14">
                <ShieldCheck className="w-4 h-4 text-[#F7931A] shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-white/32 leading-relaxed">
                  NFT transfers to you before payment is routed. If the seller moves the NFT, the transaction reverts automatically.
                </p>
              </div>

              {/* Error */}
              {step === "error" && errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-red-400 leading-relaxed">{errorMsg}</p>
                </motion.div>
              )}

              {/* Success */}
              {step === "done" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-bold text-emerald-400">Purchase complete!</p>
                    <p className="text-[12px] text-white/35 mt-0.5">
                      {listing.collection} #{listing.tokenId.toString()} is now in your wallet.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Action button */}
              {step === "done" ? (
                <button
                  onClick={handleClose}
                  className="w-full btn-primary py-4 rounded-2xl font-bold text-[14px]"
                >
                  Close
                </button>
              ) : step === "error" ? (
                <button
                  onClick={() => { setStep("confirm"); setPhase("approve"); setErrorMsg(null); }}
                  className="w-full py-4 rounded-2xl font-bold text-[14px] bg-white/[0.05] hover:bg-white/[0.09] transition-all"
                >
                  Try Again
                </button>
              ) : (
                <button
                  onClick={handleBuy}
                  disabled={step !== "confirm" || !hasEnoughBalance || !isNftApproved || isVeNFTExpired}
                  className="w-full btn-primary py-4 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-[14.5px] disabled:opacity-40 disabled:cursor-not-allowed group"
                >
                  {step === "approving" || step === "buying" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isPending
                        ? "Check wallet…"
                        : isConfirming
                        ? "Confirming on-chain…"
                        : step === "approving"
                        ? "Approving spend…"
                        : "Processing purchase…"}
                    </>
                  ) : !hasEnoughBalance ? (
                    <>
                      <Wallet className="w-5 h-5" />
                      Insufficient {paymentSymbol}
                    </>
                  ) : (
                    <>
                      {isNative || alreadyApproved
                        ? "Confirm Purchase"
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
