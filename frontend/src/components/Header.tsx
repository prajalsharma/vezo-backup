"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useNetwork } from "@/hooks/useNetwork";
import { useAddNetwork } from "@/hooks/useAddNetwork";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap, Github, BookOpen, FlaskConical, Globe } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { network, isTestnet, toggleNetwork } = useNetwork();
  const { addNetwork } = useAddNetwork();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNetworkSwitch = async () => {
    try {
      await addNetwork(isTestnet ? "mainnet" : "testnet");
      toggleNetwork();
    } catch (error) {
      console.error("Failed to switch network:", error);
    }
  };

  const navLinks = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/my-listings", label: "My Listings" },
    { href: "/activity", label: "Activity" },
    { href: "/docs", label: "Docs", icon: BookOpen },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-mezo-border/40 backdrop-blur-xl bg-mezo-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              className="w-10 h-10 bg-mezo-gradient rounded-xl flex items-center justify-center shadow-glow"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <Zap className="w-6 h-6 text-black fill-current" />
            </motion.div>
            <div className="hidden sm:block">
              <span className="text-xl font-bold tracking-tight text-white">Vezo</span>
              <span className="text-xl font-light text-mezo-primary ml-1">Exchange</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 text-sm font-medium text-mezo-muted hover:text-white transition-all group"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {link.icon && <link.icon className="w-4 h-4" />}
                  {link.label}
                </span>
                <motion.div
                  className="absolute inset-0 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100"
                  layoutId="navbar-hover"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                />
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* GitHub Link — only show when there's enough room */}
            <a
              href="https://github.com/prajalsharma/veNFT-marketplace"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:flex p-2 text-mezo-muted hover:text-white transition-colors"
              title="View on GitHub"
            >
              <Github className="w-5 h-5" />
            </a>

            {/* Network Toggle Pill — visible from lg up */}
            <div className="hidden lg:flex items-center bg-white/5 border border-white/10 rounded-full p-1 gap-0 relative">
              {/* Sliding active indicator */}
              <motion.div
                className="absolute top-0.5 bottom-0.5 rounded-full z-0"
                animate={{
                  left: isTestnet ? "2px" : "50%",
                  right: isTestnet ? "50%" : "2px",
                  backgroundColor: isTestnet ? "rgba(251,191,36,0.18)" : "rgba(34,197,94,0.18)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
              <button
                onClick={isTestnet ? undefined : handleNetworkSwitch}
                className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors duration-150 ${
                  isTestnet
                    ? "text-mezo-warning"
                    : "text-white/35 hover:text-white/65"
                }`}
                title="Switch to Testnet"
              >
                <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="tracking-wide">Testnet</span>
                {isTestnet && (
                  <span className="w-1.5 h-1.5 rounded-full bg-mezo-warning animate-pulse flex-shrink-0" />
                )}
              </button>
              <button
                onClick={isTestnet ? handleNetworkSwitch : undefined}
                className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors duration-150 ${
                  !isTestnet
                    ? "text-mezo-success"
                    : "text-white/35 hover:text-white/65"
                }`}
                title="Switch to Mainnet"
              >
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="tracking-wide">Mainnet</span>
                {!isTestnet && (
                  <span className="w-1.5 h-1.5 rounded-full bg-mezo-success animate-pulse flex-shrink-0" />
                )}
              </button>
            </div>

            {/* Wallet Connect */}
            <div>
              <ConnectButton
                chainStatus="none"
                showBalance={false}
                accountStatus={{
                  smallScreen: "avatar",
                  largeScreen: "full",
                }}
              />
            </div>

            {/* Mobile Toggle */}
            <button
              className="lg:hidden p-2 text-mezo-muted hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-mezo-border/40 bg-mezo-background/95 backdrop-blur-2xl overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-lg font-medium text-mezo-muted hover:text-white hover:bg-white/5 transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.icon && <link.icon className="w-5 h-5" />}
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-mezo-border/40 flex flex-col gap-3">
                {/* Mobile Network Toggle */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest px-1">Network</p>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-full p-1 relative">
                    <motion.div
                      className="absolute top-1 bottom-1 rounded-full z-0"
                      animate={{
                        left: isTestnet ? "4px" : "50%",
                        right: isTestnet ? "50%" : "4px",
                        backgroundColor: isTestnet ? "rgba(251,191,36,0.18)" : "rgba(34,197,94,0.18)",
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                    <button
                      onClick={isTestnet ? undefined : handleNetworkSwitch}
                      className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold transition-colors ${
                        isTestnet ? "text-mezo-warning" : "text-white/40"
                      }`}
                    >
                      <FlaskConical className="w-4 h-4" />
                      Testnet
                      {isTestnet && <span className="w-2 h-2 rounded-full bg-mezo-warning animate-pulse" />}
                    </button>
                    <button
                      onClick={isTestnet ? handleNetworkSwitch : undefined}
                      className={`relative z-10 flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-full text-sm font-bold transition-colors ${
                        !isTestnet ? "text-mezo-success" : "text-white/40"
                      }`}
                    >
                      <Globe className="w-4 h-4" />
                      Mainnet
                      {!isTestnet && <span className="w-2 h-2 rounded-full bg-mezo-success animate-pulse" />}
                    </button>
                  </div>
                </div>
                <a
                  href="https://github.com/prajalsharma/veNFT-marketplace"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-4 text-mezo-muted hover:text-white"
                >
                  <Github className="w-5 h-5" />
                  View Repository
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
