"use client";

import { formatEther } from "viem";
import { motion } from "framer-motion";
import {
  Zap,
  Clock,
  ChevronRight,
  TrendingDown,
  CalendarDays,
  Tag,
  Info,
  GitMerge,
} from "lucide-react";
import { DiscountBadge } from "./DiscountBadge";
import { CountdownCompact } from "./CountdownTimer";
import { getPaymentTokenSymbol } from "@/lib/tokens";

interface VeNFTCardProps {
  listingId: number;
  collection: "veBTC" | "veMEZO";
  tokenId: bigint;
  price: bigint;
  paymentToken: string;
  intrinsicValue: bigint;
  lockEnd: bigint;
  votingPower: bigint;
  discountBps: bigint | null;
  seller: string;
  active?: boolean;
  isGrant?: boolean;
  onBuy?: () => void;
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
  isGrant = false,
  onBuy,
}: VeNFTCardProps) {
  const isVeBTC = collection === "veBTC";
  // lockEnd is a Unix timestamp in seconds from the contract.
  // lockEnd == 0 means an auto-max lock — duration is continuously reset to max.
  // It can be disabled by the holder, after which normal decay begins.
  // Only mark expired when lockEnd > 0 and the timestamp has passed.
  const lockEndSec = Number(lockEnd);
  const isPermanent = lockEndSec === 0;
  const isExpired = !isPermanent && lockEndSec <= Math.floor(Date.now() / 1000);

  const formattedPrice = parseFloat(formatEther(price)).toFixed(4);
  const formattedIntrinsic = parseFloat(formatEther(intrinsicValue)).toFixed(4);
  const formattedVotingPower = parseFloat(formatEther(votingPower)).toFixed(2);

  // Human-readable expiry date
  const lockExpiryDate = isPermanent
    ? null
    : new Date(lockEndSec * 1000).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -6 }}
      className={`group relative glass-card rounded-3xl overflow-hidden p-6 ${isExpired ? "opacity-60" : ""}`}
    >
      {/* Glow Header Background */}
      <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 -z-10 ${isVeBTC ? 'bg-mezo-primary' : 'bg-mezo-accent'}`} />

      {/* Card Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${isVeBTC ? 'bg-mezo-primary' : 'bg-mezo-accent'}`} />
            <h4 className="text-sm font-bold tracking-widest uppercase text-mezo-muted">
              {collection} #<span className="text-white">{tokenId.toString()}</span>
            </h4>
          </div>
          <p className="text-[10px] text-mezo-muted font-mono truncate w-32">
            Seller: {seller.slice(0, 6)}...{seller.slice(-4)}
          </p>
          {/* Grant NFT badge — shown only when this is a grant-distributed veNFT */}
          {isGrant && (
            <div className="flex items-center gap-1 mt-1.5">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <GitMerge className="w-2.5 h-2.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Grant NFT</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-mezo-muted">
                <span className="text-[9px] font-bold uppercase tracking-wide">Can&apos;t merge / split</span>
              </div>
            </div>
          )}
        </div>
        <DiscountBadge discountBps={discountBps === null ? null : Number(discountBps)} />
      </div>

      {/* Primary Value Display */}
      <div className="mb-8">
        <p className="text-xs text-mezo-muted font-bold uppercase tracking-wider mb-1">Intrinsic Value</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">
            {formattedIntrinsic}
          </span>
          <span className="text-sm text-mezo-muted font-bold">{isVeBTC ? 'BTC' : 'MEZO'}</span>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center gap-1.5 text-mezo-muted mb-1">
            <TrendingDown className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Locked</span>
          </div>
          <p className="text-sm font-bold tabular-nums">
            {formattedIntrinsic} <span className="text-mezo-muted font-medium">{isVeBTC ? "BTC" : "MEZO"}</span>
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center gap-1.5 text-mezo-muted mb-1">
            <Zap className="w-3 h-3 text-mezo-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Voting Power</span>
          </div>
          <p className="text-sm font-bold tabular-nums">{formattedVotingPower}</p>
        </div>

        {/* Lock Ends — spans full row so both countdown AND date are visible */}
        <div className="col-span-2 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center gap-1.5 text-mezo-muted mb-1">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Lock Ends</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">
              <CountdownCompact lockEnd={lockEnd} />
            </div>
            {lockExpiryDate && (
              <div className="flex items-center gap-1 text-mezo-muted">
                <CalendarDays className="w-3 h-3" />
                <span className="text-[10px] font-medium">{lockExpiryDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Intrinsic vs Price Comparison */}
      <div className="mb-5 p-3 rounded-2xl border border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent">
        <div className="flex items-center gap-1 text-mezo-muted mb-2">
          <Info className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Value Breakdown</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-mezo-muted font-medium">Intrinsic Value</span>
            <span className="font-bold tabular-nums">{formattedIntrinsic} <span className="text-mezo-muted">{isVeBTC ? "BTC" : "MEZO"}</span></span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          <div className="flex flex-col gap-0.5 items-end">
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-mezo-success" />
              <span className="text-mezo-muted font-medium">Listing Price</span>
            </div>
            <span className="font-bold tabular-nums text-mezo-success">{formattedPrice} <span className="text-mezo-muted">{getPaymentTokenSymbol(paymentToken)}</span></span>
          </div>
        </div>
      </div>

      {/* Action */}
      <div className="pt-4 border-t border-mezo-border/50">
        <button
          onClick={onBuy}
          disabled={isExpired || !active}
          className={`w-full group/btn relative flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all overflow-hidden
            ${(isExpired || !active)
              ? 'bg-mezo-border text-mezo-muted cursor-not-allowed' 
              : 'bg-white text-black hover:bg-mezo-primary hover:text-white'
            }`}
        >
          <span className="relative z-10">
            {!active ? "Listing Inactive" : isExpired ? "Position Expired" : "Complete Purchase"}
          </span>
          {active && !isExpired && <ChevronRight className="w-4 h-4 relative z-10 group-hover/btn:translate-x-1 transition-transform" />}
          
          {/* Shimmer Effect */}
          {active && !isExpired && <div className="absolute inset-0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />}
        </button>
      </div>

      {/* Hover Status Indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full transition-transform duration-300 origin-bottom scale-y-0 group-hover:scale-y-100 ${isVeBTC ? 'bg-mezo-primary' : 'bg-mezo-accent'}`} />
    </motion.div>
  );
}

export function VeNFTCardSkeleton() {
  return (
    <div className="glass-card rounded-3xl p-6 h-[420px] animate-pulse">
      <div className="flex justify-between mb-6">
        <div className="h-4 w-24 bg-white/5 rounded" />
        <div className="h-6 w-16 bg-white/5 rounded-full" />
      </div>
      <div className="h-4 w-20 bg-white/5 rounded mb-2" />
      <div className="h-10 w-40 bg-white/5 rounded mb-8" />
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="h-16 bg-white/5 rounded-2xl" />
        <div className="h-16 bg-white/5 rounded-2xl" />
      </div>
      <div className="pt-6 border-t border-mezo-border">
        <div className="h-10 w-full bg-white/5 rounded-xl" />
      </div>
    </div>
  );
}
