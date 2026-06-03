"use client";

import { formatEther } from "viem";
import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Clock, CalendarDays, Tag, ArrowRight, DollarSign, TrendingDown, Lock, Infinity, Gavel } from "lucide-react";
import { DiscountBadge } from "./DiscountBadge";
import { CountdownCompact } from "./CountdownTimer";
import { getPaymentTokenSymbol } from "@/lib/tokens";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { useReadContract, useAccount } from "wagmi";
import { useNetwork } from "@/hooks/useNetwork";
import { BidRegistryABI } from "@/lib/abis";
import { BidModal } from "./BidModal";
import { BidListModal } from "./BidListModal";

interface VeNFTCardProps {
  listingId: number;
  collection: "veBTC" | "veMEZO";
  tokenId: bigint;
  price: bigint;
  paymentToken: string;
  intrinsicValue: bigint;
  lockEnd: bigint;
  votingPower: bigint;
  discountBps: bigint;
  seller: string;
  active?: boolean;
  onBuy?: () => void;
  nftContract?: string;
  /** compact = grid view, expanded = featured/carousel, detailed = modal-like */
  variant?: "compact" | "expanded" | "detailed";
}

export function VeNFTCard({
  listingId,
  collection,
  tokenId,
  price,
  paymentToken,
  intrinsicValue,
  lockEnd,
  votingPower,
  discountBps,
  seller,
  active = true,
  onBuy,
  nftContract,
  variant = "compact",
}: VeNFTCardProps) {
  const { address: userAddress } = useAccount();
  const { contracts } = useNetwork();
  const [bidOpen, setBidOpen]         = useState(false);
  const [bidListOpen, setBidListOpen] = useState(false);

  const isVeBTC     = collection === "veBTC";
  const lockEndSec  = Number(lockEnd);
  const isPermanent = lockEndSec === 0;
  const isExpired   = !isPermanent && lockEndSec <= Math.floor(Date.now() / 1000);

  const bidAddr     = (contracts as any).bidRegistry as `0x${string}`;
  const bidDeployed = !!bidAddr && bidAddr !== "0x0000000000000000000000000000000000000000";
  const nftAddr     = (nftContract ?? (isVeBTC ? contracts.veBTC : (contracts as any).veMEZO)) as `0x${string}`;
  const isOwner     = !!userAddress && userAddress.toLowerCase() === seller.toLowerCase();

  const { data: bidCount } = useReadContract({
    address: bidAddr,
    abi: BidRegistryABI,
    functionName: "activeBidCount",
    args: [nftAddr, tokenId],
    query: { enabled: bidDeployed && !isExpired && active },
  });

  const formattedPrice       = parseFloat(formatEther(price)).toFixed(5);
  const formattedIntrinsic   = parseFloat(formatEther(intrinsicValue)).toFixed(5);
  const formattedVotingPower = parseFloat(formatEther(votingPower)).toFixed(2);
  const discountPct          = (Number(discountBps) / 100).toFixed(1);

  const { toUSD, source: priceSource } = useTokenPrices();
  const paymentSymbol = getPaymentTokenSymbol(paymentToken);
  const baseToken     = isVeBTC ? "BTC" : "MEZO";
  const priceUSD      = toUSD(price, paymentSymbol as "BTC" | "MEZO" | "MUSD");
  const intrinsicUSD  = toUSD(intrinsicValue, baseToken);

  const intrinsicUSDNum = (Number(intrinsicValue) / 1e18) * (isVeBTC ? 85_000 : 0.10);
  const priceUSDNum     = (Number(price) / 1e18) * (isVeBTC ? 85_000 : 0.10);
  const usdDiscountPct  = intrinsicUSDNum > 0 && priceUSDNum < intrinsicUSDNum
    ? (((intrinsicUSDNum - priceUSDNum) / intrinsicUSDNum) * 100).toFixed(1)
    : null;

  const lockExpiryDate = isPermanent ? null : new Date(lockEndSec * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const accentColor = isVeBTC ? "#F7931A" : "#4A90E2";
  const accentBg    = isVeBTC ? "rgba(247,147,26,0.09)"  : "rgba(74,144,226,0.09)";
  const accentBord  = isVeBTC ? "rgba(247,147,26,0.2)"   : "rgba(74,144,226,0.2)";
  const accentGlow  = isVeBTC ? "rgba(247,147,26,0.14)"  : "rgba(74,144,226,0.11)";

  // Progress bar: price / intrinsicValue ratio (clamped 0-100)
  const valueRatio = intrinsicValue > 0n
    ? Math.min(100, Math.round((Number(price) / Number(intrinsicValue)) * 100))
    : 100;

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: isExpired ? 0 : variant === "compact" ? -5 : -3 }}
      transition={{ duration: 0.3 }}
      className={`group relative flex flex-col rounded-2xl border border-white/[0.065] bg-[#0c0c0c] overflow-hidden transition-all duration-300 ${
        isExpired
          ? "opacity-40 pointer-events-none"
          : "hover:border-white/[0.12] hover:shadow-[0_18px_64px_rgba(0,0,0,0.65)]"
      } ${variant === "expanded" ? "shadow-[0_12px_48px_rgba(0,0,0,0.5)]" : ""}`}
    >
      {/* Accent top edge */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}33, transparent)` }}
      />

      {/* Corner ambient glow */}
      <div
        className="absolute top-0 right-0 w-52 h-52 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${accentGlow} 0%, transparent 65%)` }}
      />

      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          {/* Collection badge */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105"
            style={{ background: accentBg, border: `1px solid ${accentBord}` }}
          >
            <Zap className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              {/* Collection badge pill */}
              <span
                className="text-[9px] font-black tracking-[0.12em] uppercase px-2 py-0.5 rounded-md"
                style={{ color: accentColor, background: accentBg, border: `1px solid ${accentBord}` }}
              >
                {collection}
              </span>
            </div>
            <p className="text-[14px] font-bold leading-none mt-1">
              <span style={{ color: accentColor }}>#{tokenId.toString()}</span>
            </p>
            <p className="text-[10px] text-white/20 font-mono mt-1 leading-none">
              {seller.slice(0, 6)}…{seller.slice(-4)}
            </p>
          </div>
        </div>
        <DiscountBadge discountBps={Number(discountBps)} />
      </div>

      {/* ── Intrinsic value hero ── */}
      <div className="px-5 pb-4">
        <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-white/25 mb-1.5">Intrinsic Value</p>
        <div className="flex items-baseline gap-2">
          <span className="text-[1.9rem] font-bold tabular-nums tracking-tight leading-none" style={{ fontVariantNumeric: "tabular-nums lining-nums" }}>
            {formattedIntrinsic}
          </span>
          <span className="text-[13px] font-bold text-white/30">{isVeBTC ? "BTC" : "MEZO"}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-[11px] text-white/25 font-mono flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-white/15" />
            <span>{intrinsicUSD}</span>
            {priceSource === "fallback" && (
              <span className="text-white/15 text-[9px]">(est.)</span>
            )}
          </p>
        </div>
      </div>

      {/* Price vs Value progress bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/20">Price / Value</span>
          <span className="text-[9.5px] font-bold text-white/30">{valueRatio}%</span>
        </div>
        <div className="h-[3px] rounded-full bg-white/[0.055] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${valueRatio}%` }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22,1,0.36,1] }}
            className="h-full rounded-full"
            style={{
              background: valueRatio < 85
                ? `linear-gradient(90deg, ${accentColor}, ${accentColor}99)`
                : `linear-gradient(90deg, #EF4444, #ef4444aa)`,
            }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/[0.05]" />

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-2 p-4">
        {/* Voting power */}
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3.5 transition-colors group-hover:bg-white/[0.035]">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3 h-3" style={{ color: accentColor }} />
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/25">Voting Power</span>
          </div>
          <p className="text-[13.5px] font-bold tabular-nums leading-none">{formattedVotingPower}</p>
        </div>

        {/* Ask price */}
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3.5 transition-colors group-hover:bg-white/[0.035]">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/25">Ask Price</span>
          </div>
          <p className="text-[13.5px] font-bold tabular-nums leading-none text-emerald-400">
            {formattedPrice}{" "}
            <span className="text-white/25 font-medium text-[10px]">{getPaymentTokenSymbol(paymentToken)}</span>
          </p>
          <p className="text-[10px] text-white/20 font-mono mt-1">{priceUSD}</p>
          {usdDiscountPct && (
            <p className="text-[9px] text-emerald-400/60 font-bold mt-0.5 flex items-center gap-1">
              <TrendingDown className="w-2.5 h-2.5" />
              {usdDiscountPct}% below IV
            </p>
          )}
        </div>

        {/* Lock ends — full width */}
        <div className="col-span-2 rounded-xl bg-white/[0.025] border border-white/[0.04] px-4 py-3.5 transition-colors group-hover:bg-white/[0.035]">
          <div className="flex items-center gap-1.5 mb-2">
            {isPermanent ? (
              <>
                <Infinity className="w-3 h-3 text-[#F7931A]" />
                <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/25">Lock Status</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 text-white/25" />
                <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/25">Lock Ends</span>
              </>
            )}
          </div>
          {isPermanent ? (
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-bold text-[#F7931A]">Permanent Lock</span>
              <Lock className="w-3 h-3 text-[#F7931A]/60" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <CountdownCompact lockEnd={lockEnd} />
              {lockExpiryDate && (
                <div className="flex items-center gap-1 text-white/20">
                  <CalendarDays className="w-3 h-3" />
                  <span className="text-[10px] font-medium">{lockExpiryDate}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Listing ID ── */}
      <div className="px-5 pb-2">
        <p className="text-[9.5px] text-white/15 font-mono">Listing #{listingId}</p>
      </div>

      {/* ── CTA ── */}
      <div className="mt-auto px-4 pb-4">
        <button
          onClick={onBuy}
          disabled={isExpired || !active}
          className={`group/btn relative w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[13.5px] font-bold overflow-hidden transition-all duration-200 ${
            isExpired || !active
              ? "bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.05]"
              : "text-black hover:filter hover:brightness-110 hover:shadow-[0_6px_28px_rgba(247,147,26,0.28)]"
          }`}
          style={
            active && !isExpired
              ? { background: "linear-gradient(135deg, #F7931A 0%, #ff9e2a 100%)" }
              : {}
          }
        >
          {/* Shimmer sweep */}
          {active && !isExpired && (
            <span className="absolute inset-0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/18 to-transparent pointer-events-none" />
          )}
          <span className="relative z-10">
            {!active ? "Inactive" : isExpired ? "Expired" : "Buy Now"}
          </span>
          {active && !isExpired && (
            <ArrowRight className="relative z-10 w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
          )}
        </button>

        {/* Bid button — only when registry deployed and NFT is active/not-expired */}
        {bidDeployed && active && !isExpired && (
          <button
            onClick={() => isOwner ? setBidListOpen(true) : setBidOpen(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold bg-white/[0.03] border border-white/[0.06] text-white/40 hover:bg-white/[0.06] hover:text-white/65 hover:border-white/[0.1] transition-all"
          >
            <Gavel className="w-3.5 h-3.5" />
            {isOwner
              ? bidCount != null && Number(bidCount) > 0
                ? `${Number(bidCount)} Bid${Number(bidCount) !== 1 ? "s" : ""}`
                : "View Bids"
              : "Place Bid"
            }
          </button>
        )}
      </div>

      {bidOpen && (
        <BidModal isOpen={bidOpen} onClose={() => setBidOpen(false)} collection={nftAddr} tokenId={tokenId} collectionName={collection} intrinsicValue={intrinsicValue} onBidPlaced={() => setBidOpen(false)} />
      )}
      {bidListOpen && (
        <BidListModal isOpen={bidListOpen} onClose={() => setBidListOpen(false)} collection={nftAddr} tokenId={tokenId} collectionName={collection} intrinsicValue={intrinsicValue} onBidAccepted={() => setBidListOpen(false)} />
      )}
    </motion.article>
  );
}

export function VeNFTCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.05] bg-[#0c0c0c] overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shimmer" />
          <div>
            <div className="h-3 w-24 rounded shimmer mb-2" />
            <div className="h-2 w-16 rounded shimmer" />
          </div>
        </div>
        <div className="h-5 w-14 rounded-full shimmer" />
      </div>
      <div className="px-5 pb-4">
        <div className="h-2.5 w-20 rounded shimmer mb-2.5" />
        <div className="h-9 w-40 rounded shimmer mb-1.5" />
        <div className="h-2.5 w-24 rounded shimmer" />
      </div>
      <div className="px-5 pb-4">
        <div className="h-[3px] w-full rounded-full shimmer" />
      </div>
      <div className="mx-5 h-px bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="h-[72px] rounded-xl shimmer" />
        <div className="h-[72px] rounded-xl shimmer" />
        <div className="col-span-2 h-[72px] rounded-xl shimmer" />
      </div>
      <div className="px-4 pb-4">
        <div className="h-12 w-full rounded-xl shimmer" />
      </div>
    </div>
  );
}
