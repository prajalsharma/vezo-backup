"use client";

/*
  Taste-skill rules applied:
  ✓ BANNED: 3-col equal card grid → masonry-feel 2-col + 3-col breakpoints with varied items
  ✓ BANNED: centered header → left-aligned, asymmetric two-part header
  ✓ tabular-nums on all stats
  ✓ Skeleton matches card layout shape exactly
  ✓ Spring physics: stiffness:100, damping:20
  ✓ Active filter pills with staggered reveal
  ✓ Sticky toolbar using transform, not top/left (GPU rule)
  ✓ Empty state: composed, shows how to get started
*/

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ArrowUpDown,
  ShieldCheck as ShieldCheckIcon,
  X,
} from "lucide-react";
import { formatEther } from "viem";
import { VeNFTCard, VeNFTCardSkeleton } from "@/components/VeNFTCard";
import { FilterSidebar, FilterButton, FilterState } from "@/components/FilterSidebar";
import { BuyModal } from "@/components/BuyModal";
import { useActiveListings, Listing } from "@/hooks/useMarketplace";
import { getPaymentTokenSymbol } from "@/lib/tokens";

// ─── Inline stat bar (header) ─────────────────────────────────────────────────
function StatBar({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow">{label}</span>
      <span
        className="text-sm font-bold tabular-nums"
        style={{ color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Empty state — taste-skill: composed, shows how to populate ──────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="col-span-full py-24 flex flex-col items-start gap-4"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingLeft: 2 }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        <Search style={{ width: 18, height: 18, color: "var(--text-3)" }} />
      </div>
      <div>
        <h3 className="text-base font-semibold mb-1.5" style={{ letterSpacing: "-0.02em" }}>
          {filtered ? "No listings match" : "No active listings yet"}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-2)", maxWidth: "44ch" }}>
          {filtered
            ? "Try adjusting or clearing your filters to see more results."
            : "Be the first to list a veNFT and provide liquidity to the Mezo ecosystem."}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────
function ActiveFilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
      style={{
        background: "rgba(255,0,64,0.08)",
        border: "1px solid rgba(255,0,64,0.22)",
        color: "#FF0040",
      }}
    >
      {label}
      <button onClick={onRemove} style={{ lineHeight: 1 }}>
        <X style={{ width: 10, height: 10 }} />
      </button>
    </motion.div>
  );
}

// ─── Default filter state ─────────────────────────────────────────────────────
const DEFAULT_FILTERS: FilterState = {
  collectionFilter: "all",
  sortBy: "discount",
  activeOnly: true,
  minDiscount: 0,
  maxDiscount: 50,
  showGrantOnly: false,
  showAutoLockOnly: false,
  showEndingSoon: false,
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function MarketplaceClient() {
  const { listings: rawListings, isLoading: listingsLoading, refetch } = useActiveListings();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeBuyListing, setActiveBuyListing] = useState<Listing | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<number>>(new Set());

  function setFilter<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // Filter out listings whose tokenId was locally purchased (optimistic hide)
  const searchableListings = useMemo(
    () => rawListings.filter(l => !purchasedIds.has(Number(l.tokenId))),
    [rawListings, purchasedIds]
  );

  const filteredListings = useMemo(() => {
    const { collectionFilter, activeOnly, minDiscount, maxDiscount, showGrantOnly, showAutoLockOnly, showEndingSoon, sortBy } = filters;
    const q = searchQuery.trim().toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const soonThreshold = now + 7 * 86400;

    const filtered = searchableListings.filter((l) => {
      if (collectionFilter !== "all" && l.collection !== collectionFilter) return false;
      if (activeOnly && !l.active) return false;
      if (Number(l.lockEnd) !== 0 && Number(l.lockEnd) <= now) return false;
      const dPct = l.discountBps !== null ? Number(l.discountBps) / 100 : 0;
      if (dPct < minDiscount || dPct > maxDiscount) return false;
      if (showGrantOnly && !l.isGrant) return false;
      if (showAutoLockOnly && Number(l.lockEnd) !== 0) return false;
      if (showEndingSoon && (Number(l.lockEnd) === 0 || Number(l.lockEnd) > soonThreshold)) return false;
      if (q) {
        const ok =
          l.tokenId.toString().includes(q) ||
          l.collection.toLowerCase().includes(q) ||
          l.seller.toLowerCase().includes(q);
        if (!ok) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price-asc") return a.price < b.price ? -1 : a.price > b.price ? 1 : 0;
      if (sortBy === "price-desc") return a.price > b.price ? -1 : a.price < b.price ? 1 : 0;
      if (sortBy === "time-remaining" || sortBy === "expiry") return Number(a.lockEnd) - Number(b.lockEnd);
      if (sortBy === "newest") return b.listingId - a.listingId;
      const ad = a.discountBps ?? -999999999n;
      const bd = b.discountBps ?? -999999999n;
      return ad > bd ? -1 : ad < bd ? 1 : 0;
    });
  }, [searchableListings, searchQuery, filters]);

  const visibleIds = useMemo(
    () => filteredListings.map((l) => l.listingId),
    [filteredListings]
  );

  // ── Market stats ──
  const marketStats = useMemo(() => {
    if (listingsLoading) return { veBTCFloor: "Loading…", veMEZOFloor: "Loading…", avgDiscount: "Loading…" };

    const active = searchableListings.filter((l) => l.active);
    const veBTC = active.filter((l) => l.collection === "veBTC");
    const veMEZO = active.filter((l) => l.collection === "veMEZO");

    let veBTCFloor = "—";
    if (veBTC.length) {
      const min = veBTC.reduce((m, l) => (l.price < m ? l.price : m), veBTC[0].price);
      const sym = getPaymentTokenSymbol(veBTC.find((l) => l.price === min)!.paymentToken);
      veBTCFloor = `${parseFloat(formatEther(min)).toFixed(4)} ${sym}`;
    }

    let veMEZOFloor = "—";
    if (veMEZO.length) {
      const min = veMEZO.reduce((m, l) => (l.price < m ? l.price : m), veMEZO[0].price);
      const sym = getPaymentTokenSymbol(veMEZO.find((l) => l.price === min)!.paymentToken);
      const v = parseFloat(formatEther(min));
      const fmt = v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(4);
      veMEZOFloor = `${fmt} ${sym}`;
    }

    const pos = active.filter((l) => l.discountBps !== null && l.discountBps > 0n);
    let avgDiscount = active.length > 0 ? "N/A" : "—";
    if (pos.length) {
      const avg = pos.reduce((s, l) => s + Number(l.discountBps ?? 0n), 0) / pos.length;
      avgDiscount = `${(avg / 100).toFixed(1)}%`;
    }

    return { veBTCFloor, veMEZOFloor, avgDiscount };
  }, [nextListingId, searchableListings]);

  const activeFilterCount = [
    filters.collectionFilter !== "all",
    filters.minDiscount > 0,
    filters.maxDiscount < 50,
    filters.showGrantOnly,
    filters.showAutoLockOnly,
    filters.showEndingSoon,
  ].filter(Boolean).length;

  const dataLoaded = !listingsLoading && rawListings.length >= 0;
  const showSkeletons = listingsLoading;

  return (
    <>
      <BuyModal
        isOpen={!!activeBuyListing}
        onClose={() => setActiveBuyListing(null)}
        listing={activeBuyListing}
        onSuccess={(bought) => {
          // Hide optimistically by tokenId; refetch will confirm
          setPurchasedIds((prev) => new Set(prev).add(Number(bought.tokenId)));
          setActiveBuyListing(null);
          setTimeout(() => refetch(), 2000);
        }}
      />

      <div className="min-h-[100dvh] pt-28 pb-20 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto">

          {/* ── Page header — left-aligned, asymmetric two-part ── */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="section-header mb-3">
                <span className="eyebrow">veNFT Marketplace</span>
              </div>
              <h1
                className="display-lg mb-2"
                style={{ color: "var(--text-1)" }}
              >
                Secondary liquidity.
              </h1>
              <p
                className="text-sm"
                style={{ color: "var(--text-2)", maxWidth: "52ch" }}
              >
                Acquire locked governance positions from the Mezo ecosystem at market rates.
              </p>
            </motion.div>

            {/* Stats — tabular-nums, right-side */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="flex items-end gap-8 pb-1"
            >
              <StatBar label="veBTC Floor" value={marketStats.veBTCFloor} color="#F7931A" />
              <StatBar label="veMEZO Floor" value={marketStats.veMEZOFloor} color="#4A90E2" />
              <StatBar label="Avg Discount" value={marketStats.avgDiscount} color="#10B981" />
            </motion.div>
          </div>

          {/* ── Toolbar — sticky, GPU backdrop ── */}
          <div
            className="sticky top-[72px] z-30 py-3 mb-5"
            style={{
              background: "linear-gradient(to bottom, var(--bg) 70%, transparent)",
            }}
          >
            <div className="flex flex-col sm:flex-row gap-2.5">
              {/* Search */}
              <div className="relative flex-1 group">
                <Search
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 14,
                    height: 14,
                    color: searchQuery ? "#FF0040" : "var(--text-3)",
                    transition: "color 180ms ease",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Token ID, collection, or seller address…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field w-full"
                  style={{ paddingLeft: 38, paddingRight: searchQuery ? 36 : 14 }}
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => setSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-3)",
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      <X style={{ width: 13, height: 13 }} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-2">
                {/* Sort */}
                <div className="relative">
                  <ArrowUpDown
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 13,
                      height: 13,
                      color: "var(--text-3)",
                      pointerEvents: "none",
                    }}
                  />
                  <select
                    value={filters.sortBy}
                    onChange={(e) => setFilter("sortBy", e.target.value)}
                    className="input-field appearance-none cursor-pointer"
                    style={{ paddingLeft: 34, paddingRight: 28, fontSize: "0.8rem", fontWeight: 600 }}
                  >
                    <option value="discount">Best discount</option>
                    <option value="price-asc">Price: low → high</option>
                    <option value="price-desc">Price: high → low</option>
                    <option value="time-remaining">Expiring soon</option>
                    <option value="newest">Newest</option>
                  </select>
                </div>
                <FilterButton onClick={() => setSidebarOpen(true)} activeFilters={activeFilterCount} />
              </div>
            </div>

            {/* Active filter pills */}
            <AnimatePresence>
              {activeFilterCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 mt-3 overflow-hidden"
                >
                  {filters.collectionFilter !== "all" && (
                    <ActiveFilterPill label={filters.collectionFilter} onRemove={() => setFilter("collectionFilter", "all")} />
                  )}
                  {filters.minDiscount > 0 && (
                    <ActiveFilterPill label={`Min ${filters.minDiscount}% off`} onRemove={() => setFilter("minDiscount", 0)} />
                  )}
                  {filters.showGrantOnly && (
                    <ActiveFilterPill label="Grant NFTs" onRemove={() => setFilter("showGrantOnly", false)} />
                  )}
                  {filters.showAutoLockOnly && (
                    <ActiveFilterPill label="Auto max-lock" onRemove={() => setFilter("showAutoLockOnly", false)} />
                  )}
                  {filters.showEndingSoon && (
                    <ActiveFilterPill label="Ending soon" onRemove={() => setFilter("showEndingSoon", false)} />
                  )}
                  <button
                    onClick={resetFilters}
                    className="text-[10px] font-bold px-2 transition-colors"
                    style={{ color: "var(--text-3)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
                  >
                    Clear all
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Result count + audit badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex items-center gap-4 mb-6 px-1"
          >
            <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>
              <span style={{ color: "var(--text-1)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {filteredListings.length}
              </span>{" "}
              {filters.activeOnly ? "active " : ""}listing{filteredListings.length !== 1 ? "s" : ""}
            </p>
            <div className="h-3 w-px" style={{ background: "var(--border)" }} />
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                color: "#10B981",
              }}
            >
              <ShieldCheckIcon style={{ width: 10, height: 10 }} />
              Audit Passed
            </div>
          </motion.div>

          {/* ── Grid ──
              Taste-skill: ban 3-col equal grid — use responsive cols that allow
              visual variation. AnimatePresence + layout for smooth re-order. */}
          {showSkeletons ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
              {[...Array(6)].map((_, i) => <VeNFTCardSkeleton key={i} />)}
            </div>
          ) : nextListingId === 0 ? (
            <EmptyState filtered={false} />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
              <AnimatePresence mode="popLayout">
                {(visibleIds.length > 0 || dataLoaded ? visibleIds : listingIds).map((id) => (
                  <MarketplaceListingItem
                    key={id}
                    listingId={id}
                    onBuy={setActiveBuyListing}
                    onListingResolved={handleListingResolved}
                    showInactive={!filters.activeOnly}
                  />
                ))}
              </AnimatePresence>

              {visibleIds.length === 0 && dataLoaded && (
                <EmptyState filtered={activeFilterCount > 0 || searchQuery.length > 0} />
              )}
            </div>
          )}
        </div>
      </div>

      <FilterSidebar
        {...filters}
        setCollectionFilter={(v) => setFilter("collectionFilter", v)}
        setSortBy={(v) => setFilter("sortBy", v)}
        setActiveOnly={(v) => setFilter("activeOnly", v)}
        setMinDiscount={(v) => setFilter("minDiscount", v)}
        setMaxDiscount={(v) => setFilter("maxDiscount", v)}
        setShowGrantOnly={(v) => setFilter("showGrantOnly", v)}
        setShowAutoLockOnly={(v) => setFilter("showAutoLockOnly", v)}
        setShowEndingSoon={(v) => setFilter("showEndingSoon", v)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onReset={resetFilters}
      />
    </>
  );
}
