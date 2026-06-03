"use client";

/**
 * useTokenPrices — lightweight USD price feed for Mezo tokens
 *
 * Strategy (no heavy infra):
 *   1. Try CoinGecko public API (no key needed) for BTC and MEZO prices.
 *   2. MUSD is a USD-pegged stablecoin → always $1.
 *   3. If the API call fails or times out, fall back to hardcoded mock prices
 *      so the UI still renders rather than showing blank/broken numbers.
 *
 * NOTE: MEZO is a newer token without a reliable on-chain oracle on Mezo network
 * at this stage. CoinGecko is used as the off-chain source; if the id is unknown
 * the fallback price is used. Swap the id string once the token is listed.
 */

import { useState, useEffect, useRef } from "react";

export interface TokenPrices {
  BTC: number;   // USD per 1 BTC
  MEZO: number;  // USD per 1 MEZO
  MUSD: number;  // USD per 1 MUSD (stablecoin ≈ 1)
}

// Fallback prices — used when API is unavailable
const FALLBACK_PRICES: TokenPrices = {
  BTC: 85_000,
  MEZO: 0.10,
  MUSD: 1.00,
};

// CoinGecko simple/price endpoint — include_24hr_change for the ticker
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin%2Cmezo&vs_currencies=usd&include_24hr_change=true";

// Cache TTL: refresh prices every 60 s
const CACHE_TTL_MS = 60_000;

export interface TokenChanges {
  BTC:  number | null;
  MEZO: number | null;
  MUSD: number | null;
}

// Module-level cache so we don't refetch on every component mount
let cachedPrices: TokenPrices | null = null;
let cachedChanges: TokenChanges = { BTC: null, MEZO: null, MUSD: 0 };
let cacheTimestamp = 0;

async function fetchPrices(): Promise<TokenPrices> {
  const now = Date.now();
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPrices;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(COINGECKO_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const btcPrice  = data?.bitcoin?.usd  ?? FALLBACK_PRICES.BTC;
    // "mezo" may not yet have a CoinGecko listing — use fallback if missing
    const mezoPrice = data?.mezo?.usd     ?? FALLBACK_PRICES.MEZO;

    cachedPrices = {
      BTC:  Number(btcPrice),
      MEZO: Number(mezoPrice),
      MUSD: 1.00,
    };
    // 24h change — optional, null when unavailable
    cachedChanges = {
      BTC:  data?.bitcoin?.usd_24h_change != null ? Number(data.bitcoin.usd_24h_change) : null,
      MEZO: data?.mezo?.usd_24h_change    != null ? Number(data.mezo.usd_24h_change)    : null,
      MUSD: 0,
    };
    cacheTimestamp = now;
    return cachedPrices;
  } catch {
    // Network error or abort — return fallback without throwing
    return FALLBACK_PRICES;
  }
}

export function useTokenPrices() {
  const [prices, setPrices] = useState<TokenPrices>(cachedPrices ?? FALLBACK_PRICES);
  const [isLoading, setIsLoading] = useState(!cachedPrices);
  const [source, setSource] = useState<"live" | "fallback">(cachedPrices ? "live" : "fallback");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let intervalId: ReturnType<typeof setInterval>;

    async function load() {
      const fetched = await fetchPrices();
      if (!mounted.current) return;
      setPrices(fetched);
      setIsLoading(false);
      // If fetched prices match fallback exactly for BTC it's likely a real fetch failure
      setSource(fetched.BTC !== FALLBACK_PRICES.BTC || fetched.MEZO !== FALLBACK_PRICES.MEZO
        ? "live"
        : "fallback");
    }

    load();
    intervalId = setInterval(load, CACHE_TTL_MS);

    return () => {
      mounted.current = false;
      clearInterval(intervalId);
    };
  }, []);

  /**
   * Convert a token amount (in wei, 18 decimals) to USD string.
   * Returns "—" while loading.
   */
  function toUSD(amountWei: bigint, token: "BTC" | "MEZO" | "MUSD"): string {
    if (isLoading && !cachedPrices) return "—";
    const pricePerToken = prices[token];
    // amountWei / 1e18 * pricePerToken
    const usd = (Number(amountWei) / 1e18) * pricePerToken;
    return formatUSD(usd);
  }

  return { prices, changes: cachedChanges, isLoading, source, toUSD };
}

/** Format a USD amount with appropriate precision */
export function formatUSD(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000)     return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (usd >= 1)         return `$${usd.toFixed(2)}`;
  if (usd >= 0.001)     return `$${usd.toFixed(4)}`;
  return `<$0.001`;
}
