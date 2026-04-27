"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useNetwork } from "@/hooks/useNetwork";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  ArrowRight, 
  Zap, 
  Shield, 
  Lock, 
  ExternalLink, 
  TrendingUp, 
  MousePointer2,
  BarChart3,
  Globe
} from "lucide-react";
import { useRef } from "react";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function HomeClient() {
  const { isConnected } = useAccount();
  const { network, contracts } = useNetwork();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div className="relative min-h-screen bg-mezo-background overflow-hidden" ref={containerRef}>
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          style={{ y: y1, opacity }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-mezo-primary/5 rounded-full blur-[120px]" 
        />
        <div className="absolute top-[20%] right-[5%] w-[40%] h-[40%] bg-mezo-accent/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 px-4">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-mezo-muted text-xs font-bold uppercase tracking-widest"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mezo-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-mezo-primary"></span>
            </span>
            Trading Live on Mezo {network === "testnet" ? "Testnet" : "Mainnet"}
          </motion.div>

          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="mb-12"
          >
            <motion.h1 
              variants={fadeInUp}
              className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-8 leading-[0.9] text-white"
            >
              The Liquidity Layer for <br />
              <span className="gradient-text">Locked Bitcoin.</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-mezo-muted max-w-2xl mx-auto leading-relaxed"
            >
              Buy and sell vote-escrowed BTC and MEZO positions. Access high-yield governance NFTs at a market-driven discount. Secure, transparent, and atomic.
            </motion.p>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-24"
          >
            <Link
              href="/marketplace"
              className="btn-primary flex items-center gap-3 px-10 py-5 text-lg"
            >
              Enter Marketplace
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/docs"
              className="btn-outline flex items-center gap-3 px-10 py-5 text-lg"
            >
              Read Technical Docs
            </Link>
          </motion.div>

          {/* Real Estate Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto pt-12 border-t border-white/5">
            {[
              { label: "Protocol Status", value: "Verified", icon: Shield, color: "text-mezo-success" },
              { label: "Network", value: "Mezo EVM", icon: Globe, color: "text-mezo-accent" },
              { label: "Assets Supported", value: "veBTC, veMEZO", icon: Lock, color: "text-mezo-primary" },
              { label: "Fee Structure", value: "2.00%", icon: BarChart3, color: "text-white" },
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="p-6 text-left"
              >
                <div className="flex items-center gap-2 mb-2 text-mezo-muted">
                  <stat.icon className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Transparency Section */}
      <section className="py-32 px-4 relative bg-mezo-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                Built on the Foundations of <br />
                <span className="text-mezo-primary">Security & Fairness.</span>
              </h2>
              <div className="space-y-8">
                {[
                  {
                    title: "Escrowless Architecture",
                    desc: "Sellers retain full control and voting rights of their NFTs until the purchase transaction is confirmed on-chain.",
                    icon: Shield
                  },
                  {
                    title: "Intrinsic Value Analysis",
                    desc: "Our adapters calculate the real-time value of locked BTC, accounting for voting power and decay cycles.",
                    icon: BarChart3
                  },
                  {
                    title: "Permissionless Market",
                    desc: "Any user can list their veNFTs. The marketplace facilitates price discovery for the entire Mezo ecosystem.",
                    icon: MousePointer2
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="shrink-0 w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-mezo-primary">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                      <p className="text-mezo-muted leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute inset-0 bg-mezo-primary/20 blur-[100px] rounded-full" />
              <div className="glass-card rounded-[2rem] p-8 border-mezo-border overflow-hidden relative">
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-mezo-primary rounded-lg" />
                    <div>
                      <h4 className="font-bold">veBTC Position #842</h4>
                      <p className="text-xs text-mezo-muted tracking-widest uppercase">Listed 2h ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-mezo-muted uppercase font-bold mb-1">Price</p>
                    <p className="text-xl font-bold text-mezo-success">0.45 BTC</p>
                  </div>
                </div>

                <div className="space-y-6 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="text-sm text-mezo-muted">Intrinsic Value</span>
                    <span className="font-bold">0.52 BTC</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: "86%" }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="h-full bg-mezo-primary" 
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="px-3 py-1 rounded-full bg-mezo-success/10 text-mezo-success text-xs font-bold border border-mezo-success/20">
                      14% DISCOUNT
                    </div>
                    <span className="text-xs text-mezo-muted uppercase font-bold">22 Days Remaining</span>
                  </div>
                </div>

                <button className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-mezo-primary transition-colors">
                  Purchase veNFT
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Join the Future of Mezo Governance.</h2>
          <p className="text-mezo-muted mb-10 text-lg">
            Whether you are looking to exit a position or gain leveraged exposure to Bitcoin rewards, Vezo Exchange is your home.
          </p>
          <div className="flex justify-center gap-6">
            <Link href="/marketplace" className="btn-primary">Get Started</Link>
            <a 
              href="https://github.com/prajalsharma/veNFT-marketplace" 
              target="_blank" 
              className="btn-outline flex items-center gap-2"
            >
              <Github className="w-4 h-4" />
              Source Code
            </a>
          </div>
        </div>
      </section>

      {/* Network Footer */}
      <footer className="py-8 border-t border-white/5 text-center">
        <p className="text-xs text-mezo-muted uppercase tracking-[0.2em]">
          Powered by Mezo Network • Security Audited Design • 2026
        </p>
      </footer>
    </div>
  );
}

function Github(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
