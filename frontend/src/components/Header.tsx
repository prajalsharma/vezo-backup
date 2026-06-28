"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetwork } from "@/hooks/useNetwork";
import { useAddNetwork } from "@/hooks/useAddNetwork";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Github, BookOpen, FlaskConical, Globe, Sun, Moon, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { usePriceTicker, formatUSD } from "@/hooks/usePriceTicker";

// ─── Official Vezo V-chevron mark ────────────────────────────────────────────
export function VezoLogoMark({ size = 28, notchColor }: { size?: number; notchColor?: string }) {
  const nc = notchColor ?? "var(--logo-notch)";
  const h = Math.round(size * 0.714);
  return (
    <svg width={size} height={h} viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <polygon points="8,4 54,4 70,88 24,88" fill="#FF0040" />
      <polygon points="36,4 54,4 62,38 44,38" fill={nc} />
      <polygon points="132,4 86,4 70,88 116,88" fill="#FF0040" />
      <polygon points="104,4 86,4 78,38 96,38" fill={nc} />
      <line x1="70" y1="10" x2="70" y2="88" stroke={nc} strokeWidth="2" />
    </svg>
  );
}

// ─── Minimal logo lockup: mark + wordmark (no sub-tag) ───────────────────────
function VezoLogotype() {
  return (
    <motion.div
      className="flex items-center gap-2"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <VezoLogoMark size={24} />
      <span
        className="text-[18px] sm:text-[19px]"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.05em", lineHeight: 1, color: "var(--text-1)", transition: "color 380ms ease" }}
      >
        vezo
      </span>
    </motion.div>
  );
}

// ─── Theme toggle hook ────────────────────────────────────────────────────────
function useTheme() {
  const [isDark, setIsDark] = useState(false); // default: light
  useEffect(() => {
    const saved = localStorage.getItem("vezo-theme");
    const dark = saved === "dark"; // default light unless the user chose dark
    setIsDark(dark);
    applyTheme(dark);
  }, []);
  function applyTheme(dark: boolean) {
    const html = document.documentElement;
    html.classList.toggle("dark", dark);
    html.classList.toggle("light", !dark);
  }
  function toggle() {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("vezo-theme", next ? "dark" : "light");
    applyTheme(next);
  }
  return { isDark, toggle };
}

// ─── Compact wallet button (replaces RainbowKit's large default) ─────────────
function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, openChainModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        return (
          <div {...(!ready && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none" as const } })}>
            {!connected ? (
              <button
                type="button"
                onClick={openConnectModal}
                className="btn-primary text-[13px] sm:text-sm font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
              >
                Connect<span className="hidden sm:inline"> Wallet</span>
              </button>
            ) : chain.unsupported ? (
              <button
                type="button"
                onClick={openChainModal}
                className="text-[13px] font-bold px-3.5 py-2 rounded-xl whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                style={{ color: "#fff", background: "#EF4444" }}
              >
                Wrong network
              </button>
            ) : (
              <button
                type="button"
                onClick={openAccountModal}
                className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
              >
                <span className="w-5 h-5 rounded-full shrink-0" style={{ background: "linear-gradient(135deg,#FF0040,#ff6a8c)" }} />
                <span className="text-[13px] font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>{account.displayName}</span>
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

// ─── Price Ticker Bar ─────────────────────────────────────────────────────────
// Mobile: an infinite marquee (auto-scrolls so it never looks "stuck").
// Desktop (sm+): a static left-aligned row with the "Live Prices" label.
function PriceTickerBar({ isDark }: { isDark: boolean }) {
  const prices = usePriceTicker();
  const tickers = [
    { label: "BTC",  value: formatUSD(prices.BTC),  color: "#F7931A" },
    { label: "MEZO", value: formatUSD(prices.MEZO), color: "#4A90E2" },
    { label: "MUSD", value: formatUSD(prices.MUSD), color: "#10B981" },
  ];

  const Pill = ({ t }: { t: typeof tickers[number] }) => (
    <div className="flex items-center gap-1.5 px-4 shrink-0">
      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{t.label}</span>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: t.value === "—" ? "var(--text-3)" : t.color, fontVariantNumeric: "tabular-nums" }}>
        {t.value}
      </span>
    </div>
  );

  return (
    <div
      className="border-t h-[32px] sm:h-[36px] overflow-hidden"
      style={{ borderColor: "var(--header-border)", background: isDark ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.55)" }}
    >
      {/* Mobile — infinite marquee (two copies for a seamless loop) */}
      <div className="sm:hidden h-full flex items-center overflow-hidden" aria-label="Live prices">
        <div className="marquee-track items-center">
          {[...tickers, ...tickers].map((t, i) => <Pill key={i} t={t} />)}
        </div>
      </div>

      {/* Desktop — static row */}
      <div className="hidden sm:flex max-w-[1400px] mx-auto h-full px-6 lg:px-8 items-center gap-5">
        <div className="flex items-center gap-1.5 shrink-0" style={{ color: "var(--text-3)" }}>
          <TrendingUp style={{ width: 11, height: 11 }} />
          <span className="text-xs font-black uppercase tracking-widest">Live Prices</span>
        </div>
        <div className="w-px h-3 shrink-0" style={{ background: "var(--border)" }} />
        <div className="flex items-center gap-4 shrink-0">
          {tickers.map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{t.label}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: t.value === "—" ? "var(--text-3)" : t.color, fontVariantNumeric: "tabular-nums" }}>
                {t.value}
              </span>
            </div>
          ))}
        </div>
        {prices.lastUpdated && (
          <span className="ml-auto text-[11px] hidden md:block shrink-0" style={{ color: "var(--text-3)" }}>
            Updated {new Date(prices.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────
export function Header() {
  const { isTestnet, toggleNetwork } = useNetwork();
  const { addNetwork } = useAddNetwork();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();
  const pathname = usePathname();

  const handleNetworkSwitch = async () => {
    try {
      await addNetwork(isTestnet ? "mainnet" : "testnet");
      toggleNetwork();
    } catch (err) {
      console.error("Failed to switch network:", err);
    }
  };

  const navLinks = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/my-listings", label: "My Listings" },
    { href: "/activity", label: "Activity" },
    { href: "/docs", label: "Docs", icon: BookOpen },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
        boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.03), 0 4px 28px rgba(0,0,0,0.45)" : "0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        transition: "background 380ms var(--ease-spring), border-color 380ms var(--ease-spring)",
      }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-[56px] lg:h-[68px] gap-2 sm:gap-3">

          {/* ── Mobile hamburger — LEFT ── */}
          <motion.button
            className="lg:hidden p-2 rounded-xl cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
            style={{ color: "var(--text-2)", background: "var(--bg-2)", border: "1px solid var(--border)" }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.div key="x" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 45 }} transition={{ duration: 0.15 }}>
                  <X style={{ width: 18, height: 18 }} />
                </motion.div>
              ) : (
                <motion.div key="menu" initial={{ opacity: 0, rotate: 45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -45 }} transition={{ duration: 0.15 }}>
                  <Menu style={{ width: 18, height: 18 }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]" aria-label="Vezo home">
            <VezoLogotype />
          </Link>

          {/* ── Desktop nav — center ── */}
          <nav className="hidden lg:flex flex-1 justify-center items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="relative px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040] cursor-pointer"
                  style={{ color: isActive ? "var(--text-1)" : "var(--text-2)", letterSpacing: "-0.01em" }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.color = "var(--text-1)"); }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget.style.color = "var(--text-2)"); }}
                >
                  {isActive && (
                    <motion.div layoutId="nav-active" className="absolute inset-0 rounded-xl" style={{ background: "var(--vezo-red-12)", border: "1px solid var(--vezo-red-22)" }} transition={{ type: "spring", stiffness: 100, damping: 20 }} />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {link.icon && <link.icon style={{ width: 13, height: 13 }} />}
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* ── Right actions ── */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Network toggle — desktop only */}
            <div className="hidden lg:flex items-center rounded-full p-0.5 relative" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <motion.div
                className="absolute top-[3px] bottom-[3px] rounded-full z-0"
                animate={{ left: isTestnet ? "3px" : "50%", right: isTestnet ? "50%" : "3px", backgroundColor: isTestnet ? "rgba(251,191,36,0.14)" : "rgba(34,197,94,0.14)" }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
              <button onClick={isTestnet ? undefined : handleNetworkSwitch} className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide cursor-pointer" style={{ color: isTestnet ? "#FBBF24" : "var(--text-3)", transition: "color 180ms ease" }}>
                <FlaskConical style={{ width: 11, height: 11, flexShrink: 0 }} /> Testnet
                {isTestnet && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />}
              </button>
              <button onClick={isTestnet ? handleNetworkSwitch : undefined} className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide cursor-pointer" style={{ color: !isTestnet ? "#22C55E" : "var(--text-3)", transition: "color 180ms ease" }}>
                <Globe style={{ width: 11, height: 11, flexShrink: 0 }} /> Mainnet
                {!isTestnet && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />}
              </button>
            </div>

            {/* Theme toggle — hidden on the smallest screens (available in the drawer) */}
            <motion.button
              onClick={toggleTheme}
              className="hidden sm:flex p-2 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040]"
              style={{ color: "var(--text-3)", background: "var(--bg-2)", border: "1px solid var(--border)", transition: "background 180ms ease, border-color 180ms ease" }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                  <motion.div key="sun" initial={{ opacity: 0, rotate: -90, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 90, scale: 0.6 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
                    <Sun style={{ width: 15, height: 15 }} />
                  </motion.div>
                ) : (
                  <motion.div key="moon" initial={{ opacity: 0, rotate: 90, scale: 0.6 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: -90, scale: 0.6 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
                    <Moon style={{ width: 15, height: 15 }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Wallet — compact */}
            <WalletButton />
          </div>
        </div>
      </div>

      {/* ── Price ticker bar ── */}
      <PriceTickerBar isDark={isDark} />

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 130, damping: 22 }}
            className="lg:hidden overflow-hidden"
            style={{ borderTop: "1px solid var(--header-border)", background: "var(--header-bg)", backdropFilter: "blur(24px)" }}
          >
            {/* Primary routes live in the bottom tab bar; this drawer is settings. */}
            <div className="px-4 py-5">
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest px-1" style={{ color: "var(--text-3)" }}>Network</p>
                <div className="flex items-center rounded-full p-0.5 relative" style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  <motion.div className="absolute top-[3px] bottom-[3px] rounded-full z-0" animate={{ left: isTestnet ? "3px" : "50%", right: isTestnet ? "50%" : "3px", backgroundColor: isTestnet ? "rgba(251,191,36,0.14)" : "rgba(34,197,94,0.14)" }} transition={{ type: "spring", stiffness: 100, damping: 20 }} />
                  <button onClick={isTestnet ? undefined : handleNetworkSwitch} className="relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold cursor-pointer" style={{ color: isTestnet ? "#FBBF24" : "var(--text-3)" }}>
                    <FlaskConical style={{ width: 14, height: 14 }} /> Testnet
                    {isTestnet && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                  </button>
                  <button onClick={isTestnet ? handleNetworkSwitch : undefined} className="relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold cursor-pointer" style={{ color: !isTestnet ? "#22C55E" : "var(--text-3)" }}>
                    <Globe style={{ width: 14, height: 14 }} /> Mainnet
                    {!isTestnet && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                  </button>
                </div>

                <button onClick={toggleTheme} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium cursor-pointer" style={{ color: "var(--text-2)", background: "var(--bg-2)", border: "1px solid var(--border)" }}>
                  {isDark ? <Sun style={{ width: 15, height: 15 }} /> : <Moon style={{ width: 15, height: 15 }} />}
                  {isDark ? "Light Mode" : "Dark Mode"}
                </button>

                <a href="https://github.com/prajalsharma/veNFT-marketplace" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm cursor-pointer" style={{ color: "var(--text-3)" }}>
                  <Github style={{ width: 16, height: 16 }} /> View Repository
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
