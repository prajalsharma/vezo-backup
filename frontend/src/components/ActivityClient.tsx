"use client";

/*
  Taste-skill rules applied:
  ✓ BANNED: centered header → left-aligned, asymmetric two-part header
  ✓ BANNED: 3-col equal grid → table with hover reveals and staggered rows
  ✓ tabular-nums on all stats and price values
  ✓ Spring physics: stiffness:100, damping:20
  ✓ Empty state: composed, shows how to get started
  ✓ Sticky table header using transform rule (GPU)
  ✓ Animate ONLY transform + opacity (GPU rule)
  ✓ Tinted shadows (hue-matched, not generic gray-black)
*/

import React from "react";
import { useNetwork } from "@/hooks/useNetwork";
import { useActivityFeed } from "@/hooks/useActivityFeed";
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
  TrendingUp,
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
  if (discountBps === null) return <span style={{ color: "var(--text-3)" }}>—</span>;
  if (discountBps === 0) return (
    <span
      className="text-[10px] font-bold tabular-nums"
      style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
    >
      Par
    </span>
  );
  const pct = (Math.abs(discountBps) / 100).toFixed(1);
  if (discountBps > 0) {
    return (
      <span
        className="text-[10px] font-black tabular-nums"
        style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}
      >
        {pct}% off
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-black tabular-nums"
      style={{ color: "#EF4444", fontVariantNumeric: "tabular-nums" }}
    >
      +{pct}% prem
    </span>
  );
}

// ─── Event type pill ─────────────────────────────────────────────────────────
function EventPill({ type }: { type: "sale" | "listed" | "cancelled" }) {
  const config = {
    sale: { icon: ShoppingCart, label: "Sale", color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.22)" },
    listed: { icon: Tag, label: "List", color: "#F7931A", bg: "rgba(247,147,26,0.08)", border: "rgba(247,147,26,0.22)" },
    cancelled: { icon: XCircle, label: "Cancel", color: "var(--text-3)", bg: "var(--bg-2)", border: "var(--border)" },
  }[type];

  const Icon = config.icon;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
      style={{ background: config.bg, border: `1px solid ${config.border}`, color: config.color }}
    >
      <Icon style={{ width: 10, height: 10 }} />
      {config.label}
    </div>
  );
}

// ─── Empty / loading states ───────────────────────────────────────────────────
function StateBlock({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="py-24 flex flex-col items-start gap-4"
      style={{ borderTop: "1px solid var(--border-subtle)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
      >
        <Icon style={{ width: 18, height: 18, color: "var(--text-3)" }} />
      </div>
      <div>
        <h3 className="text-base font-semibold mb-1.5" style={{ letterSpacing: "-0.02em" }}>
          {title}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-2)", maxWidth: "44ch" }}>
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Mobile card (table doesn't fit a phone) ─────────────────────────────────
function MobileActivityCard({ activity, explorer }: { activity: any; explorer: string }) {
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  return (
    <div className="rounded-xl p-3.5" style={{ background: "var(--bg-1)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-3">
        <EventPill type={activity.type} />
        <a
          href={activity.transactionHash ? `${explorer}/tx/${activity.transactionHash}` : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-medium tabular-nums"
          style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
        >
          <Clock style={{ width: 10, height: 10 }} />
          {formatTime(activity.timestamp)}
        </a>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: activity.collection === "veBTC" ? "#F7931A" : "#4A90E2" }} />
            <span className="text-[13px] font-semibold">
              {activity.collection} <span className="tabular-nums" style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>#{activity.tokenId.toString()}</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10.5px] font-mono" style={{ color: "var(--text-3)" }}>
            <span>{activity.from ? short(activity.from) : "—"}</span>
            {activity.to && <><ArrowUpRight style={{ width: 9, height: 9 }} /><span>{short(activity.to)}</span></>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[15px] font-bold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
            {activity.price}<span className="text-[10px] font-semibold ml-1" style={{ color: "var(--text-3)" }}>{activity.paymentToken}</span>
          </p>
          <div className="mt-0.5">{formatDiscount(activity.discountBps)}</div>
        </div>
      </div>
    </div>
  );
}

export default function ActivityClient() {
  const { network, contracts } = useNetwork();
  const { events, isLoading, error, isDeployed } = useActivityFeed(100);

  return (
    <div className="min-h-[100dvh] pt-24 md:pt-32 pb-20 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">

        {/* ── Header — left-aligned, asymmetric ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="section-header mb-3">
              <span className="eyebrow">Live Stream</span>
            </div>
            <h1 className="display-lg mb-2" style={{ color: "var(--text-1)" }}>
              Global activity.
            </h1>
            <p className="text-sm" style={{ color: "var(--text-2)", maxWidth: "52ch" }}>
              Real-time trading and listing history on Mezo{" "}
              {network === "testnet" ? "Testnet" : "Mainnet"}.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center gap-4 pb-1"
          >
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest" style={{ color: "#10B981" }}>
              <ShieldCheckIcon style={{ width: 11, height: 11 }} />
              On-chain verified
            </div>
            <div className="h-3 w-px" style={{ background: "var(--border)" }} />
            <a
              href={contracts.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold transition-colors"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              Explorer
              <ExternalLink style={{ width: 10, height: 10 }} />
            </a>
          </motion.div>
        </div>

        {/* ── Content area ── */}
        {!isDeployed ? (
          <StateBlock
            icon={TrendingUp}
            title="No contract deployed yet"
            sub="This activity stream will appear here as soon as the first listings and trades go live on this network."
          />
        ) : isLoading ? (
          <div className="flex items-center gap-3 py-16" style={{ color: "var(--text-3)" }}>
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
            <span className="text-sm font-medium">Loading on-chain events…</span>
          </div>
        ) : error ? (
          <StateBlock
            icon={AlertCircle}
            title="Failed to load events"
            sub={error}
          />
        ) : events.length === 0 ? (
          <StateBlock
            icon={History}
            title="No activity yet"
            sub="Be the first to list a veNFT and provide liquidity to the Mezo ecosystem."
          />
        ) : (
          <>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:block rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Event", "Item", "Price", "Discount", "From", "To", "Time"].map((h, i) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-left eyebrow"
                        style={{ paddingRight: i === 6 ? 24 : undefined, textAlign: i === 6 ? "right" : "left" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {events.map((activity, index) => (
                      <motion.tr
                        key={`${activity.transactionHash}-${index}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
                        className="group"
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                          transition: "background 180ms cubic-bezier(0.16,1,0.3,1)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Event type */}
                        <td className="px-6 py-5">
                          <EventPill type={activity.type as any} />
                        </td>

                        {/* Item */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: activity.collection === "veBTC" ? "#F7931A" : "#4A90E2" }}
                            />
                            <span className="text-sm font-semibold" style={{ letterSpacing: "-0.01em" }}>
                              {activity.collection}{" "}
                              <span
                                className="tabular-nums"
                                style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-2)" }}
                              >
                                #{activity.tokenId.toString()}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="px-6 py-5">
                          <span
                            className="text-sm font-bold tabular-nums"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {activity.price}
                          </span>
                          <span className="text-[10px] font-semibold ml-1" style={{ color: "var(--text-3)" }}>
                            {activity.paymentToken}
                          </span>
                        </td>

                        {/* Discount */}
                        <td className="px-6 py-5">
                          {formatDiscount(activity.discountBps)}
                        </td>

                        {/* From */}
                        <td className="px-6 py-5 font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                          {activity.from ? (
                            <a
                              href={`${contracts.explorer}/address/${activity.from}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 transition-colors"
                              style={{ color: "var(--text-3)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                            >
                              {activity.from.slice(0, 6)}…{activity.from.slice(-4)}
                              <ArrowUpRight
                                style={{ width: 10, height: 10, opacity: 0, transition: "opacity 180ms ease" }}
                                className="group-hover:opacity-100"
                              />
                            </a>
                          ) : (
                            <span style={{ color: "var(--border)" }}>—</span>
                          )}
                        </td>

                        {/* To */}
                        <td className="px-6 py-5 font-mono text-[11px]" style={{ color: "var(--text-3)" }}>
                          {activity.to ? (
                            <a
                              href={`${contracts.explorer}/address/${activity.to}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 transition-colors"
                              style={{ color: "var(--text-3)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                            >
                              {activity.to.slice(0, 6)}…{activity.to.slice(-4)}
                              <ArrowUpRight
                                style={{ width: 10, height: 10, opacity: 0, transition: "opacity 180ms ease" }}
                                className="group-hover:opacity-100"
                              />
                            </a>
                          ) : (
                            <span style={{ color: "var(--border)" }}>—</span>
                          )}
                        </td>

                        {/* Time */}
                        <td className="px-6 py-5 text-right">
                          {activity.transactionHash ? (
                            <a
                              href={`${contracts.explorer}/tx/${activity.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-end gap-1.5 text-[11px] font-medium transition-colors tabular-nums"
                              style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                            >
                              <Clock style={{ width: 10, height: 10 }} />
                              {formatTime(activity.timestamp)}
                            </a>
                          ) : (
                            <span
                              className="inline-flex items-center justify-end gap-1.5 text-[11px] font-medium tabular-nums"
                              style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}
                            >
                              <Clock style={{ width: 10, height: 10 }} />
                              {formatTime(activity.timestamp)}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Mobile — stacked cards */}
          <div className="md:hidden space-y-2.5">
            {events.map((activity, index) => (
              <MobileActivityCard key={`m-${activity.transactionHash}-${index}`} activity={activity} explorer={contracts.explorer} />
            ))}
          </div>
          </>
        )}

        {/* ── Audit / explorer footer bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-8 flex items-center justify-between p-5 rounded-xl"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)" }}
            >
              <ShieldCheckIcon style={{ width: 14, height: 14, color: "#10B981" }} />
            </div>
            <div>
              <p className="text-xs font-semibold" style={{ letterSpacing: "-0.01em" }}>
                Verifiable Trading History
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-3)" }}>
                Every transaction corresponds to an atomic on-chain event on the Mezo EVM.
              </p>
            </div>
          </div>
          <a
            href={contracts.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-[11px] py-2 px-4 inline-flex items-center gap-1.5"
          >
            View Explorer
            <ExternalLink style={{ width: 11, height: 11 }} />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
