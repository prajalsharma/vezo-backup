"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";

interface DiscountBadgeProps {
  discountBps: number | null;
}

export function DiscountBadge({ discountBps }: DiscountBadgeProps) {
  if (discountBps === null) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
        style={{
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          color: "var(--text-3)",
        }}
      >
        Variable
      </div>
    );
  }

  const discount = discountBps / 100;

  if (discount === 0) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
        style={{
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          color: "var(--text-3)",
        }}
      >
        Par
      </div>
    );
  }

  const isDiscount = discount > 0;

  return (
    <motion.div
      initial={{ scale: 0.88, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
      style={{
        background: isDiscount ? "rgba(16,185,129,0.09)" : "rgba(239,68,68,0.09)",
        border: isDiscount ? "1px solid rgba(16,185,129,0.24)" : "1px solid rgba(239,68,68,0.24)",
        color: isDiscount ? "#10B981" : "#EF4444",
      }}
    >
      {isDiscount ? (
        <TrendingDown style={{ width: 11, height: 11 }} />
      ) : (
        <TrendingUp style={{ width: 11, height: 11 }} />
      )}
      {isDiscount
        ? `${discount.toFixed(1)}% off`
        : `+${Math.abs(discount).toFixed(1)}% prem`}
    </motion.div>
  );
}
