"use client";

import Link from "next/link";
import { useNetwork } from "@/hooks/useNetwork";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import {
  ArrowRight,
  Shield,
  BarChart3,
  MousePointer2,
  Zap,
  TrendingUp,
  Lock,
  ChevronRight,
} from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { VezoLogoMark } from "@/components/Header";

// ─── Magnetic button ──────────────────────────────────────────────────────────
function MagneticButton({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 120, damping: 22 });
  const springY = useSpring(y, { stiffness: 120, damping: 22 });

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.22);
    y.set((e.clientY - cy) * 0.22);
  }, [x, y]);

  const onMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      style={{ x: springX, y: springY }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="inline-block"
    >
      <Link href={href || "#"} ref={ref as any} className={className}>
        {children}
      </Link>
    </motion.div>
  );
}

// ─── Feature row ──────────────────────────────────────────────────────────────
function FeatureRow({
  icon: Icon,
  title,
  desc,
  index,
  accentColor,
}: {
  icon: any;
  title: string;
  desc: string;
  index: number;
  accentColor: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-5 py-7"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <motion.div
        className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center mt-0.5"
        style={{
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}22`,
          boxShadow: `0 0 24px ${accentColor}0e`,
        }}
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Icon style={{ color: accentColor, width: 18, height: 18 }} />
      </motion.div>
      <div className="flex-1 min-w-0">
        <h4
          className="font-semibold text-base mb-1.5"
          style={{ letterSpacing: "-0.02em", color: "var(--text-1)" }}
        >
          {title}
        </h4>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)", maxWidth: "50ch" }}>
          {desc}
        </p>
      </div>
      <span
        className="shrink-0 text-[9px] font-black tabular-nums mt-1.5"
        style={{ color: accentColor, letterSpacing: "0.05em" }}
      >
        0{index + 1}
      </span>
    </motion.div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="eyebrow" style={{ color: "var(--text-3)" }}>{label}</span>
      <span
        className="font-bold tabular-nums"
        style={{
          fontSize: "clamp(1rem, 1.8vw, 1.3rem)",
          letterSpacing: "-0.035em",
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Demo card — interactive cursor spotlight ─────────────────────────────────
function DemoCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: `1px solid ${hovered ? "rgba(255,0,64,0.28)" : "var(--border-subtle)"}`,
        boxShadow: hovered ? "var(--shadow-card-hover)" : "var(--shadow-md)",
        transition: "box-shadow 300ms cubic-bezier(0.16,1,0.3,1), border-color 300ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Cursor spotlight */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          opacity: hovered ? 1 : 0,
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,0,64,0.065), transparent 60%)`,
          transition: "opacity 300ms ease",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Top color band */}
      <div style={{ height: 2, background: "linear-gradient(90deg, #FF0040, #F7931A)", position: "relative", zIndex: 1 }} />

      <div className="p-6 relative" style={{ zIndex: 1 }}>
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F7931A]" />
              <span className="eyebrow" style={{ color: "var(--text-3)" }}>veBTC #842</span>
            </div>
            <p className="text-[9px] font-mono" style={{ color: "var(--text-3)" }}>
              Listed 2h ago · 0xa8f2…3e14
            </p>
          </div>
          <div
            className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.22)",
              color: "#10B981",
            }}
          >
            14% Off
          </div>
        </div>

        {/* Value */}
        <div className="mb-5">
          <p className="eyebrow mb-1">Intrinsic Value</p>
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-bold tabular-nums"
              style={{
                fontSize: "clamp(1.8rem,3vw,2.4rem)",
                letterSpacing: "-0.04em",
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-1)",
              }}
            >
              0.5200
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-2)" }}>BTC</span>
          </div>
        </div>

        {/* Discount track */}
        <div className="mb-5">
          <div className="flex justify-between text-[10px] mb-1.5" style={{ color: "var(--text-3)" }}>
            <span>Price vs Intrinsic</span>
            <span style={{ color: "#10B981", fontWeight: 700 }}>14% below spot</span>
          </div>
          <div className="discount-track">
            <motion.div
              className="discount-fill"
              initial={{ width: 0 }}
              whileInView={{ width: "86%" }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--text-3)" }}>
            <span className="tabular-nums">0.45 BTC listing</span>
            <span className="tabular-nums">0.52 BTC intrinsic</span>
          </div>
        </div>

        {/* Stats 2-col */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: "Lock Ends", value: "22 days" },
            { label: "Voting Power", value: "0.48" },
          ].map((s) => (
            <div
              key={s.label}
              className="p-3 rounded-xl"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border-subtle)" }}
            >
              <p className="eyebrow mb-1">{s.label}</p>
              <p
                className="text-sm font-semibold tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-1)" }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Buy button */}
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 1, scale: 0.984 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 group relative overflow-hidden btn-primary"
        >
          <span
            aria-hidden
            className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
            style={{ transition: "transform 600ms ease" }}
          />
          Buy Now
          <ArrowRight style={{ width: 14, height: 14 }} className="group-hover:translate-x-0.5 transition-transform relative z-10" />
        </motion.button>
      </div>
    </div>
  );
}

// ─── Floating badge ────────────────────────────────────────────────────────────
function FloatingBadge({
  children,
  style,
  delay = 0.8,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="absolute rounded-xl px-3 py-2 text-[10px] font-bold"
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        backdropFilter: "blur(16px)",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Trust pill ────────────────────────────────────────────────────────────────
function TrustPill({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold"
      style={{
        background: `${color}0e`,
        border: `1px solid ${color}20`,
        color: "var(--text-2)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function HomeClient() {
  const { network } = useNetwork();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 55]);

  return (
    <div className="relative min-h-[100dvh]">

      {/* ══ HERO ══ */}
      <section ref={heroRef} className="relative pt-36 pb-24 lg:pt-52 lg:pb-44 px-4 md:px-8 overflow-hidden">

        {/* Subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none grid-overlay"
        />

        {/* Large red glow behind hero content */}
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(ellipse, rgba(255,0,64,0.05) 0%, transparent 65%)",
            filter: "blur(60px)",
            zIndex: 0,
          }}
        />

        <div className="max-w-[1400px] mx-auto relative" style={{ zIndex: 1 }}>
          <div className="grid lg:grid-cols-[1fr_460px] xl:grid-cols-[1fr_500px] gap-16 xl:gap-24 items-center">

            {/* ── Left: headline + CTA ── */}
            <motion.div style={{ opacity: heroOpacity, y: heroY }}>

              {/* Live status badge */}
              <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2.5 mb-8 px-3.5 py-2 rounded-full"
                style={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="relative flex h-2 w-2">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                    style={{ background: "#FF0040" }}
                  />
                  <span className="relative inline-flex rounded-full h-2 w-2 live-dot" style={{ background: "#FF0040" }} />
                </div>
                <span className="eyebrow" style={{ color: "var(--text-2)" }}>
                  Live on Mezo {network === "testnet" ? "Testnet" : "Mainnet"}
                </span>
              </motion.div>

              {/* Logo mark — large hero feature */}
              <motion.div
                initial={{ opacity: 0, scale: 0.84, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="mb-8"
              >
                <VezoLogoMark size={72} />
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="display-xl mb-6"
                style={{ color: "var(--text-1)" }}
              >
                The liquidity<br />
                layer for locked<br />
                <span style={{ color: "#FF0040" }}>Bitcoin.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="text-base leading-relaxed mb-10"
                style={{ color: "var(--text-2)", maxWidth: "46ch" }}
              >
                Buy and sell vote-escrowed BTC and MEZO positions.
                Governance NFTs at market-determined discounts — atomic, escrowless, on Mezo.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap gap-3 mb-14"
              >
                <MagneticButton href="/marketplace" className="btn-primary text-sm gap-2">
                  Enter Marketplace
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </MagneticButton>
                <MagneticButton href="/docs" className="btn-outline text-sm">
                  Read the Docs
                </MagneticButton>
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.5 }}
                className="flex flex-wrap gap-x-8 gap-y-5 pt-8"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
              >
                <StatChip label="Network" value="Mezo EVM" color="var(--text-1)" />
                <div className="w-px self-stretch" style={{ background: "var(--border-subtle)" }} />
                <StatChip label="Assets" value="veBTC · veMEZO" color="var(--text-1)" />
                <div className="w-px self-stretch" style={{ background: "var(--border-subtle)" }} />
                <StatChip label="Protocol fee" value="1.00%" color="var(--text-2)" />
                <div className="w-px self-stretch" style={{ background: "var(--border-subtle)" }} />
                <StatChip label="Settlement" value="Atomic" color="#10B981" />
              </motion.div>
            </motion.div>

            {/* ── Right: demo card ── */}
            <motion.div
              initial={{ opacity: 0, x: 40, y: 16 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:block relative"
              style={{ animation: "float 9s ease-in-out infinite" }}
            >
              {/* Background glow behind card */}
              <div
                aria-hidden
                className="absolute -inset-10 blur-[72px] rounded-3xl pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse, rgba(255,0,64,0.07) 0%, transparent 70%)",
                  zIndex: -1,
                }}
              />

              {/* Floating badges */}
              <FloatingBadge
                style={{ top: -20, right: 16, color: "#10B981", display: "flex", alignItems: "center", gap: 6 }}
                delay={0.85}
              >
                <Zap style={{ width: 10, height: 10, color: "#10B981" }} />
                Escrowless · Atomic
              </FloatingBadge>

              <FloatingBadge
                style={{ bottom: -22, left: 16, color: "#F7931A", display: "flex", alignItems: "center", gap: 6 }}
                delay={1.0}
              >
                <Lock style={{ width: 10, height: 10, color: "#F7931A" }} />
                Position stays in wallet
              </FloatingBadge>

              <DemoCard />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ TRUST STRIP ══ */}
      <section className="py-10 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {[
              { label: "NFT stays in your wallet", color: "#FF0040" },
              { label: "Rewards continue until sale", color: "#F7931A" },
              { label: "No whitelist or curation", color: "#10B981" },
              { label: "Audited smart contracts", color: "#4A90E2" },
              { label: "Atomic settlement", color: "#8B5CF6" },
            ].map((t) => (
              <TrustPill key={t.label} {...t} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className="py-28 px-4 md:px-8 relative">
        <div className="max-w-[1400px] mx-auto mb-20">
          <div className="rule-fade" />
        </div>

        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[1fr_560px] gap-20 xl:gap-32 items-start">

          {/* Left sticky label */}
          <div className="lg:sticky lg:top-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="section-header mb-4">
                <span className="eyebrow">Why Vezo</span>
              </div>
              <h2 className="display-lg mb-6" style={{ color: "var(--text-1)" }}>
                Built on<br />security &<br />fairness.
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-2)", maxWidth: "40ch" }}>
                The Mezo ecosystem needed a way to exit locked positions without surrendering voting rights until the final moment. Vezo makes that possible.
              </p>

              {/* Mark repeat — small */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mb-8"
              >
                <VezoLogoMark size={38} />
              </motion.div>

              <div className="flex flex-col gap-3">
                {[
                  { label: "NFT stays in your wallet", color: "#FF0040" },
                  { label: "Rewards continue until sale", color: "#F7931A" },
                  { label: "No whitelist or curation", color: "#10B981" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="flex items-center gap-2.5 text-xs font-semibold"
                    style={{ color: "var(--text-2)" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />
                    {m.label}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right feature rows */}
          <div>
            {[
              {
                icon: Shield,
                title: "Escrowless by design",
                desc: "Your NFT stays in your wallet. Voting rights and reward accrual continue until the exact block of sale.",
                color: "#FF0040",
              },
              {
                icon: BarChart3,
                title: "Real-time intrinsic value",
                desc: "Each listing calculates locked BTC value accounting for voting power decay across veBTC and veMEZO lock structures.",
                color: "#F7931A",
              },
              {
                icon: TrendingUp,
                title: "Market-driven price discovery",
                desc: "Discounts are determined entirely by supply and demand. No oracle manipulation, no admin pricing.",
                color: "#10B981",
              },
              {
                icon: MousePointer2,
                title: "Open market, no gatekeeping",
                desc: "Any holder can list. Price discovery is driven by live bids and asks — no whitelists or curation.",
                color: "#4A90E2",
              },
            ].map((f, i) => (
              <FeatureRow key={f.title} {...f} index={i} accentColor={f.color} />
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="py-28 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-20"
          >
            <div className="section-header justify-center mb-5">
              <span className="eyebrow">How it works</span>
            </div>
            <h2 className="display-lg" style={{ color: "var(--text-1)" }}>
              Three steps to<br />exit your position.
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "List your veNFT",
                desc: "Connect your wallet. Set a price. The NFT stays in your wallet — no escrow, no custody.",
                color: "#FF0040",
              },
              {
                step: "02",
                title: "Buyer approves + buys",
                desc: "Buyers approve the payment token and execute the purchase. Everything happens in a single atomic transaction.",
                color: "#F7931A",
              },
              {
                step: "03",
                title: "Atomic settlement",
                desc: "NFT transfers to the buyer, payment routes to the seller. If anything fails, the entire transaction reverts.",
                color: "#10B981",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative p-7 rounded-2xl group"
                style={{
                  background: "var(--bg-1)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "var(--shadow-md)",
                  transition: "border-color 220ms var(--ease-spring), box-shadow 220ms var(--ease-spring), transform 220ms var(--ease-spring)",
                }}
                whileHover={{
                  y: -3,
                  transition: { type: "spring", stiffness: 300, damping: 22 },
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${item.color}28`;
                  e.currentTarget.style.boxShadow = `var(--shadow-card-hover), 0 0 0 1px ${item.color}12`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${item.color}, transparent)`, opacity: 0.6 }} />
                <span
                  className="text-[11px] font-black tracking-widest mb-5 block"
                  style={{ color: item.color }}
                >
                  {item.step}
                </span>
                <h3 className="text-lg font-bold mb-3" style={{ letterSpacing: "-0.03em", color: "var(--text-1)" }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="py-28 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl p-12 md:p-16 relative overflow-hidden"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {/* Background blob */}
            <div
              aria-hidden
              className="absolute -top-24 -right-24 w-[600px] h-[600px] rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(ellipse, rgba(255,0,64,0.065) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
            />
            <div
              aria-hidden
              className="absolute -bottom-16 -left-16 w-[350px] h-[350px] rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(ellipse, rgba(247,147,26,0.045) 0%, transparent 70%)",
                filter: "blur(50px)",
              }}
            />

            <div className="relative z-10 max-w-lg">
              <VezoLogoMark size={50} />
              <h2 className="display-lg mt-7 mb-4" style={{ color: "var(--text-1)" }}>
                Join the Mezo<br />governance market.
              </h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-2)", maxWidth: "44ch" }}>
                Whether you want to exit a locked position or acquire voting exposure to Bitcoin rewards, Vezo is where that trade happens.
              </p>
              <div className="flex flex-wrap gap-3">
                <MagneticButton href="/marketplace" className="btn-primary text-sm gap-2">
                  Start trading
                  <ArrowRight style={{ width: 14, height: 14 }} />
                </MagneticButton>
                <a
                  href="https://github.com/prajalsharma/veNFT-marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline text-sm"
                >
                  Source code
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
