"use client";

/**
 * OnboardingTour
 * ──────────────
 * A small, first-visit walkthrough that explains what Vezo is and how to use it.
 * Auto-opens once per browser (localStorage), and can be reopened anytime by
 * dispatching `window.dispatchEvent(new CustomEvent("vezo:open-tour"))` — the
 * footer "How it works" link does exactly that.
 *
 * Matches the existing design system (CSS-var tokens, Vezo red accent, liquid-glass
 * modal). Fully keyboard-accessible (Esc to close, ←/→ to navigate, Enter to advance)
 * and respects prefers-reduced-motion.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X, ArrowRight, ArrowLeft, Sparkles, Eye, Zap, Tag, ShieldCheck, Wallet,
} from "lucide-react";

const STORAGE_KEY = "vezo-onboarded-v1";
const ACCENT = "#FF0040";

interface Step {
  icon: typeof Sparkles;
  badge: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    badge: "Welcome",
    title: "Trade locked BTC & MEZO positions",
    body: "Vezo is a peer-to-peer marketplace for veBTC and veMEZO vote-escrow NFTs. It unlocks liquidity on positions that are otherwise locked for months — buy, sell, or browse in a few clicks.",
  },
  {
    icon: Eye,
    badge: "Browse & buy",
    title: "See real value before you buy",
    body: "Every listing shows intrinsic value, voting power, lock expiry, and the discount to fair value. Pay in BTC, MEZO, or MUSD — the NFT and your payment swap together in one atomic transaction.",
  },
  {
    icon: Tag,
    badge: "Sell",
    title: "List in seconds, keep custody",
    body: "Own a veNFT? List it at any price. It stays in your wallet until it sells — no escrow, no lock-up — and you can cancel anytime with no penalty.",
  },
  {
    icon: ShieldCheck,
    badge: "Safe by design",
    title: "Escrowless & trust-minimized",
    body: "The NFT transfers before payment is routed; if anything is off, the whole transaction reverts automatically. No custody, no counterparty risk. Connect your wallet to get started.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  const isLast = i === STEPS.length - 1;

  const finish = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  const go = useCallback((next: number) => {
    setDir(next > i ? 1 : -1);
    setI(Math.max(0, Math.min(STEPS.length - 1, next)));
  }, [i]);

  // First-visit auto-open + external reopen trigger.
  useEffect(() => {
    let seen = "1";
    try { seen = localStorage.getItem(STORAGE_KEY) ?? ""; } catch { /* ignore */ }
    if (!seen) {
      const t = setTimeout(() => { setI(0); setOpen(true); }, 650);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const reopen = () => { setI(0); setDir(1); setOpen(true); };
    window.addEventListener("vezo:open-tour", reopen);
    return () => window.removeEventListener("vezo:open-tour", reopen);
  }, []);

  // Move focus into the dialog when it opens (accessibility).
  useEffect(() => { if (open) panelRef.current?.focus(); }, [open]);

  // Keyboard: Esc closes, arrows navigate, Enter advances.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (!isLast) go(i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (i > 0) go(i - 1); }
      else if (e.key === "Enter") { e.preventDefault(); isLast ? finish() : go(i + 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, i, isLast, go, finish]);

  if (!open) return null;
  const step = STEPS[i];
  const Icon = step.icon;
  const slide = reduce ? 0 : 28;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vezo-tour-title"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px) saturate(160%)" }}
          onClick={finish}
        />

        <motion.div
          ref={panelRef}
          tabIndex={-1}
          initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 24 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="relative w-full max-w-lg overflow-hidden rounded-[1.75rem] outline-none"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xl)" }}
        >
          {/* Top accent bar */}
          <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT}44, transparent)` }} />

          {/* Close */}
          <button
            onClick={finish}
            aria-label="Close walkthrough"
            className="absolute right-3 top-3 z-10 p-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>

          <div className="px-7 pt-8 pb-7">
            {/* Animated step body */}
            <div className="relative min-h-[208px]">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={i}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * slide }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -slide }}
                  transition={{ duration: reduce ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${ACCENT}14`, border: `1px solid ${ACCENT}2e` }}
                  >
                    <Icon style={{ width: 22, height: 22, color: ACCENT }} aria-hidden="true" />
                  </div>
                  <span
                    className="inline-block text-[10px] font-black tracking-[0.14em] uppercase px-2 py-1 rounded-md mb-3"
                    style={{ color: ACCENT, background: `${ACCENT}12` }}
                  >
                    {step.badge}
                  </span>
                  <h2 id="vezo-tour-title" className="text-[22px] font-bold tracking-tight leading-tight" style={{ color: "var(--text-1)" }}>
                    {step.title}
                  </h2>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                    {step.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress dots — 40px-tall hit areas, compact visual bars inside */}
            <div className="flex items-center gap-0.5 mt-5 mb-3" role="tablist" aria-label="Walkthrough progress">
              {STEPS.map((s, idx) => (
                <button
                  key={s.badge}
                  role="tab"
                  aria-selected={idx === i}
                  aria-label={`Step ${idx + 1}: ${s.badge}`}
                  onClick={() => go(idx)}
                  className="flex items-center h-10 px-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                >
                  <span
                    className="block h-1.5 rounded-full transition-all"
                    style={{ width: idx === i ? 26 : 8, background: idx === i ? ACCENT : "var(--border-strong)" }}
                  />
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {i > 0 ? (
                <button
                  onClick={() => go(i - 1)}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
                >
                  <ArrowLeft style={{ width: 15, height: 15 }} /> Back
                </button>
              ) : (
                <button
                  onClick={finish}
                  className="px-4 py-3 rounded-xl text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  Skip
                </button>
              )}

              <button
                onClick={() => (isLast ? finish() : go(i + 1))}
                className="flex-1 btn-primary py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[14px] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040] focus-visible:ring-offset-2"
              >
                {isLast ? (
                  <><Wallet style={{ width: 16, height: 16 }} /> Start exploring</>
                ) : (
                  <>Next <ArrowRight style={{ width: 16, height: 16 }} className="group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

/** Imperatively open the tour from anywhere (e.g. a "How it works" link). */
export function openOnboardingTour() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vezo:open-tour"));
}
