"use client";

import { useAccount, useChainId } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useAddNetwork } from "@/hooks/useAddNetwork";
import { mezoTestnet, mezoMainnet } from "@/lib/wagmi";
import { useNetwork } from "@/hooks/useNetwork";
import { useState } from "react";

export function NetworkSwitcher() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { network } = useNetwork();
  const { switchToMezo, isAdding } = useAddNetwork();
  const [error, setError] = useState<string | null>(null);

  const expectedChainId = network === "testnet" ? mezoTestnet.id : mezoMainnet.id;
  const isWrongNetwork = isConnected && chainId !== expectedChainId;

  const handleSwitch = async () => {
    setError(null);
    const result = await switchToMezo(network);
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <AnimatePresence>
      {isWrongNetwork && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className="fixed top-[78px] left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <div
            className="rounded-2xl p-4 overflow-hidden relative"
            style={{
              background: "var(--bg-1)",
              border: "1px solid rgba(251,191,36,0.22)",
              boxShadow: "var(--shadow-lg), 0 0 0 1px rgba(251,191,36,0.08)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Subtle amber glow bg */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at top, rgba(251,191,36,0.055) 0%, transparent 65%)",
              }}
            />
            {/* Amber top line */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.55), transparent)" }}
            />

            <div className="relative flex items-start gap-3">
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.22)" }}
              >
                <AlertTriangle style={{ width: 16, height: 16, color: "#FBBF24" }} />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold mb-0.5" style={{ color: "var(--text-1)", letterSpacing: "-0.02em" }}>
                  Wrong Network
                </h4>
                <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-2)" }}>
                  Switch to Mezo {network === "testnet" ? "Testnet" : "Mainnet"} to continue.
                </p>

                {error && (
                  <p className="text-[10px] font-semibold mb-2" style={{ color: "#EF4444" }}>
                    {error}
                  </p>
                )}

                <motion.button
                  onClick={handleSwitch}
                  disabled={isAdding}
                  whileHover={isAdding ? {} : { scale: 1.02 }}
                  whileTap={isAdding ? {} : { scale: 0.97, y: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold"
                  style={{
                    background: isAdding ? "var(--bg-3)" : "rgba(251,191,36,0.14)",
                    border: "1px solid rgba(251,191,36,0.35)",
                    color: isAdding ? "var(--text-3)" : "#FBBF24",
                    cursor: isAdding ? "not-allowed" : "pointer",
                    transition: "all 180ms var(--ease-spring)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isAdding) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.22)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.55)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAdding) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.14)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(251,191,36,0.35)";
                    }
                  }}
                >
                  {isAdding ? (
                    <>
                      <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
                      Switching…
                    </>
                  ) : (
                    <>
                      Switch Network
                      <ArrowRight style={{ width: 13, height: 13 }} />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
