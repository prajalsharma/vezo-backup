"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Wallet,
  LayoutList,
  Info,
  Lightbulb,
  History,
  ShieldCheck,
  Zap,
  Tag,
  XCircle,
  ArrowRight,
  GitMerge
} from "lucide-react";
import { useMarketplace, useListing, useUserVeNFTs } from "@/hooks/useMarketplace";
import { ListingModal } from "@/components/ListingModal";
import { getPaymentTokenSymbol } from "@/lib/tokens";

function UserListingItem({
  listingId,
  onActiveChange,
}: {
  listingId: number;
  onActiveChange?: (id: number, active: boolean) => void;
}) {
  const { listing, isLoading } = useListing(listingId);
  const { cancelListing, isPending, isConfirming } = useMarketplace();

  // Report active state to parent once data is loaded
  const active = listing?.active ?? false;
  useEffect(() => {
    if (!isLoading) {
      onActiveChange?.(listingId, active);
    }
  }, [isLoading, active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="h-24 bg-white/5 animate-pulse rounded-2xl" />;
  if (!listing || !listing.active) return null;

  return (
    <div className="glass-card p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:bg-white/[0.04] transition-all">
      <div className="flex items-center gap-6">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${listing.collection === 'veBTC' ? 'bg-mezo-primary/20 text-mezo-primary' : 'bg-mezo-accent/20 text-mezo-accent'}`}>
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-bold text-lg">{listing.collection} #{listing.tokenId.toString()}</h4>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-bold text-mezo-muted uppercase tracking-widest">Price:</span>
            <span className="text-sm font-black text-white">
              {Number(formatEther(listing.price)).toFixed(4)} {getPaymentTokenSymbol(listing.paymentToken)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="hidden lg:block text-right mr-4">
          <p className="text-[10px] text-mezo-muted font-bold uppercase tracking-widest mb-1">Status</p>
          <span className="text-xs font-bold text-mezo-success bg-mezo-success/10 px-2 py-1 rounded-md">Active</span>
        </div>
        <button
          onClick={() => cancelListing(listingId)}
          disabled={isPending || isConfirming}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold transition-all disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Cancel Listing
        </button>
      </div>
    </div>
  );
}

export default function MyListingsClient() {
  const { isConnected, address } = useAccount();
  const { userListingIds } = useMarketplace();
  const { veNFTs: walletVeNFTs, isLoading: veNFTsLoading } = useUserVeNFTs();
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [selectedVeNFT, setSelectedVeNFT] = useState<any>(null);
  // Track how many of the user's listings are currently active on-chain.
  // getUserListings returns all historical IDs; we count only active ones.
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

  if (!isConnected) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 pt-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 rounded-[2.5rem] text-center max-w-md w-full"
        >
          <div className="w-20 h-20 bg-mezo-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <Wallet className="w-10 h-10 text-mezo-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-mezo-muted mb-10 leading-relaxed">
            Please connect your wallet to manage your listed veNFTs and view your trading history.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold mb-2">My <span className="gradient-text">Portfolio</span></h1>
            <p className="text-mezo-muted">Monitor and manage your active sell orders.</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/activity"
              className="btn-outline flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Trade History
            </Link>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-12">
            {/* Active Listings Section */}
            <section>
              <div className="flex items-center gap-2 mb-6 text-mezo-primary font-bold uppercase tracking-widest text-xs">
                <Tag className="w-4 h-4" />
                Active Sell Orders
              </div>
              
              {userListingIds && userListingIds.length > 0 ? (
                <div className="space-y-4">
                  {userListingIds.map((id) => (
                    <UserListingItem
                      key={id.toString()}
                      listingId={Number(id)}
                      onActiveChange={handleActiveChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass-card rounded-[2rem] p-12 text-center border-dashed border-mezo-border">
                  <p className="text-mezo-muted">You have no active listings on the market.</p>
                </div>
              )}
            </section>

            {/* In Wallet Section */}
            <section>
              <div className="flex items-center gap-2 mb-6 text-mezo-accent font-bold uppercase tracking-widest text-xs">
                <Wallet className="w-4 h-4" />
                In Your Wallet
              </div>

              {veNFTsLoading ? (
                <div className="grid sm:grid-cols-2 gap-6">
                  {[0, 1].map((i) => (
                    <div key={i} className="glass-card p-6 rounded-3xl h-40 animate-pulse" />
                  ))}
                </div>
              ) : walletVeNFTs.length === 0 ? (
                <div className="glass-card rounded-[2rem] p-12 text-center border-dashed border-mezo-border">
                  <Wallet className="w-10 h-10 text-mezo-muted mx-auto mb-4" />
                  <p className="text-mezo-muted">No veBTC or veMEZO positions found in your wallet.</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  {walletVeNFTs.map((nft) => (
                    <div key={`${nft.collection}-${nft.tokenId.toString()}`} className="glass-card p-6 rounded-3xl relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="font-bold text-lg">{nft.collection} #{nft.tokenId.toString()}</h4>
                          <p className="text-xs text-mezo-muted mt-1">Locked position ready for listing</p>
                          {/* Grant NFT badges — shown when this veNFT was distributed as a grant */}
                          {nft.isGrant && (
                            <div className="flex flex-wrap items-center gap-1 mt-2">
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
                        <div className={`p-2 rounded-lg ${nft.collection === 'veBTC' ? 'bg-mezo-primary/10 text-mezo-primary' : 'bg-mezo-accent/10 text-mezo-accent'}`}>
                          <Zap className="w-4 h-4" />
                        </div>
                      </div>

                      <button
                        onClick={() => { setSelectedVeNFT(nft); setIsListingModalOpen(true); }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-bold rounded-xl hover:bg-mezo-primary hover:text-white transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        List for Sale
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <div className="glass-card p-8 rounded-3xl border-mezo-primary/20 bg-mezo-primary/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-mezo-primary/10 text-mezo-primary">
                  <Info className="w-5 h-5" />
                </div>
                <h3 className="font-bold">Seller Dashboard</h3>
              </div>
              <ul className="space-y-4 text-sm text-mezo-muted leading-relaxed">
                <li className="flex gap-3">
                  <ShieldCheck className="w-4 h-4 text-mezo-success shrink-0" />
                  Your NFTs never leave your wallet during listing.
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="w-4 h-4 text-mezo-success shrink-0" />
                  You continue to receive fee claims and voting power.
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="w-4 h-4 text-mezo-success shrink-0" />
                  Atomic settlement ensures you get paid instantly.
                </li>
              </ul>
            </div>

            <div className="glass-card p-8 rounded-3xl">
              <h3 className="font-bold mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-mezo-muted">Total Sales</span>
                  <span className="font-bold">12.4 BTC</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-mezo-muted">Active Listings</span>
                  <span className="font-bold">{activeListingCount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-mezo-muted">Protocol Fees Saved</span>
                  <span className="font-bold text-mezo-success">0.45 BTC</span>
                </div>
              </div>
            </div>
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
