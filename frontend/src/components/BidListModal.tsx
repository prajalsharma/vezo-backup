"use client";

import { useState, useEffect } from "react";
import { formatEther } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2, AlertCircle, Zap, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useNetwork } from "@/hooks/useNetwork";
import { useTokenPrices, formatUSD } from "@/hooks/useTokenPrices";
import { BidRegistryABI } from "@/lib/abis";
import { getPaymentTokenSymbol } from "@/lib/tokens";

interface Bid { bidder: string; bidToken: string; bidAmount: bigint; expiry: bigint; active: boolean; }

interface BidListModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: string;
  tokenId: bigint;
  collectionName: "veBTC" | "veMEZO";
  intrinsicValue: bigint;
  onBidAccepted?: () => void;
}

function expLabel(expiry: bigint): string {
  const s = Number(expiry) - Math.floor(Date.now() / 1000);
  if (s <= 0) return "Expired";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

function parseErr(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("user rejected") || m.includes("rejected")) return "You rejected the transaction.";
  if (m.includes("bidexpired"))   return "This bid has expired.";
  if (m.includes("notnftowner"))  return "You are not the owner of this NFT.";
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}

export function BidListModal({ isOpen, onClose, collection, tokenId, collectionName, intrinsicValue, onBidAccepted }: BidListModalProps) {
  const { contracts } = useNetwork();
  const { prices }    = useTokenPrices();
  const bidRegistryAddress = (contracts as any).bidRegistry as `0x${string}`;
  const isDeployed = !!bidRegistryAddress && bidRegistryAddress !== "0x0000000000000000000000000000000000000000";

  const { writeContractAsync } = useWriteContract();
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);
  const [txHash, setTxHash]   = useState<`0x${string}` | undefined>();
  const [errMsg, setErrMsg]   = useState<string | null>(null);
  const [doneIdx, setDoneIdx] = useState<number | null>(null);

  const { isSuccess: confirmed, isError: failed, error: txErr } = useWaitForTransactionReceipt({ hash: txHash });
  const { data: bidsData, isLoading: bidsLoading, refetch } = useReadContract({
    address: bidRegistryAddress,
    abi: BidRegistryABI,
    functionName: "getBidsForToken",
    args: [collection as `0x${string}`, tokenId],
    query: { enabled: isDeployed && isOpen },
  });

  const bids: Bid[] = (bidsData as Bid[] | undefined) ?? [];
  const now_ = Math.floor(Date.now() / 1000);
  const activeBids = bids
    .map((b, i) => ({ ...b, idx: i }))
    .filter((b) => b.active && Number(b.expiry) > now_)
    .sort((a, b) => {
      const symA = getPaymentTokenSymbol(a.bidToken), symB = getPaymentTokenSymbol(b.bidToken);
      return (Number(b.bidAmount) / 1e18) * (prices[symB] ?? 0) - (Number(a.bidAmount) / 1e18) * (prices[symA] ?? 0);
    });

  const isVeBTC = collectionName === "veBTC";
  const accent  = isVeBTC ? "#F7931A" : "#4A90E2";
  const ivUSD   = (Number(intrinsicValue) / 1e18) * (prices[isVeBTC ? "BTC" : "MEZO"] ?? 0);

  useEffect(() => {
    if (confirmed && acceptingIdx !== null) { setDoneIdx(acceptingIdx); setAcceptingIdx(null); setTxHash(undefined); refetch(); onBidAccepted?.(); }
  }, [confirmed]); // eslint-disable-line
  useEffect(() => {
    if (failed) { setErrMsg(parseErr(txErr?.message ?? "Transaction reverted.")); setAcceptingIdx(null); setTxHash(undefined); }
  }, [failed]); // eslint-disable-line
  useEffect(() => { if (isOpen) { setAcceptingIdx(null); setTxHash(undefined); setErrMsg(null); setDoneIdx(null); } }, [isOpen]);

  async function handleAccept(originalIdx: number, displayIdx: number) {
    setErrMsg(null); setAcceptingIdx(displayIdx);
    try {
      const h = await writeContractAsync({ address: bidRegistryAddress, abi: BidRegistryABI, functionName: "acceptBid", args: [collection as `0x${string}`, tokenId, BigInt(originalIdx)] });
      setTxHash(h);
    } catch (e: unknown) { setErrMsg(parseErr(e instanceof Error ? e.message : String(e))); setAcceptingIdx(null); }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 24 }} transition={{ type: "spring", damping: 28, stiffness: 260 }} className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/[0.08] rounded-[2rem] overflow-hidden shadow-2xl">
          <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44, transparent)` }} />
          <div className="px-7 pt-7 pb-5 border-b border-white/[0.06] flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}12`, border: `1px solid ${accent}28` }}><Zap className="w-4 h-4" style={{ color: accent }} /></div>
                <span className="text-[10px] font-black tracking-[0.12em] uppercase px-2 py-0.5 rounded-md" style={{ color: accent, background: `${accent}12` }}>{collectionName}</span>
              </div>
              <h2 className="text-[21px] font-bold tracking-tight">Active Bids <span style={{ color: accent }}>#{tokenId.toString()}</span></h2>
              <p className="text-[12.5px] text-white/32 mt-1">{activeBids.length} active bid{activeBids.length !== 1 ? "s" : ""} — sorted by value</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/[0.06] rounded-xl transition-colors text-white/32 hover:text-white mt-1"><X className="w-5 h-5" /></button>
          </div>
          <div className="px-7 pb-7 pt-5 space-y-3 max-h-[70vh] overflow-y-auto">
            {!isDeployed ? <p className="text-center text-white/30 text-[13px] py-8">Bidding not available on this network.</p>
            : bidsLoading ? <div className="flex items-center justify-center py-12 gap-3 text-white/30"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-[13px]">Loading bids…</span></div>
            : activeBids.length === 0 ? (
              <div className="text-center py-12"><TrendingUp className="w-8 h-8 text-white/12 mx-auto mb-3" /><p className="text-[14px] text-white/28">No active bids yet.</p></div>
            ) : (
              <>
                {errMsg && <div className="flex gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><p className="text-[11.5px] text-red-400">{errMsg}</p></div>}
                {activeBids.map((bid, di) => {
                  const sym     = getPaymentTokenSymbol(bid.bidToken);
                  const bidUSD  = (Number(bid.bidAmount) / 1e18) * (prices[sym as "BTC" | "MEZO" | "MUSD"] ?? 0);
                  const discPct = ivUSD > 0 && bidUSD < ivUSD ? (((ivUSD - bidUSD) / ivUSD) * 100).toFixed(1) : null;
                  const isTop   = di === 0;
                  const isDone  = doneIdx === di;
                  return (
                    <motion.div key={`${bid.bidder}-${bid.bidAmount}-${bid.expiry}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.04 }} className={`rounded-2xl border p-5 flex items-center justify-between gap-4 ${isTop ? "bg-emerald-500/[0.04] border-emerald-500/20" : "bg-white/[0.02] border-white/[0.06]"}`}>
                      <div className="min-w-0">
                        {isTop && <span className="inline-flex items-center gap-1 text-[8.5px] font-black text-emerald-400 uppercase tracking-wider mb-1.5"><TrendingUp className="w-2.5 h-2.5" /> Top offer</span>}
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[17px] font-bold tabular-nums">{parseFloat(formatEther(bid.bidAmount)).toFixed(4)}</span>
                          <span className="text-[12px] text-white/35 font-bold">{sym}</span>
                        </div>
                        <p className="text-[11px] text-white/28 mt-0.5">{formatUSD(bidUSD)}</p>
                        {discPct && <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{discPct}% below IV</p>}
                        <div className="flex items-center gap-1 mt-1.5"><Clock className="w-3 h-3 text-white/20" /><span className="text-[10.5px] text-white/25">{expLabel(bid.expiry)}</span></div>
                        <p className="text-[10px] text-white/18 font-mono mt-1">{bid.bidder.slice(0,6)}…{bid.bidder.slice(-4)}</p>
                      </div>
                      {isDone ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[12px] font-bold"><CheckCircle2 className="w-4 h-4" />Accepted</div>
                      ) : (
                        <button onClick={() => handleAccept(bid.idx, di)} disabled={!!acceptingIdx || !!txHash} className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold text-black transition-all disabled:opacity-40 group/btn" style={{ background: acceptingIdx === di ? "#c97415" : "linear-gradient(135deg, #F7931A, #ff9e2a)" }}>
                          {acceptingIdx === di ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Accepting…</> : <>Accept <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" /></>}
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
