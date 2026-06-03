"use client";

import { useAccount, useChainId } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight } from "lucide-react";
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
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="glass rounded-2xl p-4 border border-mezo-warning/30 bg-mezo-warning/10">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-mezo-warning/20">
                <AlertTriangle className="w-5 h-5 text-mezo-warning" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-1">Wrong Network</h4>
                <p className="text-white/60 text-sm mb-3">
                  Please switch to Mezo {network === "testnet" ? "Testnet" : "Mainnet"} to use this app.
                </p>
                {error && (
                  <p className="text-mezo-danger text-xs mb-2">{error}</p>
                )}
                <button
                  onClick={handleSwitch}
                  disabled={isAdding}
                  className="flex items-center gap-2 px-4 py-2 bg-mezo-warning text-black font-semibold rounded-xl hover:bg-mezo-warning/90 transition-all disabled:opacity-50"
                >
                  {isAdding ? (
                    "Switching..."
                  ) : (
                    <>
                      Switch Network
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
