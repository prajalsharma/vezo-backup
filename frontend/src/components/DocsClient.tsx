"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Zap,
  Lock,
  ArrowRight,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Code2,
  Terminal,
  ChevronRight,
  GitBranch,
  Layers,
  Route,
  Settings2,
  Gavel,
  Camera,
  LineChart,
  ArrowLeftRight,
} from "lucide-react";
import Link from "next/link";
import { VezoLogoMark } from "@/components/Header";

// ─── Contract card ────────────────────────────────────────────────────────────
function ContractCard({
  title,
  description,
  href,
  icon: Icon,
  accentColor,
  index,
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
  accentColor: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-md)",
        transition: "border-color 220ms var(--ease-spring), box-shadow 220ms var(--ease-spring), transform 220ms var(--ease-spring)",
      }}
      whileHover={{ y: -2 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accentColor}28`;
        e.currentTarget.style.boxShadow = `var(--shadow-card-hover), 0 0 0 1px ${accentColor}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border-subtle)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
    >
      {/* Color band */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)`, opacity: 0.7 }} />

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}22` }}
          >
            <Icon style={{ width: 18, height: 18, color: accentColor }} />
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            Source
            <ExternalLink style={{ width: 10, height: 10 }} />
          </a>
        </div>
        <h4
          className="text-sm font-bold mb-2"
          style={{ letterSpacing: "-0.025em", color: "var(--text-1)" }}
        >
          {title}
        </h4>
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
          {description}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Security check row ───────────────────────────────────────────────────────
function SecurityCheck({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <CheckCircle2 style={{ width: 13, height: 13, color: "#10B981", flexShrink: 0 }} />
      <span className="text-xs font-mono" style={{ color: "var(--text-2)" }}>
        {text}
      </span>
    </div>
  );
}

// ─── Intro card ───────────────────────────────────────────────────────────────
function IntroCard({
  icon: Icon,
  title,
  description,
  accentColor,
  index,
}: {
  icon: any;
  title: string;
  description: string;
  accentColor: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 rounded-2xl"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
        style={{ background: `${accentColor}0e`, border: `1px solid ${accentColor}22` }}
      >
        <Icon style={{ width: 18, height: 18, color: accentColor }} />
      </div>
      <h3 className="text-sm font-bold mb-2" style={{ letterSpacing: "-0.025em", color: "var(--text-1)" }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
        {description}
      </p>
    </motion.div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({
  icon: Icon,
  label,
  title,
  accentColor = "#FF0040",
}: {
  icon: any;
  label: string;
  title: string;
  accentColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-10"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${accentColor}0e`, border: `1px solid ${accentColor}22` }}
        >
          <Icon style={{ width: 14, height: 14, color: accentColor }} />
        </div>
        <span className="eyebrow">{label}</span>
      </div>
      <h2 className="display-md" style={{ color: "var(--text-1)" }}>
        {title}
      </h2>
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function DocsClient() {
  return (
    <div className="min-h-[100dvh] pt-28 pb-24 px-4 md:px-8 page-enter">
      <div className="max-w-[1100px] mx-auto">

        {/* ── Hero ── */}
        <div className="mb-20">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2.5 mb-8"
          >
            <VezoLogoMark size={28} />
            <div className="section-header">
              <span className="eyebrow">Documentation</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="display-xl mb-6"
            style={{ color: "var(--text-1)" }}
          >
            Technical<br />
            <span style={{ color: "var(--vezo-red)" }}>Architecture.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="text-base leading-relaxed"
            style={{ color: "var(--text-2)", maxWidth: "54ch" }}
          >
            Vezo is a production-grade, escrowless peer-to-peer marketplace for trading vote-escrowed NFTs on the Mezo network.
          </motion.p>
        </div>

        {/* Rule */}
        <div className="rule-fade mb-16" />

        {/* ── Overview cards ── */}
        <div className="grid md:grid-cols-3 gap-4 mb-24">
          {[
            {
              icon: Zap,
              title: "Escrowless by Design",
              description: "veNFTs stay in your wallet until the exact moment of sale. No custody, no third-party risk. Voting rights and rewards accrue up to the final block.",
              accentColor: "#FF0040",
            },
            {
              icon: Lock,
              title: "veNFT Mechanics",
              description: "Mezo users lock BTC or MEZO to receive vote-escrow NFTs. Each carries intrinsic value based on locked amount, lock duration, and live voting power decay.",
              accentColor: "#F7931A",
            },
            {
              icon: Shield,
              title: "Audited Contracts",
              description: "Built on battle-tested OpenXSwap fork patterns. All contract modifications from the audited base are documented with a complete diff.",
              accentColor: "#10B981",
            },
          ].map((card, i) => (
            <IntroCard key={card.title} {...card} index={i} />
          ))}
        </div>

        {/* ── Smart Contracts ── */}
        <section className="mb-24">
          <SectionHeading icon={Code2} label="Contracts" title="Smart Contract Modules" accentColor="#FF0040" />

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Layers,
                title: "VeNFTMarketplace.sol",
                description: "Core marketplace logic for listing, updating, and purchasing NFTs. Implements CEI (Check-Effects-Interactions) pattern to prevent reentrancy. Supports BTC, MEZO, and MUSD as payment tokens.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/VeNFTMarketplace.sol",
                accentColor: "#FF0040",
              },
              {
                icon: GitBranch,
                title: "MezoVeNFTAdapter.sol",
                description: "Read-only abstraction layer querying Mezo's veBTC and veMEZO contracts. Surfaces intrinsic value, voting power decay, lock expiry, and discount calculations. Zero state-modification surface.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/adapters/MezoVeNFTAdapter.sol",
                accentColor: "#F7931A",
              },
              {
                icon: Route,
                title: "PaymentRouter.sol",
                description: "Routes payments from buyer to seller with a 1% default protocol fee. Supports native BTC and ERC-20 tokens (MEZO, MUSD). Restricted to marketplace-only calls — no external address can trigger payment routing.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/PaymentRouter.sol",
                accentColor: "#10B981",
              },
              {
                icon: Settings2,
                title: "MarketplaceAdmin.sol",
                description: "Governance with role-based access control (PAUSER, FEE_MANAGER, COLLECTION_MANAGER). Fee changes require a 48-hour timelock. Emergency pause halts the entire marketplace instantly.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/MarketplaceAdmin.sol",
                accentColor: "#4A90E2",
              },
            ].map((c, i) => (
              <ContractCard key={c.title} {...c} index={i} />
            ))}
          </div>
        </section>

        {/* ── New Modules (v2) ── */}
        <section className="mb-24">
          <SectionHeading icon={Layers} label="New in v2" title="Liquidity Infrastructure" accentColor="#4A90E2" />

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                icon: Gavel,
                title: "VeNFTBidding.sol",
                description: "On-chain offer/bid system. Buyers lock funds via ERC-20 approval; sellers accept at any time within the bid's validity window. Bid structs carry optional intrinsic-value, voting-power, and lock-duration constraints for sophisticated buyers.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/VeNFTBidding.sol",
                accentColor: "#4A90E2",
              },
              {
                icon: Camera,
                title: "ListingSnapshotStore.sol",
                description: "Immutable on-chain record of each listing's intrinsic value, voting power, lock duration, and USD value at the moment of listing. Write-once per listing ID. Powers analytics dashboards and discount-at-listing auditing.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/ListingSnapshotStore.sol",
                accentColor: "#10B981",
              },
              {
                icon: LineChart,
                title: "PriceOracleHub.sol",
                description: "Modular oracle aggregation layer. Supports pluggable IPriceAdapter feeds (Chainlink, Pyth, or mock for testnet). Each feed has a configurable staleness window. Powers USD-normalized valuations across the protocol.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/oracles/PriceOracleHub.sol",
                accentColor: "#F7931A",
              },
              {
                icon: ArrowLeftRight,
                title: "QuoteRouter + SwapRouter",
                description: "Cross-currency settlement layer. QuoteRouter generates 5-minute, slippage-bounded quotes (settlementToken → paymentToken via oracle prices). SwapRouter executes the settlement, pulling buyer tokens and routing to the seller via PaymentRouter. Pluggable DEX adapter (Uniswap v3 / aggregator) for production.",
                href: "https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/swap/SwapRouter.sol",
                accentColor: "#FF0040",
              },
            ].map((c, i) => (
              <ContractCard key={c.title} {...c} index={i} />
            ))}
          </div>

          {/* New security checklist additions */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 rounded-2xl p-6"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p className="eyebrow mb-4" style={{ color: "#4A90E2" }}>v2 Security Properties</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                "CEI preserved in acceptBid() — state updated before external calls",
                "ReentrancyGuard on all bid write paths",
                "SafeERC20 on bid fund pulls and settlements",
                "Snapshot store is write-once per listingId — no overwrite attack surface",
                "Oracle feeds have configurable staleness windows — stale prices revert",
                "QuoteRouter fee capped at MAX_SWAP_FEE_BPS = 300 bps (3%)",
                "SwapRouter onlyAuthorised caller guard — arbitrary execution blocked",
                "viaIR optimizer enabled for stack-deep bid structs (11 params)",
              ].map((check) => (
                <div key={check} className="flex items-start gap-2.5">
                  <CheckCircle2 style={{ width: 12, height: 12, color: "#10B981", flexShrink: 0, marginTop: 2 }} />
                  <span className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>{check}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Security ── */}
        <section className="mb-24">
          <SectionHeading icon={AlertCircle} label="Security" title="Audit Readiness" accentColor="#10B981" />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl overflow-hidden"
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border-subtle)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="grid md:grid-cols-2">
              {/* Left — checklist */}
              <div className="p-8 md:p-10">
                <div className="flex items-center gap-2 mb-8">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)" }}
                  >
                    <Shield style={{ width: 14, height: 14, color: "#10B981" }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#10B981" }}>
                    Protections
                  </span>
                </div>

                <div className="space-y-5">
                  {[
                    {
                      title: "Reentrancy Protection",
                      desc: "All value-transferring functions use OpenZeppelin's ReentrancyGuard.",
                    },
                    {
                      title: "Role-Based Access Control",
                      desc: "Granular roles (PAUSER, FEE_MANAGER) managed via MarketplaceAdmin.",
                    },
                    {
                      title: "Safe Payments",
                      desc: "PaymentRouter uses SafeERC20 for all ERC-20 token distributions.",
                    },
                    {
                      title: "Timelock on Fee Changes",
                      desc: "Protocol fee modifications require a 48-hour waiting period before taking effect.",
                    },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3">
                      <CheckCircle2
                        style={{ width: 14, height: 14, color: "#10B981", flexShrink: 0, marginTop: 2 }}
                      />
                      <div>
                        <p className="text-xs font-bold mb-0.5" style={{ color: "var(--text-1)" }}>
                          {item.title}
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — terminal checklist */}
              <div
                className="p-8 md:p-10 md:border-l"
                style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}
              >
                <div className="flex items-center gap-2 mb-8">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--bg-3)", border: "1px solid var(--border)" }}
                  >
                    <Terminal style={{ width: 14, height: 14, color: "var(--text-2)" }} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
                    Security Checklist
                  </span>
                </div>

                <div className="space-y-2.5">
                  {[
                    "NFT transferred before payment (CEI)",
                    "routePayment: marketplace-only caller",
                    "Expired veNFT purchase blocked",
                    "Self-purchase blocked",
                    "Ownership re-validated at buy time",
                    "ReentrancyGuard on all writes",
                    "SafeERC20 + safeTransferFrom",
                    "48h timelock on fee changes",
                    "Protocol fee hardcapped at 5%",
                    "Integer overflow (Solidity 0.8+)",
                  ].map((check) => (
                    <SecurityCheck key={check} text={`[✓] ${check}`} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── CTA ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl p-10 md:p-14 relative overflow-hidden"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* Background glow */}
          <div
            aria-hidden
            className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse, rgba(255,0,64,0.06) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          {/* Top accent line */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, var(--vezo-red), transparent)", opacity: 0.4 }}
          />

          <div className="relative z-10 max-w-lg">
            <div className="flex items-center gap-3 mb-6">
              <VezoLogoMark size={36} />
              <div className="section-header">
                <span className="eyebrow">Open Source</span>
              </div>
            </div>
            <h2 className="display-md mb-4" style={{ color: "var(--text-1)" }}>
              Contribute to<br />the Ecosystem.
            </h2>
            <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--text-2)", maxWidth: "44ch" }}>
              Vezo is fully open-source. Explore the contracts, report bugs, suggest improvements, or fork and adapt for new ecosystems.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/prajalsharma/veNFT-marketplace"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-sm flex items-center gap-2"
              >
                Explore GitHub
                <ExternalLink style={{ width: 13, height: 13 }} />
              </a>
              <Link href="/marketplace" className="btn-outline text-sm flex items-center gap-2">
                Launch App
                <ArrowRight style={{ width: 13, height: 13 }} />
              </Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
