"use client";

import Link from "next/link";
import { Header, VezoLogoMark } from "@/components/Header";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* ── Ambient background — cinematic depth ── */}
      <div
        className="fixed inset-0 -z-50 pointer-events-none"
        style={{ background: "var(--bg)", transition: "background 380ms var(--ease-spring)" }}
      >
        {/* Primary red blob — top center */}
        <div
          className="absolute top-[-12%] left-[10%] w-[800px] h-[800px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,0,64,0.055) 0%, transparent 62%)",
            filter: "blur(60px)",
            animation: "floatSlow 16s ease-in-out infinite",
          }}
        />
        {/* Secondary red — right */}
        <div
          className="absolute top-[20%] right-[-8%] w-[600px] h-[600px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,0,64,0.03) 0%, transparent 65%)",
            filter: "blur(70px)",
            animation: "float 20s ease-in-out infinite 4s",
          }}
        />
        {/* Blue/neutral blob — bottom left */}
        <div
          className="absolute bottom-[-8%] left-[5%] w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(74,144,226,0.035) 0%, transparent 65%)",
            filter: "blur(60px)",
            animation: "floatReverse 22s ease-in-out infinite 2s",
          }}
        />
        {/* Orange accent — mid right */}
        <div
          className="absolute top-[50%] right-[15%] w-[400px] h-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(247,147,26,0.02) 0%, transparent 65%)",
            filter: "blur(80px)",
            animation: "floatSlow 25s ease-in-out infinite 8s",
          }}
        />
      </div>

      <Header />
      <NetworkSwitcher />
      <main className="relative page-enter">{children}</main>

      {/* ── Single unified footer ── */}
      <footer
        className="relative mt-20"
        style={{
          borderTop: "1px solid var(--footer-border)",
          transition: "border-color 380ms var(--ease-spring)",
        }}
      >
        {/* Gradient accent line */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--vezo-red) 35%, var(--vezo-red) 65%, transparent 100%)",
            opacity: 0.22,
          }}
        />

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">

            {/* ── Brand ── */}
            <Link
              href="/"
              className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF0040] rounded-xl shrink-0"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--bg-1)",
                  border: "1px solid var(--border)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  transition: "all 380ms ease",
                }}
              >
                <VezoLogoMark size={24} />
              </div>
              <div className="leading-none">
                <span
                  className="text-base font-extrabold block leading-none"
                  style={{ letterSpacing: "-0.05em", color: "var(--text-1)", transition: "color 380ms ease" }}
                >
                  vezo
                </span>
                <span
                  className="text-[7px] font-bold tracking-[0.2em] uppercase leading-none mt-0.5 block"
                  style={{ color: "var(--vezo-red)" }}
                >
                  veNFT Marketplace
                </span>
              </div>
            </Link>

            {/* ── Nav links ── */}
            <nav className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
              {[
                { href: "/marketplace", label: "Marketplace" },
                { href: "/my-listings", label: "My Listings" },
                { href: "/activity", label: "Activity" },
                { href: "/docs", label: "Documentation" },
                { href: "https://github.com/prajalsharma/veNFT-marketplace", label: "GitHub", external: true },
                { href: "https://x.com/VezoExchange", label: "Twitter", external: true },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="font-medium transition-colors"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* ── Built on ── */}
            <div className="flex flex-col items-start lg:items-end gap-1.5 shrink-0">
              <a
                href="https://mezo.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium transition-colors"
                style={{ color: "var(--text-3)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
              >
                Built on Mezo Network
              </a>
              <span className="text-[10px]" style={{ color: "var(--text-4)" }}>
                © 2026 Vezo. All rights reserved.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
