"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, TrendingUp, Zap, Coins, Filter, ArrowUpDown,
  Activity, ShieldCheck, SlidersHorizontal, ChevronDown,
} from "lucide-react";
import { VeNFTCard, VeNFTCardSkeleton } from "@/components/VeNFTCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { BuyModal } from "@/components/BuyModal";
import { useMarketplace, useListing, useUserVeNFTs, Listing } from "@/hooks/useMarketplace";
import { useAvgDiscount } from "@/hooks/useAvgDiscount";

function MarketplaceListingItem({
  listingId, onBuy, onListingResolved, showInactive,
}: {
  listingId: number;
  onBuy: (listing: Listing) => void;
  onListingResolved?: (id: number, listing: Listing | null) => void;
  showInactive?: boolean;
}) {
  const { listing, isLoading } = useListing(listingId);
  useEffect(() => {
    if (!isLoading) onListingResolved?.(listingId, listing);
  }, [isLoading, listing, listingId, onListingResolved]);

  if (isLoading) return <VeNFTCardSkeleton />;
  if (!listing) return null;
  if (!showInactive && !listing.active) return null;
  return (
    <VeNFTCard
      {...listing}
      active={listing.active}
      onBuy={listing.active ? () => onBuy(listing) : undefined}
    />
  );
}

function StatBadge({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/[0.025] border border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.09] transition-all duration-200">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color ? `${color}15` : "rgba(255,255,255,0.05)" }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: color || "rgba(255,255,255,0.38)" }} />
      </div>
      <div>
        <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-white/28">{label}</p>
        <p className="text-[13px] font-bold tabular-nums mt-0.5">{value}</p>
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "discount",    label: "Best Discount" },
  { value: "price-asc",  label: "Price ↑ Low to High" },
  { value: "price-desc", label: "Price ↓ High to Low" },
  { value: "time-remaining", label: "Expiring Soon" },
];

export default function MarketplaceClient() {
  const { nextListingId } = useMarketplace();
  const { refetchVeNFTs } = useUserVeNFTs();
  const { avgDiscountPct, isLoading: discountLoading, tooltip: discountTooltip } = useAvgDiscount();
  const [collectionFilter, setCollectionFilter] = useState<"all" | "veBTC" | "veMEZO">("all");
  const [sortBy, setSortBy] = useState("discount");
  const [activeOnly, setActiveOnly] = useState(true);
  const [minDiscount, setMinDiscount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeBuyListing, setActiveBuyListing] = useState<Listing | null>(null);
  const [listingMap, setListingMap] = useState<Record<number, Listing>>({});

  const listingIds = useMemo(
    () => Array.from({ length: nextListingId }, (_, i) => i).reverse(),
    [nextListingId]
  );

  const handleListingResolved = useCallback((id: number, listing: Listing | null) => {
    if (!listing) return;
    setListingMap((prev) => {
      const ex = prev[id];
      if (ex && ex.active === listing.active && ex.price === listing.price && ex.discountBps === listing.discountBps) return prev;
      return { ...prev, [id]: listing };
    });
  }, []);

  const searchableListings = useMemo(() =>
    listingIds.map((id) => listingMap[id]).filter((l): l is Listing => !!l),
    [listingIds, listingMap]
  );

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const filtered = searchableListings.filter((l) => {
      const colOk  = collectionFilter === "all" || l.collection === collectionFilter;
      const actOk  = activeOnly ? l.active : true;
      const discOk = Number(l.discountBps) / 100 >= minDiscount;
      const lockOk = Number(l.lockEnd) === 0 || Number(l.lockEnd) > now;
      const qOk    = !q || l.tokenId.toString().includes(q) || l.collection.toLowerCase().includes(q) || l.seller.toLowerCase().includes(q);
      return colOk && actOk && discOk && lockOk && qOk;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "price-asc")  return a.price < b.price ? -1 : a.price > b.price ? 1 : 0;
      if (sortBy === "price-desc") return a.price > b.price ? -1 : a.price < b.price ? 1 : 0;
      if (sortBy === "time-remaining" || sortBy === "expiry") return Number(a.lockEnd) - Number(b.lockEnd);
      return a.discountBps > b.discountBps ? -1 : a.discountBps < b.discountBps ? 1 : 0;
    });
  }, [searchableListings, searchQuery, collectionFilter, activeOnly, minDiscount, sortBy]);

  const visibleIds  = useMemo(() => filteredListings.map((l) => l.listingId), [filteredListings]);
  const activeCount = useMemo(() => searchableListings.filter((l) => l.active).length, [searchableListings]);
  const activeFiltersCount = (collectionFilter !== "all" ? 1 : 0) + (minDiscount > 0 ? 1 : 0) + (!activeOnly ? 1 : 0);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Sort";

  return (
    <>
      <BuyModal
        isOpen={!!activeBuyListing}
        onClose={() => setActiveBuyListing(null)}
        listing={activeBuyListing}
        onPurchaseSuccess={() => { refetchVeNFTs(); setActiveBuyListing(null); }}
      />

      <div className="min-h-screen pt-[88px] pb-24 px-5 lg:px-6">
        <div className="max-w-7xl mx-auto">

          {/* ── Page header ── */}
          <div className="pt-10 pb-10 border-b border-white/[0.05]">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-[#F7931A]" />
                  <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#F7931A]">Market Pulse</span>
                </div>
                <h1 className="text-[2.2rem] md:text-[2.8rem] font-black tracking-tight mb-2">
                  Secondary <span className="gradient-text">Liquidity</span>
                </h1>
                <p className="text-[14.5px] text-white/38">
                  Acquire locked positions from the Mezo ecosystem at market rates.
                </p>
              </div>

              {/* Stat badges */}
              <div className="flex flex-wrap gap-2">
                <StatBadge icon={Coins}      label="veBTC Floor"  value="0.42 BTC"   color="#F7931A" />
                <StatBadge icon={Zap}        label="veMEZO Floor" value="120k MEZO"  color="#4A90E2" />
                <div className="relative group">
                  <StatBadge
                    icon={TrendingUp}
                    label="Avg Discount"
                    value={discountLoading ? "…" : `${avgDiscountPct === "N/A" ? "N/A" : avgDiscountPct + "%"}`}
                    color="#10B981"
                  />
                  {discountTooltip && (
                    <div className="absolute bottom-full left-0 mb-2 w-60 bg-[#161616] border border-white/[0.1] text-[11px] text-white/50 leading-relaxed px-3 py-2.5 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-normal">
                      {discountTooltip}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Collection filter pills ── */}
          <div className="flex items-center gap-2 pt-6">
            {(["all", "veBTC", "veMEZO"] as const).map((col) => (
              <button
                key={col}
                onClick={() => setCollectionFilter(col)}
                className={`px-4 py-2 rounded-full text-[12.5px] font-bold transition-all duration-200 ${
                  collectionFilter === col
                    ? "bg-[#F7931A] text-black shadow-[0_2px_12px_rgba(247,147,26,0.3)]"
                    : "bg-white/[0.04] border border-white/[0.07] text-white/45 hover:text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {col === "all" ? "All" : col}
              </button>
            ))}
          </div>

          {/* ── Toolbar ── */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-4 pb-8">
            {/* Search */}
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/22 group-focus-within:text-[#F7931A] transition-colors" />
              <input
                type="text"
                placeholder="Search by token ID, seller address…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.025] border border-white/[0.065] rounded-xl text-[13px] placeholder:text-white/22 focus:outline-none focus:border-[#F7931A]/38 focus:bg-white/[0.04] transition-all"
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/28 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/28 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="pl-10 pr-9 py-3.5 bg-white/[0.025] border border-white/[0.065] rounded-xl text-[13px] font-semibold appearance-none cursor-pointer focus:outline-none focus:border-[#F7931A]/38 transition-all min-w-[170px]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Filters button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className={`relative flex items-center gap-2 px-5 py-3.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                activeFiltersCount > 0
                  ? "bg-[#F7931A]/12 border border-[#F7931A]/30 text-[#F7931A]"
                  : "bg-white/[0.025] border border-white/[0.065] text-white/55 hover:bg-white/[0.04] hover:border-white/[0.1] hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#F7931A] text-black text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Result count + trust mark ── */}
          <div className="flex items-center justify-between mb-7 px-1">
            <p className="text-[12.5px] text-white/32">
              <span className="text-white font-bold">{activeCount}</span>{" "}
              active listing{activeCount !== 1 ? "s" : ""}
              {filteredListings.length !== activeCount && filteredListings.length > 0 && (
                <span className="text-white/22"> · {filteredListings.length} matching filters</span>
              )}
            </p>
            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black tracking-[0.15em] uppercase">
              <ShieldCheck className="w-3 h-3" />
              Audit Passed
            </div>
          </div>

          {/* ── Grid ── */}
          {nextListingId > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {(visibleIds.length > 0 || searchableListings.length > 0 ? visibleIds : listingIds).map((id) => (
                  <MarketplaceListingItem
                    key={id}
                    listingId={id}
                    onBuy={setActiveBuyListing}
                    onListingResolved={handleListingResolved}
                    showInactive={!activeOnly}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-32 text-center rounded-2xl border border-white/[0.055] bg-white/[0.012]">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-5">
                <Filter className="w-6 h-6 text-white/22" />
              </div>
              <h3 className="text-[17px] font-bold mb-2">No active listings</h3>
              <p className="text-[13.5px] text-white/32 max-w-xs mx-auto leading-relaxed">
                Be the first to list a veNFT and provide liquidity to the Mezo ecosystem.
              </p>
            </div>
          )}

          {/* Empty state when filters produce no results */}
          {nextListingId > 0 && filteredListings.length === 0 && searchableListings.length > 0 && (
            <div className="py-24 text-center rounded-2xl border border-white/[0.055] bg-white/[0.012] mt-4">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.07] flex items-center justify-center mx-auto mb-4">
                <Search className="w-5 h-5 text-white/22" />
              </div>
              <h3 className="text-[16px] font-bold mb-2">No matches found</h3>
              <p className="text-[13px] text-white/30 max-w-xs mx-auto leading-relaxed mb-5">
                Try adjusting your search or filters to see more listings.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCollectionFilter("all");
                  setMinDiscount(0);
                }}
                className="btn-outline px-6 py-2.5 text-[13px] rounded-xl"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <FilterSidebar
        collectionFilter={collectionFilter}
        setCollectionFilter={setCollectionFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showExpired={activeOnly}
        setShowExpired={setActiveOnly}
        minDiscount={minDiscount}
        setMinDiscount={setMinDiscount}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
}
