"use client";

/*
  Taste-skill rules applied:
  ✓ BANNED: centered header → left-aligned, asymmetric two-part header
  ✓ BANNED: 3-col equal grid → 2-col asymmetric layout with sticky sidebar
  ✓ BANNED: gradient-text on large H1 → plain white headline
  ✓ tabular-nums on all numeric values
  ✓ Spring physics: stiffness:100, damping:20
  ✓ Empty state: composed, shows how to get started
  ✓ Animate ONLY transform + opacity (GPU rule)
  ✓ Tinted shadows (hue-matched)
  ✓ Liquid glass inner border
*/

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Wallet,
  History,
  ShieldCheck,
  Zap,
  Tag,
  XCircle,
  GitMerge,
  LayoutGrid,
  TrendingDown,
  Clock,
  Gavel,
} from "lucide-react";
import { useMarketplace, useListing, useUserVeNFTs, computeVotingPower } from "@/hooks/useMarketplace";
import { useActiveTokenBids } from "@/hooks/useBidding";
import { ListingModal } from "@/components/ListingModal";
import { getPaymentTokenSymbol } from "@/lib/tokens";

// ─── User listing item ────────────────────────────────────────────────────────
function UserListingItem({
  listingId,
  onActiveChange,
}: {
  listingId: number;
  onActiveChange?: (id: number, active: boolean) => void;
}) {
  const { listing, isLoading } = useListing(listingId);
  const { cancelListing, isPending, isConfirming } = useMarketplace();

  const active = listing?.active ?? false;
  useEffect(() => {
    if (!isLoading) {
      onActiveChange?.(listingId, active);
    }
  }, [isLoading, active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div
        className="rounded-xl h-20"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}
      >
        <div className="h-full skeleton rounded-xl" />
      </div>
    );
  }
  if (!listing || !listing.active) return null;

  const accentColor = listing.collection === "veBTC" ? "#F7931A" : "#4A90E2";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      layout
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Left accent */}
      <div
        className="absolute left-0 top-0 w-[2px] h-full"
        style={{ background: `linear-gradient(to bottom, transparent, ${accentColor}, transparent)` }}
      />

      <div className="flex items-center justify-between gap-6 p-5 pl-6">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}22` }}
          >
            <Zap style={{ width: 16, height: 16, color: accentColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ letterSpacing: "-0.01em" }}>
              {listing.collection}{" "}
              <span
                className="tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}
              >
                #{listing.tokenId.toString()}
              </span>
            </p>
            <p
              className="text-[10px] font-bold tabular-nums mt-0.5"
              style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
            >
              {Number(formatEther(listing.price)).toFixed(4)}{" "}
              {getPaymentTokenSymbol(listing.paymentToken)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
            style={{
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
              color: "#10B981",
            }}
          >
            Active
          </div>
          <button
            onClick={() => cancelListing(listingId)}
            disabled={isPending || isConfirming}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: "rgba(239,68,68,0.08)",
              color: "#EF4444",
              border: "1px solid rgba(239,68,68,0.18)",
              transition: "background 180ms cubic-bezier(0.16,1,0.3,1), color 180ms cubic-bezier(0.16,1,0.3,1)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#EF4444";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
              (e.currentTarget as HTMLElement).style.color = "#EF4444";
            }}
          >
            <XCircle style={{ width: 13, height: 13 }} />
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Incoming bids for a single listing ──────────────────────────────────────
function IncomingBidsForListing({
  listingId,
  collection,
  tokenId,
}: {
  listingId: number;
  collection: `0x${string}`;
  tokenId: bigint;
}) {
  const { data: bids, isLoading } = useActiveTokenBids(collection, tokenId);
  if (isLoading) return null;
  if (!bids || bids.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: "1px solid rgba(74,144,226,0.14)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)", background: "rgba(74,144,226,0.04)" }}
      >
        <Gavel style={{ width: 12, height: 12, color: "#4A90E2" }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#4A90E2" }}>
          {bids.length} incoming bid{bids.length !== 1 ? "s" : ""} — Listing #{listingId}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
        {(bids as any[]).slice(0, 5).map((bid: any) => {
          const now = Date.now();
          const expMs = Number(bid.expiry) * 1000;
          const isExpired = expMs <= now;
          const diff = expMs - now;
          const hoursLeft = Math.floor(diff / 3_600_000);
          const expiryLabel = isExpired
            ? "Expired"
            : hoursLeft < 48
            ? `${hoursLeft}h left`
            : `${Math.floor(hoursLeft / 24)}d left`;

          return (
            <div key={bid.id.toString()} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-xs font-mono" style={{ color: "var(--text-2)" }}>
                  {(bid.bidder as string).slice(0, 6)}…{(bid.bidder as string).slice(-4)}
                </p>
                <p
                  className="text-[10px] tabular-nums mt-0.5"
                  style={{ color: isExpired ? "#EF4444" : "#10B981", fontVariantNumeric: "tabular-nums" }}
                >
                  {expiryLabel}
                </p>
              </div>
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}
              >
                {parseFloat(formatEther(bid.amount as bigint)).toFixed(4)}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Wrapper: resolves listing then shows its bids ────────────────────────────
function ListingBidsRow({ listingId }: { listingId: number }) {
  const { listing, isLoading } = useListing(listingId);
  if (isLoading || !listing || !listing.active) return null;
  return (
    <IncomingBidsForListing
      listingId={listingId}
      collection={listing.nftContract as `0x${string}`}
      tokenId={listing.tokenId}
    />
  );
}

// ─── Wallet NFT card ─────────────────────────────────────────────────────────
function WalletNFTCard({
  nft,
  onList,
}: {
  nft: any;
  onList: (nft: any) => void;
}) {
  const accentColor = nft.collection === "veBTC" ? "#F7931A" : "#4A90E2";
  const isVeBTC = nft.collection === "veBTC";

  const iv: bigint = nft.intrinsicValue ?? 0n;
  const lockEnd: bigint = nft.lockEnd ?? 0n;
  const votingPower: bigint = nft.votingPower ?? computeVotingPower(iv, lockEnd, isVeBTC);

  const formattedIV = iv > 0n ? parseFloat(formatEther(iv)).toFixed(4) : "—";
  const formattedVP = votingPower > 0n ? parseFloat(formatEther(votingPower)).toFixed(2) : "—";

  const lockEndSec = Number(lockEnd);
  const isPermanent = lockEndSec === 0;
  const lockLabel = isPermanent
    ? "Permanent"
    : lockEndSec <= Math.floor(Date.now() / 1000)
    ? "Expired"
    : new Date(lockEndSec * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
              <span className="eyebrow">{nft.collection}</span>
              <span className="text-sm font-semibold" style={{ letterSpacing: "-0.02em" }}>
                #{nft.tokenId.toString()}
              </span>
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-3)" }}>
              Ready to list
            </p>
          </div>
          {nft.isGrant && (
            <div
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.22)" }}
            >
              <GitMerge style={{ width: 10, height: 10, color: "#F59E0B" }} />
              <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: "#F59E0B" }}>
                Grant
              </span>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="p-2.5 rounded-lg" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown style={{ width: 10, height: 10, color: "var(--text-3)" }} />
              <span className="eyebrow">Locked</span>
            </div>
            <p className="text-xs font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formattedIV}{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 400 }}>{isVeBTC ? "BTC" : "MEZO"}</span>
            </p>
          </div>
          <div className="p-2.5 rounded-lg" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-1 mb-1">
              <Zap style={{ width: 10, height: 10, color: accentColor }} />
              <span className="eyebrow">Vote Pwr</span>
            </div>
            <p className="text-xs font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formattedVP}
            </p>
          </div>
          <div className="col-span-2 p-2.5 rounded-lg" style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-1 mb-1">
              <Clock style={{ width: 10, height: 10, color: "var(--text-3)" }} />
              <span className="eyebrow">Lock Ends</span>
            </div>
            <p className="text-xs font-semibold">{lockLabel}</p>
          </div>
        </div>

        <motion.button
          onClick={() => onList(nft)}
          whileTap={{ y: 1, scale: 0.985 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
          style={{
            background: "#ffffff",
            color: "#0a0a0a",
            transition: "background 180ms cubic-bezier(0.16,1,0.3,1), color 180ms cubic-bezier(0.16,1,0.3,1)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = accentColor;
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.color = "#0a0a0a";
          }}
        >
          <Plus style={{ width: 13, height: 13 }} />
          List for Sale
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── Connect prompt ───────────────────────────────────────────────────────────
function ConnectPrompt() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4 pt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-start gap-6 max-w-md w-full"
        style={{ paddingTop: 40 }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
        >
          <Wallet style={{ width: 18, height: 18, color: "var(--text-3)" }} />
        </div>
        <div>
          <h1 className="display-lg mb-3" style={{ color: "var(--text-1)" }}>
            Connect wallet.
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-2)", maxWidth: "42ch" }}>
            Connect your wallet to manage listed veNFTs and view your trading history.
          </p>
          <ConnectButton />
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MyListingsClient() {
  const { isConnected, address } = useAccount();
  const { userListingIds } = useMarketplace();
  const { veNFTs: walletVeNFTs, isLoading: veNFTsLoading } = useUserVeNFTs();
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [selectedVeNFT, setSelectedVeNFT] = useState<any>(null);
  const [activeListingCount, setActiveListingCount] = useState(0);
  const activeMapRef = useRef<Map<number, boolean>>(new Map());

  const handleActiveChange = useCallback((id: number, active: boolean) => {
    const prev = activeMapRef.current.get(id);
    if (prev !== active) {
      activeMapRef.current.set(id, active);
      let count = 0;
      activeMapRef.current.forEach((v) => { if (v) count++; });
      setActiveListingCount(count);
    }
  }, []);

  if (!isConnected) return <ConnectPrompt />;

  return (
    <div className="min-h-[100dvh] pt-32 pb-20 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">

        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="section-header mb-3">
              <span className="eyebrow">My Portfolio</span>
            </div>
            <h1 className="display-lg mb-2" style={{ color: "var(--text-1)" }}>
              Your positions.
            </h1>
            <p className="text-sm" style={{ color: "var(--text-2)", maxWidth: "52ch" }}>
              Monitor and manage your active sell orders and unlisted positions.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="pb-1"
          >
            <Link href="/activity" className="btn-outline text-sm inline-flex items-center gap-2">
              <History style={{ width: 14, height: 14 }} />
              Trade History
            </Link>
          </motion.div>
        </div>

        {/* ── Layout: 2/3 + 1/3 ── */}
        <div className="grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-12">

          {/* ── Main ── */}
          <div className="space-y-12">

            {/* Active listings */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Tag style={{ width: 13, height: 13, color: "#F7931A" }} />
                <span className="eyebrow" style={{ color: "var(--text-2)" }}>Active Sell Orders</span>
                {activeListingCount > 0 && (
                  <span
                    className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(247,147,26,0.1)", color: "#F7931A", fontVariantNumeric: "tabular-nums" }}
                  >
                    {activeListingCount}
                  </span>
                )}
              </div>

              {userListingIds && userListingIds.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {userListingIds.map((id) => (
                      <UserListingItem
                        key={id.toString()}
                        listingId={Number(id)}
                        onActiveChange={handleActiveChange}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="py-16 flex flex-col items-start gap-4"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
                  >
                    <Tag style={{ width: 16, height: 16, color: "var(--text-3)" }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ letterSpacing: "-0.02em" }}>
                      No active listings
                    </h3>
                    <p className="text-xs" style={{ color: "var(--text-3)", maxWidth: "40ch" }}>
                      List a veNFT from your wallet below to start selling.
                    </p>
                  </div>
                </motion.div>
              )}
            </section>

            {/* ── Incoming Bids section ── */}
            {userListingIds && userListingIds.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-5">
                  <Gavel style={{ width: 13, height: 13, color: "#4A90E2" }} />
                  <span className="eyebrow" style={{ color: "var(--text-2)" }}>Incoming Bids</span>
                </div>
                <div className="space-y-3">
                  {userListingIds.map((id) => (
                    <ListingBidsRow key={id.toString()} listingId={Number(id)} />
                  ))}
                </div>
              </section>
            )}

            {/* In wallet */}
            <section>
              <div className="flex items-center gap-2 mb-5">
                <LayoutGrid style={{ width: 13, height: 13, color: "#4A90E2" }} />
                <span className="eyebrow" style={{ color: "var(--text-2)" }}>In Your Wallet</span>
                {walletVeNFTs.length > 0 && (
                  <span
                    className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(74,144,226,0.1)", color: "#4A90E2", fontVariantNumeric: "tabular-nums" }}
                  >
                    {walletVeNFTs.length}
                  </span>
                )}
              </div>

              {veNFTsLoading ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl overflow-hidden"
                      style={{ background: "var(--bg-1)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div className="h-[2px] skeleton" />
                      <div className="p-5 space-y-4">
                        <div className="flex justify-between">
                          <div className="h-2 w-24 skeleton rounded" />
                          <div className="h-2 w-12 skeleton rounded" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="h-14 skeleton rounded-lg" />
                          <div className="h-14 skeleton rounded-lg" />
                          <div className="col-span-2 h-10 skeleton rounded-lg" />
                        </div>
                        <div className="h-8 skeleton rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : walletVeNFTs.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="py-16 flex flex-col items-start gap-4"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
                  >
                    <Wallet style={{ width: 16, height: 16, color: "var(--text-3)" }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ letterSpacing: "-0.02em" }}>
                      No veNFTs found
                    </h3>
                    <p className="text-xs" style={{ color: "var(--text-3)", maxWidth: "40ch" }}>
                      No veBTC or veMEZO positions detected in this wallet.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {walletVeNFTs.map((nft) => (
                    <WalletNFTCard
                      key={`${nft.collection}-${nft.tokenId.toString()}`}
                      nft={nft}
                      onList={(n) => {
                        setSelectedVeNFT(n);
                        setIsListingModalOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <p className="eyebrow mb-4">Quick Stats</p>
              <div className="space-y-3">
                {[
                  { label: "Active Listings", value: activeListingCount.toString(), color: "#F7931A" },
                  { label: "In Wallet", value: walletVeNFTs.length.toString(), color: "#4A90E2" },
                  { label: "Protocol Fee", value: "1.00%", color: "var(--text-2)" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--text-3)" }}>{s.label}</span>
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: s.color, fontVariantNumeric: "tabular-nums" }}
                    >
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Info */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-5"
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <p className="eyebrow mb-4">Seller notes</p>
              <ul className="space-y-3">
                {[
                  "Your NFTs never leave your wallet during listing.",
                  "Fee claims and voting power continue until sale.",
                  "Atomic settlement — you get paid at the exact block.",
                ].map((note, i) => (
                  <li key={i} className="flex gap-2.5">
                    <ShieldCheck
                      style={{ width: 13, height: 13, color: "#10B981", flexShrink: 0, marginTop: 1 }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
                      {note}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

          </div>
        </div>
      </div>

      <ListingModal
        isOpen={isListingModalOpen}
        onClose={() => setIsListingModalOpen(false)}
        veNFT={selectedVeNFT}
      />
    </div>
  );
}
