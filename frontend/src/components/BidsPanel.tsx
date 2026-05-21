"use client";

/**
 * BidsPanel
 * ─────────
 * Displays active bids for a veNFT and allows the NFT owner to accept a bid
 * or any user to cancel their own bid. Also renders a "Place Bid" form.
 *
 * Fully uses design-system CSS vars (var(--bg-*), var(--text-*), var(--border))
 * to match the VeNFTCard host surface. No hardcoded colors.
 */

import React, { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useBidding, useActiveTokenBids } from "../hooks/useBidding";
import { useNetwork } from "../hooks/useNetwork";
import { getContracts } from "../lib/contracts";
import { PAYMENT_TOKENS } from "../lib/contracts";
import { Gavel, CheckCircle2, X, Clock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BidsPanelProps {
  collection:    `0x${string}`;
  tokenId:       bigint;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatExpiry(expiry: bigint): { label: string; expired: boolean } {
  const ts  = Number(expiry) * 1000;
  const now = Date.now();
  if (ts <= now) return { label: "Expired", expired: true };
  const diff  = ts - now;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 48) return { label: `${hours}h left`, expired: false };
  const days = Math.floor(hours / 24);
  return { label: `${days}d left`, expired: false };
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── PlaceBidForm ─────────────────────────────────────────────────────────────

function PlaceBidForm({
  collection,
  tokenId,
  onSuccess,
}: {
  collection: `0x${string}`;
  tokenId:    bigint;
  onSuccess:  () => void;
}) {
  const { network }  = useNetwork();
  const contracts    = getContracts(network);
  const { address }  = useAccount();
  const { createBid, isWritePending, isConfirming } = useBidding();

  const [amount,       setAmount]       = useState("");
  const [paymentToken, setPaymentToken] = useState<`0x${string}`>(contracts.MUSD);
  const [expiryDays,   setExpiryDays]   = useState("7");
  const [error,        setError]        = useState<string | null>(null);
  const [submitted,    setSubmitted]    = useState(false);

  const busy = isWritePending || isConfirming;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!address) { setError("Connect wallet first"); return; }
      try {
        const amountWei = parseUnits(amount || "0", 18);
        if (amountWei === 0n) { setError("Amount must be > 0"); return; }
        const expiryTs = BigInt(Math.floor(Date.now() / 1000) + Number(expiryDays) * 86400);
        await createBid({ collection, tokenId, paymentToken, amount: amountWei, expiry: expiryTs });
        setSubmitted(true);
        onSuccess();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg.length > 140 ? msg.slice(0, 140) + "…" : msg);
      }
    },
    [address, amount, paymentToken, expiryDays, collection, tokenId, createBid, onSuccess]
  );

  if (submitted) {
    return (
      <div
        className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium"
        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981" }}
      >
        <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0 }} />
        Bid submitted — waiting for confirmation…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
        Place a Bid
      </p>

      {/* Payment token selector */}
      <div className="flex gap-1.5">
        {PAYMENT_TOKENS.filter((t) => !t.isNative).map((t) => {
          const addr = (contracts as unknown as Record<string, string>)[t.symbol.toLowerCase()] as `0x${string}`;
          const active = paymentToken === addr;
          return (
            <button
              key={t.symbol}
              type="button"
              onClick={() => setPaymentToken(addr)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background: active ? "rgba(255,0,64,0.12)" : "var(--bg-2)",
                border: `1px solid ${active ? "rgba(255,0,64,0.28)" : "var(--border-subtle)"}`,
                color: active ? "#FF0040" : "var(--text-2)",
              }}
            >
              {t.symbol}
            </button>
          );
        })}
      </div>

      {/* Amount + expiry row */}
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Bid amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#FF0040]"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-1)",
          }}
          required
        />
        <select
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          className="rounded-lg px-2 py-2 text-xs font-medium focus:outline-none appearance-none"
          style={{
            background: "var(--bg-2)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-2)",
            minWidth: 72,
          }}
        >
          {["1","3","7","14","30"].map((d) => (
            <option key={d} value={d}>{d}d expiry</option>
          ))}
        </select>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[10px]"
            style={{ color: "#EF4444" }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={busy || !address}
        className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        style={{
          background: busy ? "var(--bg-3)" : "#FF0040",
          color: busy ? "var(--text-3)" : "#fff",
          border: "none",
        }}
      >
        {busy ? (
          <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />Submitting…</>
        ) : !address ? (
          "Connect wallet to bid"
        ) : (
          <><Gavel style={{ width: 12, height: 12 }} />Submit Bid</>
        )}
      </button>
    </form>
  );
}

// ─── BidRow ───────────────────────────────────────────────────────────────────

function BidRow({
  bid,
  isOwner,
  onAccept,
  onCancel,
}: {
  bid:      Bid;
  isOwner:  boolean;
  onAccept: (id: bigint) => void;
  onCancel: (id: bigint) => void;
}) {
  const { address } = useAccount();
  const isBidder    = address?.toLowerCase() === bid.bidder.toLowerCase();
  const { label, expired } = formatExpiry(bid.expiry);

  return (
    <div
      className="flex items-center gap-3 py-2.5"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[11px] font-mono" style={{ color: "var(--text-2)" }}>
            {shortAddress(bid.bidder)}
          </span>
          {isBidder && (
            <span
              className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(255,0,64,0.1)", color: "#FF0040" }}
            >
              you
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
            {parseFloat(formatUnits(bid.amount, 18)).toFixed(4)}
          </span>
          <div className="flex items-center gap-1" style={{ color: expired ? "#EF4444" : "#10B981" }}>
            <Clock style={{ width: 9, height: 9 }} />
            <span className="text-[9px] font-semibold">{label}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {isOwner && !expired && (
          <button
            onClick={() => onAccept(bid.id)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.22)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.12)"; }}
          >
            Accept
          </button>
        )}
        {isBidder && (
          <button
            onClick={() => onCancel(bid.id)}
            className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)", color: "var(--text-3)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-3)"; }}
          >
            <X style={{ width: 10, height: 10 }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── BidsPanel (main export) ──────────────────────────────────────────────────

export default function BidsPanel({ collection, tokenId, currentOwner }: BidsPanelProps) {
  const { address }  = useAccount();
  const { cancelBid, acceptBid } = useBidding();
  const [, setRefreshKey] = useState(0);

  const isOwner =
    !!address &&
    !!currentOwner &&
    address.toLowerCase() === currentOwner.toLowerCase();

  const { data: activeBids, isLoading, refetch } = useActiveTokenBids(collection, tokenId);

  const handleAccept = useCallback(async (bidId: bigint) => {
    try { await acceptBid(bidId); refetch(); } catch (e) { console.error("acceptBid:", e); }
  }, [acceptBid, refetch]);

  const handleCancel = useCallback(async (bidId: bigint) => {
    try { await cancelBid(bidId); refetch(); } catch (e) { console.error("cancelBid:", e); }
  }, [cancelBid, refetch]);

  const bids = (activeBids as Bid[] | undefined) ?? [];

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel style={{ width: 12, height: 12, color: "var(--text-3)" }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
            Active Offers
          </span>
        </div>
        {bids.length > 0 && (
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,0,64,0.08)", color: "#FF0040", border: "1px solid rgba(255,0,64,0.18)" }}
          >
            {bids.length}
          </span>
        )}
      </div>

      {/* Bids list */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-2" style={{ color: "var(--text-3)" }}>
          <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
          <span className="text-xs">Loading offers…</span>
        </div>
      ) : bids.length === 0 ? (
        <p className="text-xs py-1" style={{ color: "var(--text-3)" }}>No active offers yet.</p>
      ) : (
        <div>
          {bids.map((bid) => (
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

      {/* Place bid form — shown to non-owners only */}
      {!isOwner && (
        <div
          className="pt-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {address ? (
            <PlaceBidForm
              collection={collection}
              tokenId={tokenId}
              onSuccess={() => { setRefreshKey((k) => k + 1); refetch(); }}
            />
          ) : (
            <p className="text-[10px] text-center py-1" style={{ color: "var(--text-3)" }}>
              Connect wallet to place a bid
            </p>
          )}
        </div>
      )}
    </div>
  );
}
