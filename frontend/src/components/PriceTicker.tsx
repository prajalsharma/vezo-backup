"use client";

/**
 * PriceTicker — compact inline price strip for the header.
 *
 * Rules:
 *  - Only renders when CoinGecko returns LIVE data (source === "live").
 *    When on fallback/loading, returns null — nothing shown, zero layout impact.
 *  - Reuses useTokenPrices — no new API calls.
 *  - Desktop only (hidden md:inline-flex). Mobile has no ticker to avoid clutter.
 *  - Shows 24h change arrow only when CoinGecko provides the field.
 */

import { useTokenPrices } from "@/hooks/useTokenPrices";
import { TrendingUp, TrendingDown } from "lucide-react";

function fmt(symbol: string, price: number): string {
  if (symbol === "BTC")  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (symbol === "MUSD") return "$1.00";
  if (price >= 1)        return `$${price.toFixed(2)}`;
  if (price >= 0.0001)   return `$${price.toFixed(4)}`;
  return `<$0.001`;
}

export function PriceTicker() {
  const { prices, changes, source, isLoading } = useTokenPrices();

  // Silently hide while loading or on fallback — never show stale/hardcoded numbers
  if (isLoading || source !== "live") return null;

  const tokens = [
    { sym: "BTC",  price: prices.BTC,  change: changes?.BTC  ?? null },
    { sym: "MEZO", price: prices.MEZO, change: changes?.MEZO ?? null },
    { sym: "MUSD", price: prices.MUSD, change: 0 },
  ] as const;

  return (
    <div className="hidden xl:flex items-center gap-3 text-[10.5px] font-semibold text-white/40 flex-shrink-0">
      {tokens.map((t, i) => {
        const pos = t.change !== null && t.change > 0.05;
        const neg = t.change !== null && t.change < -0.05;
        return (
          <span key={t.sym} className="flex items-center gap-1">
            {i > 0 && <span className="text-white/12 mr-1">·</span>}
            <span className="text-white/28 font-bold">{t.sym}</span>
            <span className="text-white/55 tabular-nums">{fmt(t.sym, t.price)}</span>
            {pos && (
              <span className="flex items-center gap-0.5 text-emerald-400 text-[9.5px]">
                <TrendingUp className="w-2.5 h-2.5" />{Math.abs(t.change!).toFixed(1)}%
              </span>
            )}
            {neg && (
              <span className="flex items-center gap-0.5 text-red-400 text-[9.5px]">
                <TrendingDown className="w-2.5 h-2.5" />{Math.abs(t.change!).toFixed(1)}%
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
