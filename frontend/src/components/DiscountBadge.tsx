"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Sparkles } from "lucide-react";

interface DiscountBadgeProps {
  discountBps: number | null;
}

export function DiscountBadge({ discountBps }: DiscountBadgeProps) {
  if (discountBps === null) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-mezo-muted">
        Pricing Varies
      </div>
    );
  }

  const discount = discountBps / 100;
  const isDiscount = discount > 0;
  const isPremium = discount < 0;

  if (discount === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-mezo-muted">
        Par Value
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all
        ${isDiscount 
          ? "bg-mezo-success/10 text-mezo-success border-mezo-success/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]" 
          : "bg-mezo-danger/10 text-mezo-danger border-mezo-danger/30"
        }`}
    >
      {isDiscount ? (
        <TrendingDown className="w-3 h-3" />
      ) : (
        <TrendingUp className="w-3 h-3" />
      )}
      {isDiscount ? `${discount.toFixed(1)}% OFF` : `+${Math.abs(discount).toFixed(1)}% PREM`}
    </motion.div>
  );
}
