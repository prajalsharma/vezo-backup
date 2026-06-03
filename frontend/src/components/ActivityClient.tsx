"use client";

import React from "react";
import { useNetwork } from "@/hooks/useNetwork";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { motion } from "framer-motion";
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
} from "lucide-react";

function formatTime(timestamp: number | null): string {
  if (!timestamp) return "—";
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

function formatDiscount(discountBps: number | null): React.ReactNode {
  if (discountBps === null) return <span className="text-mezo-border">—</span>;
  if (discountBps === 0) return <span className="text-mezo-muted text-xs font-bold">Par</span>;
  const pct = (Math.abs(discountBps) / 100).toFixed(1);
  if (discountBps > 0) {
    return <span className="text-mezo-success text-xs font-black">{pct}% OFF</span>;
  }
  return <span className="text-mezo-danger text-xs font-black">+{pct}% PREM</span>;
}

export default function ActivityClient() {
  const { network, contracts } = useNetwork();
  const { events, isLoading, error, isDeployed } = useActivityFeed(100);

  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center gap-2 text-mezo-primary mb-2">
            <History className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Live Stream</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">
            Global <span className="gradient-text">Activity</span>
          </h1>
          <p className="text-mezo-muted">
            Real-time trading and listing history on Mezo{" "}
            {network === "testnet" ? "Testnet" : "Mainnet"}.
          </p>
        </div>

        {!isDeployed ? (
          <div className="glass-card rounded-3xl p-16 text-center">
            <AlertCircle className="w-10 h-10 text-mezo-muted mx-auto mb-4" />
            <p className="text-mezo-muted">
              This activity stream will appear here as soon as the first
              listings and trades go live on this network.
            </p>
          </div>
        ) : isLoading ? (
          <div className="glass-card rounded-3xl p-16 flex items-center justify-center gap-3 text-mezo-muted">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading on-chain events…</span>
          </div>
        ) : error ? (
          <div className="glass-card rounded-3xl p-16 text-center">
            <AlertCircle className="w-10 h-10 text-mezo-danger mx-auto mb-4" />
            <p className="text-mezo-muted">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="glass-card rounded-3xl p-16 text-center">
            <History className="w-10 h-10 text-mezo-muted mx-auto mb-4" />
            <p className="text-mezo-muted">No activity yet. Be the first to list a veNFT.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-3xl overflow-hidden border-mezo-border"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-mezo-border/50 bg-white/[0.02]">
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-mezo-muted">Event</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-mezo-muted">Item</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-mezo-muted">Price</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-mezo-muted">Discount</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-mezo-muted">From</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-widest text-mezo-muted">To</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black uppercase tracking-widest text-mezo-muted">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mezo-border/30">
                  {events.map((activity, index) => (
                    <tr
                      key={`${activity.transactionHash}-${index}`}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-8 py-6">
                        {activity.type === "sale" ? (
                          <div className="flex items-center gap-1.5 text-mezo-success text-xs font-bold uppercase tracking-wider">
                            <ShoppingCart className="w-3.5 h-3.5" />Sale
                          </div>
                        ) : activity.type === "listed" ? (
                          <div className="flex items-center gap-1.5 text-mezo-primary text-xs font-bold uppercase tracking-wider">
                            <Tag className="w-3.5 h-3.5" />List
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-mezo-muted text-xs font-bold uppercase tracking-wider">
                            <XCircle className="w-3.5 h-3.5" />Cancel
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${activity.collection === "veBTC" ? "bg-mezo-primary" : "bg-mezo-accent"}`} />
                          <span className="font-bold text-sm">{activity.collection} #{activity.tokenId.toString()}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-sm text-white">{activity.price}</span>
                          <span className="text-[10px] font-bold text-mezo-muted">{activity.paymentToken}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {formatDiscount(activity.discountBps)}
                      </td>
                      <td className="px-8 py-6 font-mono text-xs text-mezo-muted">
                        {activity.from ? (
                          <a href={`${contracts.explorer}/address/${activity.from}`} target="_blank" rel="noopener noreferrer" className="hover:text-mezo-primary transition-colors flex items-center gap-1">
                            {activity.from.slice(0, 6)}…{activity.from.slice(-4)}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : <span className="text-mezo-border">—</span>}
                      </td>
                      <td className="px-8 py-6 font-mono text-xs text-mezo-muted">
                        {activity.to ? (
                          <a href={`${contracts.explorer}/address/${activity.to}`} target="_blank" rel="noopener noreferrer" className="hover:text-mezo-primary transition-colors flex items-center gap-1">
                            {activity.to.slice(0, 6)}…{activity.to.slice(-4)}
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ) : <span className="text-mezo-border">—</span>}
                      </td>
                      <td className="px-8 py-6 text-right">
                        {activity.transactionHash ? (
                          <a href={`${contracts.explorer}/tx/${activity.transactionHash}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-end gap-1.5 font-bold text-sm text-mezo-muted hover:text-mezo-primary transition-colors">
                            <Clock className="w-3 h-3" />
                            {formatTime(activity.timestamp)}
                          </a>
                        ) : (
                          <span className="flex items-center justify-end gap-1.5 font-bold text-sm text-mezo-muted">
                            <Clock className="w-3 h-3" />
                            {formatTime(activity.timestamp)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        <div className="mt-12 p-6 glass-card rounded-2xl border-mezo-success/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-mezo-success/10 text-mezo-success">
              <ShieldCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white uppercase tracking-wider">Verifiable Trading History</p>
              <p className="text-xs text-mezo-muted">Every transaction corresponds to an atomic on-chain event on the Mezo EVM.</p>
            </div>
          </div>
          <a href={contracts.explorer} target="_blank" rel="noopener noreferrer" className="btn-outline py-2 px-4 text-xs font-bold flex items-center gap-2">
            Explorer <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
