"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { useActivityContext } from "@/context/ActivityContext";
import { useNetwork } from "@/hooks/useNetwork";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SALES = 50;

const ABI = [
  {
    name: "getListingWithValue",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "seller",       type: "address" },
          { name: "collection",   type: "address" },
          { name: "tokenId",      type: "uint256" },
          { name: "price",        type: "uint256" },
          { name: "paymentToken", type: "address" },
          { name: "createdAt",    type: "uint256" },
          { name: "active",       type: "bool"    },
        ],
        name: "listing",
        type: "tuple",
      },
      { name: "intrinsicValue", type: "uint256" },
      { name: "lockEnd",        type: "uint256" },
      { name: "votingPower",    type: "uint256" },
      { name: "discountBps",    type: "uint256" },
    ],
  },
] as const;

export interface AvgDiscountResult {
  avgDiscountPct: string;
  saleCount: number;
  isLoading: boolean;
  tooltip: string;
}

export function useAvgDiscount(): AvgDiscountResult {
  const { events, isLoading: eventsLoading } = useActivityContext();
  const { contracts } = useNetwork();

  const addr = contracts.marketplace as `0x${string}`;
  const isDeployed = !!addr && addr !== "0x0000000000000000000000000000000000000000";

  const recentSales = useMemo(() => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return events
      .filter((e) => e.type === "sale" && (e.timestamp == null || e.timestamp >= cutoff))
      .slice(0, MAX_SALES);
  }, [events]);

  const calls = useMemo(() =>
    isDeployed
      ? recentSales.map((s) => ({
          address: addr,
          abi: ABI,
          functionName: "getListingWithValue" as const,
          args: [s.listingId] as const,
        }))
      : [],
    [recentSales, addr, isDeployed]
  );

  const { data, isLoading: callsLoading } = useReadContracts({
    contracts: calls,
    query: { enabled: calls.length > 0, staleTime: 60_000 },
  });

  return useMemo<AvgDiscountResult>(() => {
    const isLoading = eventsLoading || callsLoading;
    const n = recentSales.length;

    if (!data || data.length === 0) {
      return {
        avgDiscountPct: "N/A",
        saleCount: n,
        isLoading,
        tooltip: n === 0
          ? "No sales yet. Discount data will appear as trades complete."
          : "Loading historical sale data…",
      };
    }

    const discounts: number[] = [];
    for (const r of data) {
      if (r.status !== "success" || !r.result) continue;
      const [listing, intrinsicValue, , , discountBps] = r.result as [
        { price: bigint },
        bigint, bigint, bigint, bigint
      ];
      if (discountBps > 0n) {
        discounts.push(Number(discountBps) / 100);
      } else if (intrinsicValue > 0n && listing.price < intrinsicValue) {
        discounts.push(
          ((Number(intrinsicValue) - Number(listing.price)) / Number(intrinsicValue)) * 100
        );
      }
    }

    if (discounts.length === 0) {
      return { avgDiscountPct: "N/A", saleCount: n, isLoading, tooltip: "Discount data unavailable for recent sales (locks may have expired)." };
    }

    const avg = discounts.reduce((a, b) => a + b, 0) / discounts.length;
    return {
      avgDiscountPct: avg.toFixed(1),
      saleCount: n,
      isLoading,
      tooltip: `Average discount across ${n} sale${n !== 1 ? "s" : ""} in the last 30 days, computed as (intrinsic value − sale price) / intrinsic value.`,
    };
  }, [data, recentSales, eventsLoading, callsLoading]);
}
