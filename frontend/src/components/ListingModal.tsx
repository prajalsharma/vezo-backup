"use client";

/*
  Taste-skill rules applied:
  ✓ mezo-* tokens → CSS custom properties
  ✓ Liquid glass modal: backdrop-blur + inner border shadow
  ✓ tabular-nums on all numeric values
  ✓ Spring stiffness:100, damping:20
  ✓ Vezo red (#FF0040) accent on active payment token selector
  ✓ Price input uses var(--bg-2) surface, var(--border) ring
  ✓ Animate only transform + opacity (GPU rule)
*/

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import {
  X,
  ShieldCheck,
  ArrowRight,
  GitMerge,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useNetwork } from "@/hooks/useNetwork";
import { PAYMENT_TOKENS } from "@/lib/contracts";

interface ListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  veNFT: {
    tokenId: bigint;
    collection: "veBTC" | "veMEZO";
    intrinsicValue: bigint;
    votingPower: bigint;
    lockEnd: bigint;
    isGrant?: boolean;
  } | null;
}

export function ListingModal({ isOpen, onClose, veNFT }: ListingModalProps) {
  const isGrant = veNFT?.isGrant ?? false;
  const { address } = useAccount();
  const { contracts } = useNetwork();
  const { createListing, approveNFT, isPending, isConfirming, isSuccess } = useMarketplace();

  const [price, setPrice] = useState("");
  const [paymentToken, setPaymentToken] = useState<"BTC" | "MEZO" | "MUSD">(PAYMENT_TOKENS[0].symbol);
  const [txError, setTxError] = useState<string | null>(null);
  const [step, setStep] = useState<"approve" | "list">("approve");
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>(undefined);
  const [approvalHandled, setApprovalHandled] = useState(false);

  const { isSuccess: approvalConfirmed } = useWaitForTransactionReceipt({ hash: approvalHash });

  useEffect(() => {
    if (approvalConfirmed && step === "approve" && !approvalHandled) {
      setApprovalHandled(true);
      setStep("list");
    }
  }, [approvalConfirmed, step, approvalHandled]);

  useEffect(() => {
    setStep("approve");
    setPrice("");
    setPaymentToken(PAYMENT_TOKENS[0].symbol);
    setApprovalHash(undefined);
    setApprovalHandled(false);
    setTxError(null);
  }, [isOpen]);

  if (!veNFT) return null;

  const nftContract = veNFT.collection === "veBTC" ? contracts.veBTC : contracts.veMEZO;
  const paymentTokenAddr =
    paymentToken === "BTC"
      ? contracts.BTC
      : paymentToken === "MEZO"
      ? contracts.MEZO
      : contracts.MUSD;

  const handleList = async () => {
    setTxError(null);
    try {
      if (step === "approve") {
        const txHash = await approveNFT(nftContract, veNFT.tokenId);
        if (txHash) {
          setApprovalHash(txHash);
          setApprovalHandled(false);
        }
      } else {
        await createListing(nftContract, veNFT.tokenId, parseEther(price), paymentTokenAddr);
      }
    } catch (error: any) {
      const msg: string =
        error?.shortMessage ?? error?.message ?? "Transaction failed. Check wallet and try again.";
      setTxError(msg);
    }
  };

  const formattedIntrinsic = parseFloat(formatEther(veNFT.intrinsicValue)).toFixed(4);
  const discount = price ? (1 - parseFloat(price) / parseFloat(formattedIntrinsic)) * 100 : 0;
  const accentColor = veNFT.collection === "veBTC" ? "#F7931A" : "#4A90E2";

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px) saturate(180%)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            {/* Top accent bar — collection color */}
            <div style={{ height: 2, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />

            {/* Header */}
            <div
              className="flex items-start justify-between px-6 pt-5 pb-4"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <div>
                <h2 className="text-base font-semibold" style={{ letterSpacing: "-0.02em" }}>
                  List {veNFT.collection}{" "}
                  <span
                    className="tabular-nums"
                    style={{ fontVariantNumeric: "tabular-nums", color: accentColor }}
                  >
                    #{veNFT.tokenId.toString()}
                  </span>
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                  Configure your secondary market listing.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
              >
                <X style={{ width: 17, height: 17 }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Intrinsic Value",
                    value: `${formattedIntrinsic} ${veNFT.collection === "veBTC" ? "BTC" : "MEZO"}`,
                  },
                  {
                    label: "Voting Power",
                    value: parseFloat(formatEther(veNFT.votingPower)).toFixed(2),
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 rounded-xl"
                    style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}
                  >
                    <p className="eyebrow mb-1">{stat.label}</p>
                    <p
                      className="text-sm font-bold tabular-nums"
                      style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Price input */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="eyebrow">Set Asking Price</label>
                  {price && discount > 0 && (
                    <span
                      className="text-[10px] font-bold tabular-nums"
                      style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}
                    >
                      {discount.toFixed(1)}% discount vs spot
                    </span>
                  )}
                </div>

                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent p-4 pr-36 text-xl font-bold focus:outline-none"
                    style={{ color: "var(--text-1)" }}
                  />
                  <div className="absolute right-2 top-2 bottom-2 flex gap-1 items-center">
                    {PAYMENT_TOKENS.map((token) => (
                      <button
                        key={token.symbol}
                        onClick={() => setPaymentToken(token.symbol)}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black transition-all"
                        style={{
                          background:
                            paymentToken === token.symbol ? "#FF0040" : "rgba(255,255,255,0.05)",
                          color:
                            paymentToken === token.symbol ? "#fff" : "var(--text-3)",
                          border:
                            paymentToken === token.symbol
                              ? "1px solid #FF004088"
                              : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {token.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grant NFT notice */}
              {isGrant && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 p-4 rounded-xl"
                  style={{
                    background: "rgba(245,158,11,0.07)",
                    border: "1px solid rgba(245,158,11,0.22)",
                  }}
                >
                  <GitMerge style={{ width: 14, height: 14, color: "#F59E0B", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#F59E0B" }}>
                      Grant NFT — Cannot be Merged or Split
                    </p>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                      This position was distributed as a grant. It can be listed and sold normally, but merge and split operations are disabled on-chain.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Security note */}
              <div
                className="flex gap-3 p-4 rounded-xl"
                style={{
                  background: "rgba(255,0,64,0.05)",
                  border: "1px solid rgba(255,0,64,0.14)",
                }}
              >
                <ShieldCheck style={{ width: 15, height: 15, color: "#FF0040", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ letterSpacing: "-0.01em" }}>
                    Escrowless Listing
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>
                    The NFT stays in your wallet. You keep earning rewards and voting power until the moment it is sold.
                  </p>
                </div>
              </div>

              {/* Step indicator */}
              {step === "list" && (
                <div
                  className="flex items-center gap-2 py-2 px-3 rounded-xl"
                  style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.18)" }}
                >
                  <CheckCircle2 style={{ width: 13, height: 13, color: "#10B981" }} />
                  <span className="text-[11px] font-semibold" style={{ color: "#10B981" }}>
                    Marketplace approved — ready to list
                  </span>
                </div>
              )}

              {/* Error */}
              <AnimatePresence>
                {txError && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3 p-4 rounded-xl"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    <AlertCircle style={{ width: 14, height: 14, color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
                    <p className="text-[11px] leading-relaxed" style={{ color: "#EF4444" }}>
                      {txError}
                    </p>
                  </motion.div>
                )}

                {isSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3 p-4 rounded-xl"
                    style={{
                      background: "rgba(16,185,129,0.08)",
                      border: "1px solid rgba(16,185,129,0.2)",
                    }}
                  >
                    <CheckCircle2 style={{ width: 14, height: 14, color: "#10B981", flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs font-semibold" style={{ color: "#10B981" }}>
                      Listing successfully created!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CTA */}
              <motion.button
                onClick={handleList}
                disabled={!price || isPending || isConfirming}
                whileTap={{ y: 1, scale: 0.985 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-full btn-primary py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Confirming…
                  </>
                ) : isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Check Wallet…
                  </>
                ) : (
                  <>
                    {step === "approve" ? "1. Approve Marketplace" : "2. Confirm Listing"}
                    <ArrowRight
                      style={{ width: 15, height: 15 }}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
