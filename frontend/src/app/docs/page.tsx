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
  Database
} from "lucide-react";

export default function DocsPage() {
  const sections = [
    {
      title: "Introduction",
      content: "Vezo Exchange is a production-grade, escrowless P2P platform designed specifically for the Mezo ecosystem. It enables users to trade vote-escrowed Bitcoin (veBTC) and MEZO (veMEZO) positions with maximum transparency and security.",
      icon: Zap,
    },
    {
      title: "Core Mechanism: veNFTs",
      content: "In the Mezo ecosystem, users lock their assets (BTC or MEZO) to gain voting power and protocol yield. These locked positions are represented as NFTs (veNFTs). Unlike traditional tokens, veNFTs carry intrinsic value based on the underlying locked assets and their remaining lock duration.",
      icon: Lock,
    },
    {
      title: "Escrowless Design",
      content: "Security is our top priority. The marketplace uses an escrowless architecture, meaning your veNFTs stay in your wallet until the exact moment of sale. Buyers pay directly to the seller (minus a 2% protocol fee), and the NFT is transferred in a single atomic transaction.",
      icon: Shield,
    }
  ];

  return (
    <div className="min-h-screen pt-32 pb-20 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16"
        >
          <div className="flex items-center gap-2 text-mezo-primary mb-4">
            <FileText className="w-5 h-5" />
            <span className="font-bold uppercase tracking-widest text-sm">Documentation</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Technical Architecture & Governance</h1>
          <p className="text-xl text-mezo-muted max-w-3xl leading-relaxed">
            Understanding the inner workings of the first high-liquidity marketplace for vote-escrowed assets on Mezo.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 rounded-2xl"
            >
              <div className="w-12 h-12 bg-mezo-primary/10 rounded-xl flex items-center justify-center mb-6">
                <section.icon className="w-6 h-6 text-mezo-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">{section.title}</h3>
              <p className="text-mezo-muted text-sm leading-relaxed">{section.content}</p>
            </motion.div>
          ))}
        </div>

        {/* Detailed Sections */}
        <div className="space-y-20">
          <section>
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <Code2 className="w-8 h-8 text-mezo-accent" />
              Smart Contract Modules
            </h2>
            <div className="space-y-6">
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="font-bold text-lg mb-2">VeNFTMarketplace.sol</h4>
                <p className="text-mezo-muted mb-4">The core logic for listing, updating, and purchasing NFTs. Implements the CEI (Check-Effects-Interactions) pattern to prevent reentrancy.</p>
                <div className="flex gap-4">
                  <a href="https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/VeNFTMarketplace.sol" target="_blank" className="text-mezo-primary text-sm flex items-center gap-1 hover:underline">
                    View Source <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="font-bold text-lg mb-2">MezoVeNFTAdapter.sol</h4>
                <p className="text-mezo-muted mb-4">A read-only abstraction layer that queries Mezo's veBTC and veMEZO locking contracts to surface intrinsic value, voting power decay, lock expiry, and discount calculations. Zero state-modification surface.</p>
                <div className="flex gap-4">
                  <a href="https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/adapters/MezoVeNFTAdapter.sol" target="_blank" className="text-mezo-primary text-sm flex items-center gap-1 hover:underline">
                    View Source <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="font-bold text-lg mb-2">PaymentRouter.sol</h4>
                <p className="text-mezo-muted mb-4">Routes payments from buyer to seller with a 2% default protocol fee deduction. Supports native BTC and ERC-20 tokens (MEZO, MUSD). Restricted to marketplace-only calls — no external address can trigger payment routing.</p>
                <div className="flex gap-4">
                  <a href="https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/PaymentRouter.sol" target="_blank" className="text-mezo-primary text-sm flex items-center gap-1 hover:underline">
                    View Source <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <div className="glass-card p-6 rounded-2xl">
                <h4 className="font-bold text-lg mb-2">MarketplaceAdmin.sol</h4>
                <p className="text-mezo-muted mb-4">Governance contract with role-based access control (PAUSER, FEE_MANAGER, COLLECTION_MANAGER). Fee changes require a 48-hour timelock. Emergency pause halts the marketplace instantly.</p>
                <div className="flex gap-4">
                  <a href="https://github.com/prajalsharma/veNFT-marketplace/blob/main/contracts/core/MarketplaceAdmin.sol" target="_blank" className="text-mezo-primary text-sm flex items-center gap-1 hover:underline">
                    View Source <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-mezo-warning" />
              Security & Audits
            </h2>
            <div className="glass-card p-8 rounded-3xl border-mezo-warning/20">
              <div className="grid md:grid-cols-2 gap-12">
                <div>
                  <h3 className="text-xl font-bold mb-4">Audit Readiness</h3>
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-mezo-success mt-1" />
                      <div>
                        <span className="font-bold text-white">Reentrancy Protection:</span>
                        <p className="text-mezo-muted text-sm">All value-transferring functions use OpenZeppelin's ReentrancyGuard.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-mezo-success mt-1" />
                      <div>
                        <span className="font-bold text-white">Access Control:</span>
                        <p className="text-mezo-muted text-sm">Granular roles (PAUSER, FEE_MANAGER) managed via MarketplaceAdmin.</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-mezo-success mt-1" />
                      <div>
                        <span className="font-bold text-white">Safe Payments:</span>
                        <p className="text-mezo-muted text-sm">Uses PaymentRouter with SafeERC20 to handle multi-token distributions.</p>
                      </div>
                    </li>
                  </ul>
                </div>
                <div className="bg-mezo-background/50 rounded-2xl p-6 border border-mezo-border">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    Security Checklist
                  </h4>
                  <div className="space-y-2 text-sm font-mono text-mezo-muted">
                    <p className="text-mezo-success">[✓] NFT transferred before payment (CEI)</p>
                    <p className="text-mezo-success">[✓] routePayment: marketplace-only caller</p>
                    <p className="text-mezo-success">[✓] Expired veNFT purchase blocked</p>
                    <p className="text-mezo-success">[✓] Self-purchase blocked</p>
                    <p className="text-mezo-success">[✓] Ownership re-validated at buy time</p>
                    <p className="text-mezo-success">[✓] ReentrancyGuard on all writes</p>
                    <p className="text-mezo-success">[✓] SafeERC20 + safeTransferFrom</p>
                    <p className="text-mezo-success">[✓] 48h timelock on fee changes</p>
                    <p className="text-mezo-success">[✓] Default protocol fee set to 2% (hardcapped at 5%)</p>
                    <p className="text-mezo-success">[✓] Integer overflow (Solidity 0.8+)</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

            <section className="text-center bg-mezo-gradient/5 rounded-3xl p-12 border border-mezo-primary/10">
              <h2 className="text-3xl font-bold mb-4">Contribute to the Ecosystem</h2>
              <p className="text-mezo-muted mb-8 max-w-2xl mx-auto">
                This marketplace is open-source and built for the community. Explore the contracts, report bugs, or suggest features on GitHub.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="https://github.com/prajalsharma/veNFT-marketplace" 
                  target="_blank"
                  className="btn-primary flex items-center gap-2"
                >
                  Explore GitHub <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </section>
        </div>
      </div>
    </div>
  );
}
