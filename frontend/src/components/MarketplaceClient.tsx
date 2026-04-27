"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  TrendingUp,
  Zap,
  Coins,
  Filter,
  ArrowUpDown,
  Activity,
  ShieldCheck as ShieldCheckIcon,
} from "lucide-react";
import { formatEther } from "viem";
import { VeNFTCard, VeNFTCardSkeleton } from "@/components/VeNFTCard";
import { FilterSidebar } from "@/components/FilterSidebar";
import { BuyModal } from "@/components/BuyModal";
import { useMarketplace, useListing, Listing } from "@/hooks/useMarketplace";
import { getPaymentTokenSymbol } from "@/lib/tokens";

// Renders a single listing card; passes the full Listing object up on buy.
// Reports whether this listing is active so the parent can count active listings.
function MarketplaceListingItem({
  listingId,
  onBuy,
  onListingResolved,
  showInactive,
}: {
  listingId: number;
  onBuy: (listing: Listing) => void;
  onListingResolved?: (listingId: number, listing: Listing | null) => void;
  showInactive?: boolean;
}) {
  const { listing, isLoading } = useListing(listingId);

  useEffect(() => {
    if (!isLoading) {
      onListingResolved?.(listingId, listing);
    }
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

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  color = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: string;
  color?: "primary" | "accent" | "success";
}) {
  return (
    <div className="glass-card p-6 rounded-2xl relative overflow-hidden">
      <div
        className={`absolute top-0 right-0 w-16 h-16 blur-3xl opacity-10 ${
          color === "primary"
            ? "bg-mezo-primary"
            : color === "accent"
            ? "bg-mezo-accent"
            : "bg-mezo-success"
        }`}
      />
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`p-2 rounded-lg ${
            color === "primary"
              ? "bg-mezo-primary/10 text-mezo-primary"
              : color === "accent"
              ? "bg-mezo-accent/10 text-mezo-accent"
              : "bg-mezo-success/10 text-mezo-success"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-mezo-muted">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
        {trend && (
          <span className="text-[10px] font-bold text-mezo-success">{trend}</span>
        )}
      </div>
    </div>
  );
}

export default function MarketplaceClient() {
  const { nextListingId } = useMarketplace();

  const [collectionFilter, setCollectionFilter] = useState<"all" | "veBTC" | "veMEZO">("all");
  const [sortBy, setSortBy] = useState("discount");
  const [activeOnly, setActiveOnly] = useState(true);
  const [minDiscount, setMinDiscount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The listing the user clicked "Buy" on — opens BuyModal
  const [activeBuyListing, setActiveBuyListing] = useState<Listing | null>(null);
  const [listingMap, setListingMap] = useState<Record<number, Listing>>({});
  // Track IDs that have been purchased in this session. These are immediately
  // marked inactive in listingMap (optimistic update); we never let a stale
  // wagmi cache re-activate them before the chain re-read catches up.
  const [purchasedIds, setPurchasedIds] = useState<Set<number>>(new Set());

  const listingIds = useMemo(
    () => Array.from({ length: nextListingId }, (_, i) => i).reverse(),
    [nextListingId]
  );

  const handleListingResolved = useCallback((listingId: number, listing: Listing | null) => {
    if (!listing) return;
    setListingMap((prev) => {
      const existing = prev[listingId];
      // Never re-activate a listing that was purchased in this session.
      // The chain re-read will eventually confirm active=false; until then,
      // the optimistic update from onSuccess must not be overwritten by a
      // stale wagmi cache returning active=true.
      if (purchasedIds.has(listingId) && listing.active) {
        return prev;
      }
      if (
        existing &&
        existing.active === listing.active &&
        existing.collection === listing.collection &&
        existing.price === listing.price &&
        existing.discountBps === listing.discountBps &&
        existing.lockEnd === listing.lockEnd &&
        existing.paymentToken === listing.paymentToken &&
        existing.seller === listing.seller
      ) {
        return prev;
      }
      return { ...prev, [listingId]: listing };
    });
  }, [purchasedIds]);

  const searchableListings = useMemo(() => {
    return listingIds
      .map((id) => listingMap[id])
      .filter((listing): listing is Listing => !!listing);
  }, [listingIds, listingMap]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const now = Math.floor(Date.now() / 1000);

    const filtered = searchableListings.filter((listing) => {
      const collectionMatch =
        collectionFilter === "all" || listing.collection === collectionFilter;
      const activeMatch = activeOnly ? listing.active : true;
      const discountMatch =
        minDiscount === 0 ||
        (listing.discountBps !== null &&
          Number(listing.discountBps) / 100 >= minDiscount);

      const hasRemaining =
        Number(listing.lockEnd) === 0 || Number(listing.lockEnd) > now;

      const queryMatch =
        normalizedQuery.length === 0 ||
        listing.tokenId.toString().toLowerCase().includes(normalizedQuery) ||
        listing.collection.toLowerCase().includes(normalizedQuery) ||
        listing.seller.toLowerCase().includes(normalizedQuery);

      return collectionMatch && activeMatch && discountMatch && queryMatch && hasRemaining;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "price-asc") {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        return 0;
      }

      if (sortBy === "price-desc") {
        if (a.price > b.price) return -1;
        if (a.price < b.price) return 1;
        return 0;
      }

      if (sortBy === "time-remaining" || sortBy === "expiry") {
        return Number(a.lockEnd) - Number(b.lockEnd);
      }

      // Default: highest discount first.
      const aDiscount = a.discountBps ?? -999999999n;
      const bDiscount = b.discountBps ?? -999999999n;
      if (aDiscount > bDiscount) return -1;
      if (aDiscount < bDiscount) return 1;
      return 0;
    });

    return sorted;
  }, [searchableListings, searchQuery, collectionFilter, activeOnly, minDiscount, sortBy]);

  const visibleListingIds = useMemo(
    () => filteredListings.map((listing) => listing.listingId),
    [filteredListings]
  );

  // Count matches the grid exactly: filteredListings already applies activeOnly,
  // hasRemaining, discountMatch, queryMatch and collectionFilter.
  const activeCount = filteredListings.length;

  // ── Real-time market stats computed from live listing data ──────────────────
  const marketStats = useMemo(() => {
    if (nextListingId > 0 && searchableListings.length === 0) {
      return {
        veBTCFloor: "Loading...",
        veMEZOFloor: "Loading...",
        avgDiscount: "Loading...",
      };
    }

    const activeListings = searchableListings.filter((l) => l.active);

    // veBTC floor: lowest listing price among active veBTC listings
    const veBTCListings = activeListings.filter((l) => l.collection === "veBTC");
    let veBTCFloor: string = "—";
    if (veBTCListings.length > 0) {
      const minPrice = veBTCListings.reduce(
        (min, l) => (l.price < min ? l.price : min),
        veBTCListings[0].price
      );
      const sym = getPaymentTokenSymbol(veBTCListings.find((l) => l.price === minPrice)!.paymentToken);
      veBTCFloor = `${parseFloat(formatEther(minPrice)).toFixed(4)} ${sym}`;
    }

    // veMEZO floor: lowest listing price among active veMEZO listings
    const veMEZOListings = activeListings.filter((l) => l.collection === "veMEZO");
    let veMEZOFloor: string = "—";
    if (veMEZOListings.length > 0) {
      const minPrice = veMEZOListings.reduce(
        (min, l) => (l.price < min ? l.price : min),
        veMEZOListings[0].price
      );
      const sym = getPaymentTokenSymbol(veMEZOListings.find((l) => l.price === minPrice)!.paymentToken);
      // Format large MEZO amounts with k/M suffix for readability
      const val = parseFloat(formatEther(minPrice));
      const formatted =
        val >= 1_000_000
          ? `${(val / 1_000_000).toFixed(2)}M`
          : val >= 1_000
          ? `${(val / 1_000).toFixed(1)}k`
          : val.toFixed(4);
      veMEZOFloor = `${formatted} ${sym}`;
    }

    // Avg discount: average discountBps across all active listings with positive discount
    let avgDiscount: string = activeListings.length > 0 ? "N/A" : "—";
    const positiveDiscountListings = activeListings.filter(
      (l) => l.discountBps !== null && l.discountBps > 0n
    );
    if (positiveDiscountListings.length > 0) {
      const sumBps = positiveDiscountListings.reduce(
        (s, l) => s + Number(l.discountBps ?? 0n),
        0
      );
      const avgBps = sumBps / positiveDiscountListings.length;
      avgDiscount = `${(avgBps / 100).toFixed(1)}%`;
    }

    return { veBTCFloor, veMEZOFloor, avgDiscount };
  }, [nextListingId, searchableListings]);

  return (
    <>
      {/* Buy modal — rendered outside the grid so it does not inherit grid layout */}
      <BuyModal
        isOpen={!!activeBuyListing}
        onClose={() => setActiveBuyListing(null)}
        listing={activeBuyListing}
        onSuccess={(boughtListing) => {
          // Record this ID as purchased so handleListingResolved ignores
          // any stale wagmi cache returning active=true for it.
          setPurchasedIds((prev) => new Set(prev).add(boughtListing.listingId));
          // Immediately mark the purchased listing as inactive so it disappears
          // from the marketplace grid without waiting for wagmi to re-read chain.
          setListingMap((prev) => {
            const existing = prev[boughtListing.listingId];
            if (!existing) return prev;
            return { ...prev, [boughtListing.listingId]: { ...existing, active: false } };
          });
          setActiveBuyListing(null);
        }}
      />

      <div className="min-h-screen pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 text-mezo-primary mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">
                  Market Pulse
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                Secondary <span className="gradient-text">Liquidity</span>
              </h1>
              <p className="text-mezo-muted mt-2">
                Acquire locked positions from the Mezo ecosystem at market rates.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:grid grid-cols-3 gap-3">
                <StatCard icon={Coins} label="veBTC Floor" value={marketStats.veBTCFloor} />
                <StatCard
                  icon={Zap}
                  label="veMEZO Floor"
                  value={marketStats.veMEZOFloor}
                  color="accent"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg Discount"
                  value={marketStats.avgDiscount}
                  color="success"
                />
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-4 mb-8">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mezo-muted group-focus-within:text-mezo-primary transition-colors" />
              <input
                type="text"
                placeholder="Search by Token ID or Collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-mezo-card/50 border border-mezo-border rounded-2xl text-sm focus:outline-none focus:border-mezo-primary/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-2 px-6 py-4 bg-mezo-card border border-mezo-border rounded-2xl text-sm font-bold hover:bg-white/5 transition-all"
              >
                <Filter className="w-4 h-4" />
                Filters
                {minDiscount > 0 && (
                  <span className="w-2 h-2 bg-mezo-primary rounded-full" />
                )}
              </button>
              <div className="relative group">
                <ArrowUpDown className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-mezo-muted" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-12 pr-8 py-4 bg-mezo-card border border-mezo-border rounded-2xl text-sm font-bold appearance-none cursor-pointer focus:outline-none focus:border-mezo-primary/50 transition-all"
                >
                  <option value="discount">Highest Discount</option>
                  <option value="price-asc">Lowest Price</option>
                  <option value="price-desc">Highest Price</option>
                  <option value="time-remaining">Least Time Remaining</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-8">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6 px-2">
                <div className="flex items-center gap-4">
                  <p className="text-sm font-bold text-mezo-muted">
                    Showing <span className="text-white">{activeCount}</span> {activeOnly ? "active " : ""}listing{activeCount !== 1 ? "s" : ""}
                  </p>
                  <div className="h-4 w-px bg-mezo-border" />
                  <div className="flex items-center gap-2 text-mezo-success text-[10px] font-black uppercase tracking-widest">
                    <ShieldCheckIcon className="w-3 h-3" />
                    Audit Passed
                  </div>
                </div>
              </div>

              {nextListingId > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence mode="popLayout">
                    {(visibleListingIds.length > 0 || searchableListings.length > 0
                      ? visibleListingIds
                      : listingIds
                    ).map((id) => (
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
                <div className="py-32 text-center glass-card rounded-[2rem]">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="w-8 h-8 text-mezo-muted" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No active listings</h3>
                  <p className="text-mezo-muted max-w-xs mx-auto text-sm">
                    Be the first to list a veNFT and provide liquidity to the Mezo ecosystem.
                  </p>
                </div>
              )}
            </div>
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
      </div>
    </>
  );
}
