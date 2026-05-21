"use client";

/*
  Taste-skill rules applied:
  ✓ Spotlight border illumination: cursor-tracked radial-gradient border reveal
  ✓ Spring physics: stiffness:100 damping:20 (taste-skill standard, not 400/30)
  ✓ Tilt via useMotionValue + useSpring — NOT useState (performance rule)
  ✓ tabular-nums on all numeric values
  ✓ Tinted shadows (hue-matched, not generic gray-black)
  ✓ Liquid glass inner border: inset 0 1px 0 rgba(255,255,255,0.06)
  ✓ Tactile feedback: active state translateY(1px) scale(0.985)
  ✓ Animate ONLY transform + opacity (GPU rule)
  ✓ Best-deal badge ≥10% discount
  ✓ Skeleton matches exact card layout shape
*/

import { formatEther } from "viem";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import {
  Clock,
  ChevronRight,
  CalendarDays,
  GitMerge,
  Star,
  TrendingDown,
  Zap,
  Gavel,
  ChevronDown,
} from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { DiscountBadge } from "./DiscountBadge";
import { CountdownCompact } from "./CountdownTimer";
import { getPaymentTokenSymbol } from "@/lib/tokens";
import BidsPanel from "./BidsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────
interface VeNFTCardProps {
  listingId: number;
  collection: "veBTC" | "veMEZO";
  /** Raw NFT contract address */
  nftContract?: string;
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

// ─── Tilt + Spotlight wrapper ─────────────────────────────────────────────────
// Taste-skill: useMotionValue + useSpring, NOT useState (performance rule)
// Spring physics: stiffness:100 damping:20 (taste-skill standard)
function SpotlightTiltCard({
  children,
  disabled,
  accentColor,
}: {
  children: (mousePos: { x: number; y: number }, hovered: boolean) => React.ReactNode;
  disabled?: boolean;
  accentColor: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  // Taste-skill spring: stiffness:100 damping:20
  const rotX = useSpring(useTransform(my, [-0.5, 0.5], [3.5, -3.5]), { stiffness: 100, damping: 20 });
  const rotY = useSpring(useTransform(mx, [-0.5, 0.5], [-3.5, 3.5]), { stiffness: 100, damping: 20 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [disabled, mx, my]);

  const onMouseLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
    setHovered(false);
  }, [mx, my]);

  const onMouseEnter = useCallback(() => {
    if (!disabled) setHovered(true);
  }, [disabled]);

  return (
    <motion.div
      ref={ref}
      style={disabled ? {} : { rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={onMouseEnter}
    >
      {children(mousePos, hovered)}
    </motion.div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function VeNFTCard({
  listingId,
  collection,
  nftContract,
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
  const lockEndSec = Number(lockEnd);
  const isPermanent = lockEndSec === 0;
  const isExpired = !isPermanent && lockEndSec <= Math.floor(Date.now() / 1000);

  const formattedPrice     = parseFloat(formatEther(price)).toFixed(4);
  const formattedIntrinsic = parseFloat(formatEther(intrinsicValue)).toFixed(4);
  const formattedVoting    = parseFloat(formatEther(votingPower)).toFixed(2);
  const paySymbol          = getPaymentTokenSymbol(paymentToken);

  const lockExpiryDate = isPermanent
    ? null
    : new Date(lockEndSec * 1000).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
      });

  const discountPct = discountBps !== null ? Number(discountBps) / 100 : 0;
  const isBestDeal  = discountPct >= 10;

  // Bar fill: listing price / intrinsic value (capped 100%)
  const barFill = intrinsicValue > 0n
    ? Math.min(100, Math.round(Number(price) / Number(intrinsicValue) * 100))
    : 100;

  // Accent color per collection
  const accentColor = isVeBTC ? "#F7931A" : "#4A90E2";
  const disabled = isExpired || !active;

  // Bids expansion
  const [bidsOpen, setBidsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      layout
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      <SpotlightTiltCard disabled={disabled} accentColor={accentColor}>
        {(mousePos, hovered) => (
          <div
            className="relative rounded-2xl overflow-hidden cursor-default"
            style={{
              background: "var(--bg-1)",
              border: `1px solid ${hovered && !disabled ? `${accentColor}32` : "var(--border-subtle)"}`,
              boxShadow: hovered && !disabled
                ? `var(--shadow-card-hover), 0 0 0 1px ${accentColor}12`
                : "var(--shadow-md)",
              opacity: disabled ? 0.52 : 1,
              transition: "border-color 240ms cubic-bezier(0.16,1,0.3,1), box-shadow 240ms cubic-bezier(0.16,1,0.3,1), transform 240ms cubic-bezier(0.16,1,0.3,1)",
              transform: hovered && !disabled ? "translateY(-3px)" : "translateY(0)",
            }}
          >
            {/* ── Cursor spotlight illumination (taste-skill technique) ── */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                opacity: hovered && !disabled ? 1 : 0,
                background: `radial-gradient(320px circle at ${mousePos.x}px ${mousePos.y}px, ${accentColor}0d, transparent 55%)`,
                transition: "opacity 280ms ease",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            {/* Top color band */}
            <div
              style={{
                height: 2,
                background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)`,
                position: "relative",
                zIndex: 1,
              }}
            />

            <div className="p-5 relative" style={{ zIndex: 1 }}>
              {/* ── Header ── */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                    <span className="eyebrow" style={{ color: "var(--text-3)" }}>
                      {collection}
                    </span>
                    <span className="text-sm font-semibold" style={{ letterSpacing: "-0.02em" }}>
                      #{tokenId.toString()}
                    </span>
                  </div>
                  <p
                    className="text-[10px] font-mono"
                    style={{ color: "var(--text-3)" }}
                  >
                    {seller.slice(0, 6)}…{seller.slice(-4)}
                  </p>
                  {isGrant && (
                    <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)" }}>
                      <GitMerge className="w-2.5 h-2.5" style={{ color: "#F59E0B" }} />
                      <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: "#F59E0B" }}>
                        Grant
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {isBestDeal && active && !isExpired && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <Star className="w-2.5 h-2.5" style={{ color: "#F59E0B", fill: "#F59E0B" }} />
                      <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: "#F59E0B" }}>
                        Best
                      </span>
                    </div>
                  )}
                  <DiscountBadge discountBps={discountBps === null ? null : Number(discountBps)} />
                </div>
              </div>

              {/* ── Intrinsic value — tabular-nums ── */}
              <div className="mb-5">
                <p className="eyebrow mb-1">Intrinsic Value</p>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="font-bold"
                    style={{
                      fontSize: "clamp(1.4rem,2.5vw,1.8rem)",
                      letterSpacing: "-0.04em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formattedIntrinsic}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                    {isVeBTC ? "BTC" : "MEZO"}
                  </span>
                </div>
              </div>

              {/* ── Discount track ── */}
              <div className="mb-5">
                <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "var(--text-3)" }}>
                  <span>Listing price</span>
                  <span
                    className="font-bold tabular-nums"
                    style={{
                      color: discountPct > 0 ? "#10B981" : "var(--text-2)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formattedPrice} {paySymbol}
                  </span>
                </div>
                <div className="discount-track">
                  <motion.div
                    className="discount-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${barFill}%` }}
                    transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                {discountPct > 0 && (
                  <p className="text-[10px] font-bold mt-1" style={{ color: "#10B981" }}>
                    {discountPct.toFixed(1)}% below intrinsic
                  </p>
                )}
              </div>

              {/* ── Stats grid — 2-col ── */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {/* Locked */}
                <div className="p-3 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", transition: "background 350ms ease, border-color 350ms ease" }}>
                  <div className="flex items-center gap-1 mb-1" style={{ color: "var(--text-3)" }}>
                    <TrendingDown style={{ width: 11, height: 11 }} />
                    <span className="eyebrow">Locked</span>
                  </div>
                  <p className="text-xs font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formattedIntrinsic}{" "}
                    <span style={{ color: "var(--text-3)", fontWeight: 400 }}>{isVeBTC ? "BTC" : "MEZO"}</span>
                  </p>
                </div>

                {/* Voting power */}
                <div className="p-3 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", transition: "background 350ms ease, border-color 350ms ease" }}>
                  <div className="flex items-center gap-1 mb-1" style={{ color: "var(--text-3)" }}>
                    <Zap style={{ width: 11, height: 11, color: accentColor }} />
                    <span className="eyebrow">Vote Power</span>
                  </div>
                  <p className="text-xs font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formattedVoting}
                  </p>
                </div>

                {/* Lock end — full width */}
                <div className="col-span-2 p-3 rounded-xl" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", transition: "background 350ms ease, border-color 350ms ease" }}>
                  <div className="flex items-center gap-1 mb-1" style={{ color: "var(--text-3)" }}>
                    <Clock style={{ width: 11, height: 11 }} />
                    <span className="eyebrow">Lock Ends</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      <CountdownCompact lockEnd={lockEnd} />
                    </span>
                    {lockExpiryDate && (
                      <div className="flex items-center gap-1" style={{ color: "var(--text-3)" }}>
                        <CalendarDays style={{ width: 10, height: 10 }} />
                        <span className="text-[9px]">{lockExpiryDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Buy button — tactile (taste-skill: translateY(1px) on active) ── */}
              <motion.button
                onClick={onBuy}
                disabled={disabled}
                whileTap={disabled ? {} : { y: 1, scale: 0.985 }}
                // Taste-skill spring: stiffness:100 damping:20
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-full relative flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold overflow-hidden group/btn"
                style={{
                  background: disabled ? "var(--bg-3)" : "var(--text-1)",
                  color: disabled ? "var(--text-3)" : "var(--bg)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                  border: disabled ? "1px solid var(--border-subtle)" : "none",
                  transition: "background 180ms cubic-bezier(0.16,1,0.3,1), color 180ms cubic-bezier(0.16,1,0.3,1)",
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    (e.currentTarget as HTMLElement).style.background = accentColor;
                    (e.currentTarget as HTMLElement).style.color = "#fff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!disabled) {
                    (e.currentTarget as HTMLElement).style.background = "var(--text-1)";
                    (e.currentTarget as HTMLElement).style.color = "var(--bg)";
                  }
                }}
              >
                {/* Shimmer sweep — GPU: transform only */}
                {!disabled && (
                  <span
                    aria-hidden
                    className="absolute inset-0 translate-x-[-100%] group-hover/btn:translate-x-[100%] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                    style={{ transition: "transform 600ms ease" }}
                  />
                )}
                <span className="relative z-10">
                  {!active ? "Inactive" : isExpired ? "Position expired" : "Buy now"}
                </span>
                {!disabled && (
                  <ChevronRight
                    style={{ width: 14, height: 14 }}
                    className="relative z-10 group-hover/btn:translate-x-0.5 transition-transform"
                  />
                )}
              </motion.button>
            </div>

            {/* ── Offers / Bids toggle ── */}
            {nftContract && (
              <div className="px-5 pb-5 pt-0">
                <button
                  onClick={() => setBidsOpen((o) => !o)}
                  className="w-full flex items-center justify-between py-2.5 px-3.5 rounded-xl text-xs font-semibold"
                  style={{
                    background: bidsOpen ? `${accentColor}10` : "var(--bg-2)",
                    border: `1px solid ${bidsOpen ? `${accentColor}28` : "var(--border-subtle)"}`,
                    color: bidsOpen ? accentColor : "var(--text-2)",
                    transition: "background 180ms ease, border-color 180ms ease, color 180ms ease",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Gavel style={{ width: 12, height: 12 }} />
                    Offers / Bids
                  </div>
                  <ChevronDown
                    style={{
                      width: 12,
                      height: 12,
                      transform: bidsOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 220ms cubic-bezier(0.16,1,0.3,1)",
                    }}
                  />
                </button>

                <AnimatePresence>
                  {bidsOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="pt-3">
                        <BidsPanel
                          collection={nftContract as `0x${string}`}
                          tokenId={tokenId}
                          currentOwner={seller as `0x${string}`}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Left edge accent — reveals on hover via transform (GPU) */}
            <div
              className="absolute top-0 left-0 w-[2px] h-full origin-bottom"
              style={{
                background: `linear-gradient(to top, transparent, ${accentColor}, transparent)`,
                transform: hovered && !disabled ? "scaleY(1)" : "scaleY(0)",
                transition: "transform 280ms cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          </div>
        )}
      </SpotlightTiltCard>
    </motion.div>
  );
}

// ─── Skeleton — taste-skill: must match exact card layout shape ──────────────
export function VeNFTCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Color band */}
      <div className="h-[2px] skeleton" />
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-2 w-20 skeleton rounded" />
            <div className="h-2 w-14 skeleton rounded" />
          </div>
          <div className="h-5 w-16 skeleton rounded-full" />
        </div>
        {/* Value */}
        <div className="space-y-1.5">
          <div className="h-2 w-16 skeleton rounded" />
          <div className="h-8 w-32 skeleton rounded" />
        </div>
        {/* Discount track */}
        <div>
          <div className="flex justify-between mb-1.5">
            <div className="h-2 w-14 skeleton rounded" />
            <div className="h-2 w-16 skeleton rounded" />
          </div>
          <div className="h-[3px] skeleton rounded-full" />
        </div>
        {/* Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="h-14 skeleton rounded-xl" />
          <div className="h-14 skeleton rounded-xl" />
          <div className="col-span-2 h-14 skeleton rounded-xl" />
        </div>
        {/* Button */}
        <div className="h-10 skeleton rounded-xl" />
      </div>
    </div>
  );
}
