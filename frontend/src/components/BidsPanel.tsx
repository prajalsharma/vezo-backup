"use client";

/**
 * BidsPanel
 * ─────────
 * Displays active bids for a veNFT and allows the NFT owner to accept a bid
 * or any user to cancel their own bid.
 *
 * Also renders a "Place Bid" form so buyers can bid directly from this panel.
 *
 * Usage:
 *   <BidsPanel
 *     collection={collectionAddress}
 *     tokenId={BigInt(tokenId)}
 *     currentOwner={ownerAddress}
 *   />
 */

import React, { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useBidding, useActiveTokenBids } from "../hooks/useBidding";
import { useNetwork } from "../hooks/useNetwork";
import { getContracts } from "../lib/contracts";
import { PAYMENT_TOKENS } from "../lib/contracts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BidsPanelProps {
  collection:   `0x${string}`;
  tokenId:      bigint;
  currentOwner?: `0x${string}`;
}

interface Bid {
  id:           bigint;
  bidder:       `0x${string}`;
  collection:   `0x${string}`;
  tokenId:      bigint;
  paymentToken: `0x${string}`;
  amount:       bigint;
  expiry:       bigint;
  active:       boolean;
  minIntrinsicValue:  bigint;
  maxIntrinsicValue:  bigint;
  minVotingPower:     bigint;
  minLockDuration:    bigint;
  requireAutoMaxLock: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const ZERO = "0x0000000000000000000000000000000000000000";

function formatExpiry(expiry: bigint): string {
  const ts  = Number(expiry) * 1000;
  const now = Date.now();
  if (ts <= now) return "Expired";
  const diff  = ts - now;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 48) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── PlaceBidForm ────────────────────────────────────────────────────────────

function PlaceBidForm({
  collection,
  tokenId,
  onSuccess,
}: {
  collection:   `0x${string}`;
  tokenId:      bigint;
  onSuccess:    () => void;
}) {
  const { network } = useNetwork();
  const contracts   = getContracts(network);
  const { address } = useAccount();
  const { createBid, isWritePending, isConfirming } = useBidding();

  const [amount,        setAmount]        = useState("");
  const [paymentToken,  setPaymentToken]  = useState<`0x${string}`>(contracts.MUSD);
  const [expiryDays,    setExpiryDays]    = useState("7");
  const [error,         setError]         = useState<string | null>(null);
  const [submitted,     setSubmitted]     = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!address) { setError("Connect wallet first"); return; }
      try {
        const amountWei  = parseUnits(amount || "0", 18);
        if (amountWei === 0n) { setError("Amount must be > 0"); return; }
        const expiryTs = BigInt(Math.floor(Date.now() / 1000) + Number(expiryDays) * 86400);
        await createBid({
          collection,
          tokenId,
          paymentToken,
          amount:   amountWei,
          expiry:   expiryTs,
        });
        setSubmitted(true);
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Surface user-friendly error (strip viem stack noise)
        setError(msg.length > 120 ? msg.slice(0, 120) + "…" : msg);
      }
    },
    [address, amount, paymentToken, expiryDays, collection, tokenId, createBid, onSuccess]
  );

  if (submitted) {
    return (
      <div className="rounded-lg bg-green-900/30 border border-green-600/40 p-4 text-sm text-green-300">
        Bid submitted! Waiting for confirmation…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-white/80">Place a Bid</h4>

      {/* Payment token */}
      <div className="flex gap-2">
        {PAYMENT_TOKENS.filter((t) => !t.isNative).map((t) => {
          const addr = (contracts as unknown as Record<string, string>)[t.symbol.toLowerCase()] as `0x${string}`;
          return (
            <button
              key={t.symbol}
              type="button"
              onClick={() => setPaymentToken(addr)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                paymentToken === addr
                  ? "bg-blue-600 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
            >
              {t.symbol}
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Bid amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-500"
          required
        />
        <span className="text-xs text-white/50">
          {PAYMENT_TOKENS.find((t) => {
            const addr = (contracts as unknown as Record<string, string>)[t.symbol.toLowerCase()] as `0x${string}`;
            return addr === paymentToken;
          })?.symbol ?? "TOKEN"}
        </span>
      </div>

      {/* Expiry */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-white/50">Expires in</label>
        <select
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white focus:outline-none"
        >
          {["1","3","7","14","30"].map((d) => (
            <option key={d} value={d}>{d} day{d !== "1" ? "s" : ""}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isWritePending || isConfirming || !address}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition"
      >
        {isWritePending || isConfirming ? "Submitting…" : "Submit Bid"}
      </button>
    </form>
  );
}

// ─── BidRow ──────────────────────────────────────────────────────────────────

function BidRow({
  bid,
  isOwner,
  onAccept,
  onCancel,
}: {
  bid:       Bid;
  isOwner:   boolean;
  onAccept:  (bidId: bigint) => void;
  onCancel:  (bidId: bigint) => void;
}) {
  const { address } = useAccount();
  const isBidder  = address?.toLowerCase() === bid.bidder.toLowerCase();
  const isExpired = Number(bid.expiry) * 1000 < Date.now();

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/10 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">
          {shortAddress(bid.bidder)}
          {isBidder && (
            <span className="ml-1 text-xs text-blue-400">(you)</span>
          )}
        </p>
        <p className="text-xs text-white/50 mt-0.5">
          {formatUnits(bid.amount, 18)} ·{" "}
          <span className={isExpired ? "text-red-400" : "text-green-400"}>
            {formatExpiry(bid.expiry)}
          </span>
        </p>
        {(bid.minIntrinsicValue > 0n || bid.minVotingPower > 0n) && (
          <p className="text-xs text-yellow-400/60 mt-0.5">
            {bid.minIntrinsicValue > 0n && `Min IV: ${formatUnits(bid.minIntrinsicValue, 18)} `}
            {bid.minVotingPower    > 0n && `Min VP: ${formatUnits(bid.minVotingPower, 18)}`}
          </p>
        )}
      </div>
      <div className="flex gap-2 ml-3 shrink-0">
        {isOwner && !isExpired && (
          <button
            onClick={() => onAccept(bid.id)}
            className="px-3 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition"
          >
            Accept
          </button>
        )}
        {isBidder && (
          <button
            onClick={() => onCancel(bid.id)}
            className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 text-white/70 rounded transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── BidsPanel (main export) ──────────────────────────────────────────────────

export default function BidsPanel({
  collection,
  tokenId,
  currentOwner,
}: BidsPanelProps) {
  const { address } = useAccount();
  const { cancelBid, acceptBid } = useBidding();
  const [refreshKey, setRefreshKey] = useState(0);

  const isOwner =
    !!address &&
    !!currentOwner &&
    address.toLowerCase() === currentOwner.toLowerCase();

  const { data: activeBids, isLoading, refetch } = useActiveTokenBids(collection, tokenId);

  const handleAccept = useCallback(
    async (bidId: bigint) => {
      try {
        await acceptBid(bidId);
        refetch();
      } catch (e) {
        console.error("acceptBid failed:", e);
      }
    },
    [acceptBid, refetch]
  );

  const handleCancel = useCallback(
    async (bidId: bigint) => {
      try {
        await cancelBid(bidId);
        refetch();
      } catch (e) {
        console.error("cancelBid failed:", e);
      }
    },
    [cancelBid, refetch]
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Offers / Bids</h3>
        {activeBids && activeBids.length > 0 && (
          <span className="text-xs text-white/50">{activeBids.length} active</span>
        )}
      </div>

      {/* Active bids list */}
      {isLoading ? (
        <p className="text-sm text-white/40">Loading bids…</p>
      ) : !activeBids || activeBids.length === 0 ? (
        <p className="text-sm text-white/40">No active offers yet.</p>
      ) : (
        <div>
          {(activeBids as Bid[]).map((bid) => (
            <BidRow
              key={bid.id.toString()}
              bid={bid}
              isOwner={isOwner}
              onAccept={handleAccept}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Place bid form (shown to non-owners) */}
      {!isOwner && address && (
        <div className="pt-3 border-t border-white/10">
          <PlaceBidForm
            collection={collection}
            tokenId={tokenId}
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              refetch();
            }}
          />
        </div>
      )}

      {!address && (
        <p className="text-xs text-white/40 text-center">
          Connect wallet to place or manage bids
        </p>
      )}
    </div>
  );
}
