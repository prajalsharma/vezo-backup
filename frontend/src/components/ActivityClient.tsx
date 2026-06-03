"use client";

import { useNetwork } from "@/hooks/useNetwork";
import { useActivityContext } from "@/context/ActivityContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag,
  ShoppingCart,
  XCircle,
  ArrowUpRight,
  ExternalLink,
  History,
  Clock,
  ShieldCheck as ShieldCheckIcon,
  Loader2,
  AlertCircle,
  Activity,
  Gavel,
  CheckCircle2,
} from "lucide-react";

function formatTime(timestamp: number | null): string {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes === 0) return "Just now";
  return `${minutes}m ago`;
}

export default function ActivityClient() {
  const { network, contracts } = useNetwork();
  const { events, isLoading, error, isDeployed } = useActivityContext();

  return (
    <div className="min-h-screen pt-[88px] pb-24 px-5 lg:px-6">
      <div className="max-w-7xl mx-auto">

        {/* ── Page header ── */}
        <div className="pt-10 pb-10 border-b border-white/[0.05]">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-3.5 h-3.5 text-[#F7931A]" />
                <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#F7931A]">Live Stream</span>
              </div>
              <h1 className="text-[2.2rem] md:text-[2.8rem] font-black tracking-tight mb-2">
                Global <span className="gradient-text">Activity</span>
              </h1>
              <p className="text-[14.5px] text-white/38">
                Real-time trading and listing history on Mezo{" "}
                {network === "testnet" ? "Testnet" : "Mainnet"}.
              </p>
            </div>

            {/* Live indicator */}
            {isDeployed && !isLoading && events.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[12px] font-bold text-emerald-400">
                  {events.length} event{events.length !== 1 ? "s" : ""} loaded
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-7">
          {!isDeployed ? (
            <div className="py-24 text-center rounded-2xl border border-white/[0.055] bg-white/[0.012]">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.065] flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-6 h-6 text-white/22" />
              </div>
              <h3 className="text-[16px] font-bold mb-2">Not Deployed</h3>
              <p className="text-[13.5px] text-white/32 max-w-xs mx-auto leading-relaxed">
                Marketplace not yet deployed on this network. Deploy contracts and set environment variables to see activity.
              </p>
            </div>
          ) : isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4 text-white/32 rounded-2xl border border-white/[0.055] bg-white/[0.012]">
              <div className="w-12 h-12 rounded-full border border-white/[0.07] bg-white/[0.03] flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-white/40">Loading on-chain events…</p>
                <p className="text-[12px] text-white/22 mt-1">Scanning blockchain history</p>
              </div>
            </div>
          ) : error || events.length === 0 ? (
            <div className="py-24 text-center rounded-2xl border border-white/[0.055] bg-white/[0.012]">
              <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.065] flex items-center justify-center mx-auto mb-5">
                <Activity className="w-6 h-6 text-white/22" />
              </div>
              <h3 className="text-[16px] font-bold mb-2">No Activity Yet</h3>
              <p className="text-[13.5px] text-white/30">Be the first to list a veNFT and provide liquidity.</p>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/[0.055] bg-[#0a0a0a] overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.05] bg-white/[0.018]">
                        <th className="px-6 py-4 text-left text-[9.5px] font-black uppercase tracking-[0.16em] text-white/28">Event</th>
                        <th className="px-6 py-4 text-left text-[9.5px] font-black uppercase tracking-[0.16em] text-white/28">Item</th>
                        <th className="px-6 py-4 text-left text-[9.5px] font-black uppercase tracking-[0.16em] text-white/28">Price</th>
                        <th className="px-6 py-4 text-left text-[9.5px] font-black uppercase tracking-[0.16em] text-white/28">From</th>
                        <th className="px-6 py-4 text-left text-[9.5px] font-black uppercase tracking-[0.16em] text-white/28 hidden md:table-cell">To</th>
                        <th className="px-6 py-4 text-right text-[9.5px] font-black uppercase tracking-[0.16em] text-white/28">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {events.map((activity, index) => (
                        <motion.tr
                          key={`${activity.transactionHash}-${index}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.3) }}
                          className="hover:bg-white/[0.018] transition-colors duration-150 group"
                        >
                          {/* Event type */}
                          <td className="px-6 py-4">
                            {activity.type === "sale" ? (
                              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Sale</span>
                              </div>
                            ) : activity.type === "listed" ? (
                              <div className="flex items-center gap-1.5 text-[#F7931A] text-[11px] font-bold uppercase tracking-wider">
                                <Tag className="w-3.5 h-3.5" />
                                <span>List</span>
                              </div>
                            ) : activity.type === "bid-placed" ? (
                              <div className="flex items-center gap-1.5 text-[#4A90E2] text-[11px] font-bold uppercase tracking-wider">
                                <Gavel className="w-3.5 h-3.5" />
                                <span>Bid</span>
                              </div>
                            ) : activity.type === "bid-accepted" ? (
                              <div className="flex items-center gap-1.5 text-purple-400 text-[11px] font-bold uppercase tracking-wider">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Bid Sale</span>
                              </div>
                            ) : activity.type === "bid-cancelled" ? (
                              <div className="flex items-center gap-1.5 text-white/22 text-[11px] font-bold uppercase tracking-wider">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Bid Out</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-white/30 text-[11px] font-bold uppercase tracking-wider">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </div>
                            )}
                          </td>

                          {/* Item */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  activity.collection === "veBTC" ? "bg-[#F7931A]" : "bg-[#4A90E2]"
                                }`}
                              />
                              <div>
                                <span className="font-bold text-[13px]">
                                  {activity.collection}{" "}
                                  <span className={activity.collection === "veBTC" ? "text-[#F7931A]" : "text-[#4A90E2]"}>
                                    #{activity.tokenId.toString()}
                                  </span>
                                </span>
                                <p className="text-[10px] text-white/22 font-mono mt-0.5">#{activity.listingId.toString()}</p>
                              </div>
                            </div>
                          </td>

                          {/* Price */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[13px] text-white">{activity.price}</span>
                              <span className="text-[10px] font-bold text-white/28">{activity.paymentToken}</span>
                            </div>
                          </td>

                          {/* From */}
                          <td className="px-6 py-4 font-mono text-[11px] text-white/32">
                            {activity.from ? (
                              <a
                                href={`${contracts.explorer}/address/${activity.from}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#F7931A] transition-colors flex items-center gap-1"
                              >
                                {activity.from.slice(0, 6)}…{activity.from.slice(-4)}
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ) : (
                              <span className="text-white/18">—</span>
                            )}
                          </td>

                          {/* To (hidden on mobile) */}
                          <td className="px-6 py-4 font-mono text-[11px] text-white/32 hidden md:table-cell">
                            {activity.to ? (
                              <a
                                href={`${contracts.explorer}/address/${activity.to}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#F7931A] transition-colors flex items-center gap-1"
                              >
                                {activity.to.slice(0, 6)}…{activity.to.slice(-4)}
                                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ) : (
                              <span className="text-white/18">—</span>
                            )}
                          </td>

                          {/* Time */}
                          <td className="px-6 py-4 text-right">
                            {activity.transactionHash ? (
                              <a
                                href={`${contracts.explorer}/tx/${activity.transactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-end gap-1.5 font-bold text-[11.5px] text-white/30 hover:text-[#F7931A] transition-colors"
                              >
                                <Clock className="w-3 h-3" />
                                {formatTime(activity.timestamp)}
                              </a>
                            ) : (
                              <span className="inline-flex items-center justify-end gap-1.5 font-bold text-[11.5px] text-white/30">
                                <Clock className="w-3 h-3" />
                                {formatTime(activity.timestamp)}
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* ── Verifiable history band ── */}
        <div className="mt-8 p-5 rounded-2xl border border-emerald-500/[0.14] bg-emerald-500/[0.03] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/[0.09] border border-emerald-500/18 flex items-center justify-center flex-shrink-0">
              <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[13px] font-bold">Verifiable Trading History</p>
              <p className="text-[11.5px] text-white/30 mt-0.5">
                Every transaction corresponds to an atomic on-chain event on the Mezo EVM.
              </p>
            </div>
          </div>
          <a
            href={contracts.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline py-2.5 px-5 text-[12px] font-bold flex items-center gap-2 whitespace-nowrap"
          >
            Open Explorer <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
