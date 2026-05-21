"use client";

/**
 * usePriceTicker — live USD prices for BTC, MEZO, and MUSD.
 *
 * Sources:
 *  - BTC:  CoinGecko public API (bitcoin)
 *  - MEZO: CoinGecko public API (mezo-network) — falls back to $0.00 if not listed
 *  - MUSD: always $1.00 (pegged stablecoin)
 *
 * Refreshes every 60 seconds. No API key required for CoinGecko public endpoint.
 * All errors are silently swallowed — UI degrades to "—" gracefully.
 */

import { useState, useEffect, useCallback } from "react";

export interface TokenPrices {
  BTC: number | null;
  MEZO: number | null;
  MUSD: number;   // always 1.00
  lastUpdated: number | null; // unix ms
}

const REFRESH_INTERVAL_MS = 60_000;

const DEFAULT: TokenPrices = { BTC: null, MEZO: null, MUSD: 1.0, lastUpdated: null };

// CoinGecko free endpoint — no auth needed, 30req/min limit
// CoinGecko IDs verified 2026-05:
//   bitcoin      → BTC
//   mezo         → MEZO (governance token, $0.03)
//   mezo-usd     → MUSD stablecoin (pegged ~$1)
const CG_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cmezo%2Cmezo-usd&vs_currencies=usd";

export function usePriceTicker(): TokenPrices {
  const [prices, setPrices] = useState<TokenPrices>(DEFAULT);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(CG_URL, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setPrices({
        BTC:  data?.bitcoin?.usd     ?? null,
        MEZO: data?.mezo?.usd        ?? null,
        // mezo-usd is the on-chain stablecoin; fall back to 1.00 if not listed
        MUSD: data?.["mezo-usd"]?.usd ?? 1.0,
        lastUpdated: Date.now(),
      });
    } catch {
      // silently ignore — UI shows "—" when null
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPrices]);

  return prices;
}

/** Format a USD price compactly: $105,234.50 or $0.0042 */
export function formatUSD(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1000) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (value >= 1)    return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}
