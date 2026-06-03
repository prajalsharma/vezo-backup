"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetwork } from "@/hooks/useNetwork";
import { useAddNetwork } from "@/hooks/useAddNetwork";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, FlaskConical, Globe, Github, Zap } from "lucide-react";
import { useState } from "react";
import { PriceTicker } from "@/components/PriceTicker";

export function Header() {
  const { network, isTestnet, toggleNetwork } = useNetwork();
  const { addNetwork } = useAddNetwork();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNetworkSwitch = async () => {
    try {
      await addNetwork(isTestnet ? "mainnet" : "testnet");
      toggleNetwork();
    } catch (e) {
      console.error("Network switch failed:", e);
    }
  };

  const navLinks = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/my-listings", label: "Portfolio" },
    { href: "/activity",    label: "Activity" },
    { href: "/docs",        label: "Docs" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#020202]/90 backdrop-blur-2xl border-b border-white/[0.055]" />

      {/* Top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F7931A]/30 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-6">
        <div className="flex items-center justify-between h-[72px] gap-4">

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.07 }}
              whileTap={{ scale: 0.93 }}
              className="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-[0_0_16px_rgba(247,147,26,0.22)]"
              style={{ background: "linear-gradient(135deg, #F7931A, #c97415)" }}
            >
              <Zap className="w-4 h-4 text-black fill-black" />
            </motion.div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="text-[15px] font-black tracking-tight">
                Ve<span className="text-[#F7931A]">zo</span>
              </span>
              <span className="text-[9px] font-semibold text-white/25 tracking-[0.12em] uppercase">Mezo Network</span>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-[13px] font-semibold rounded-lg transition-colors duration-150 ${
                  isActive(link.href)
                    ? "text-white"
                    : "text-white/38 hover:text-white/72"
                }`}
              >
                {isActive(link.href) && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-white/[0.055]"
                    transition={{ type: "spring", bounce: 0.18, duration: 0.38 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
                {isActive(link.href) && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full bg-[#F7931A]"
                  />
                )}
              </Link>
            ))}
          </nav>

          {/* ── Right cluster ── */}
          <div className="flex items-center gap-2">

            {/* Network pill */}
            <div className="hidden md:flex items-center bg-white/[0.035] border border-white/[0.07] rounded-full p-[3px] relative text-[11.5px] font-bold">
              <motion.div
                className="absolute top-[3px] bottom-[3px] rounded-full z-0"
                animate={{
                  left:  isTestnet ? "3px"  : "50%",
                  right: isTestnet ? "50%"  : "3px",
                  backgroundColor: isTestnet
                    ? "rgba(251,191,36,0.15)"
                    : "rgba(34,197,94,0.15)",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
              <button
                onClick={isTestnet ? undefined : handleNetworkSwitch}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-150 ${
                  isTestnet ? "text-amber-400" : "text-white/28 hover:text-white/55"
                }`}
              >
                <FlaskConical className="w-3 h-3 flex-shrink-0" />
                <span>Testnet</span>
                {isTestnet && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              </button>
              <button
                onClick={isTestnet ? handleNetworkSwitch : undefined}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-150 ${
                  !isTestnet ? "text-emerald-400" : "text-white/28 hover:text-white/55"
                }`}
              >
                <Globe className="w-3 h-3 flex-shrink-0" />
                <span>Mainnet</span>
                {!isTestnet && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </button>
            </div>

            {/* Live price ticker — only renders when CoinGecko data is live */}
            <PriceTicker />

            {/* GitHub */}
            <a
              href="https://github.com/prajalsharma/veNFT-marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:flex p-2 text-white/25 hover:text-white/65 transition-colors rounded-lg hover:bg-white/[0.04]"
              title="View on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>

            {/* Wallet */}
            <ConnectButton
              chainStatus="none"
              showBalance={false}
              accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            />

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/[0.05]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden relative border-t border-white/[0.05] bg-[#020202]/98 backdrop-blur-2xl overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-5 py-5 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-semibold transition-colors ${
                    isActive(link.href)
                      ? "text-white bg-white/[0.055] border-l-2 border-[#F7931A]"
                      : "text-white/40 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile network */}
              <div className="pt-4 pb-1">
                <div className="flex items-center bg-white/[0.035] border border-white/[0.07] rounded-full p-[3px] relative text-[11.5px] font-bold">
                  <motion.div
                    className="absolute top-[3px] bottom-[3px] rounded-full z-0"
                    animate={{
                      left:  isTestnet ? "3px"  : "50%",
                      right: isTestnet ? "50%"  : "3px",
                      backgroundColor: isTestnet ? "rgba(251,191,36,0.15)" : "rgba(34,197,94,0.15)",
                    }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                  <button
                    onClick={isTestnet ? undefined : handleNetworkSwitch}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-colors ${
                      isTestnet ? "text-amber-400" : "text-white/32"
                    }`}
                  >
                    <FlaskConical className="w-4 h-4" />Testnet
                  </button>
                  <button
                    onClick={isTestnet ? handleNetworkSwitch : undefined}
                    className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full transition-colors ${
                      !isTestnet ? "text-emerald-400" : "text-white/32"
                    }`}
                  >
                    <Globe className="w-4 h-4" />Mainnet
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
