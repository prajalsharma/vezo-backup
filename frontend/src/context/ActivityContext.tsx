"use client";

/**
 * ActivityContext — prefetches activity on mount, caches in memory,
 * and polls every 12 s to append new events without a full refetch.
 *
 * Consumers (ActivityClient, BestDeals) receive instant data on first render.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { useNetwork } from "@/hooks/useNetwork";
import type { ActivityEvent } from "@/hooks/useActivityFeed";

// ── re-export so existing consumers keep working ─────────────────────────────
export type { ActivityEvent };

// ── helpers (duplicated from useActivityFeed to keep hook independent) ────────
function getPaymentSymbol(token: string, musd: string): string {
  const lower = token.toLowerCase();
  if (lower === "0x7b7c000000000000000000000000000000000000") return "BTC";
  if (lower === "0x7b7c000000000000000000000000000000000001") return "MEZO";
  if (lower === musd.toLowerCase()) return "MUSD";
  return token.slice(0, 6) + "…";
}

async function getLogsChunked(
  publicClient: ReturnType<typeof usePublicClient> & object,
  params: {
    address: `0x${string}`;
    event: Parameters<typeof publicClient.getLogs>[0]["event"];
    fromBlock: bigint;
    toBlock: bigint;
  }
): Promise<Awaited<ReturnType<typeof publicClient.getLogs>>> {
  const CHUNK = 9_000n;
  const all: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
  let from = params.fromBlock;
  while (from <= params.toBlock) {
    const to = from + CHUNK > params.toBlock ? params.toBlock : from + CHUNK;
    const logs = await publicClient.getLogs({
      address: params.address,
      event: params.event,
      fromBlock: from,
      toBlock: to,
    });
    all.push(...(logs as any[]));
    from = to + 1n;
  }
  return all;
}

const LISTED_EVENT = {
  type: "event" as const,
  name: "Listed",
  inputs: [
    { indexed: true,  name: "listingId",    type: "uint256" as const },
    { indexed: true,  name: "seller",       type: "address" as const },
    { indexed: true,  name: "collection",   type: "address" as const },
    { indexed: false, name: "tokenId",      type: "uint256" as const },
    { indexed: false, name: "price",        type: "uint256" as const },
    { indexed: false, name: "paymentToken", type: "address" as const },
  ],
};

const PURCHASED_EVENT = {
  type: "event" as const,
  name: "Purchased",
  inputs: [
    { indexed: true,  name: "listingId", type: "uint256" as const },
    { indexed: true,  name: "buyer",     type: "address" as const },
    { indexed: true,  name: "seller",    type: "address" as const },
    { indexed: false, name: "price",     type: "uint256" as const },
  ],
};

const CANCELLED_EVENT = {
  type: "event" as const,
  name: "Cancelled",
  inputs: [
    { indexed: true, name: "listingId", type: "uint256" as const },
  ],
};

const BID_PLACED_EVENT = { type: "event" as const, name: "BidPlaced", inputs: [{ indexed: true, name: "collection", type: "address" as const }, { indexed: true, name: "tokenId", type: "uint256" as const }, { indexed: true, name: "bidIndex", type: "uint256" as const }, { indexed: false, name: "bidder", type: "address" as const }, { indexed: false, name: "bidToken", type: "address" as const }, { indexed: false, name: "bidAmount", type: "uint256" as const }, { indexed: false, name: "expiry", type: "uint256" as const }] };
const BID_ACCEPTED_EVENT = { type: "event" as const, name: "BidAccepted", inputs: [{ indexed: true, name: "collection", type: "address" as const }, { indexed: true, name: "tokenId", type: "uint256" as const }, { indexed: true, name: "bidIndex", type: "uint256" as const }, { indexed: false, name: "bidder", type: "address" as const }, { indexed: false, name: "seller", type: "address" as const }, { indexed: false, name: "bidToken", type: "address" as const }, { indexed: false, name: "bidAmount", type: "uint256" as const }, { indexed: false, name: "fee", type: "uint256" as const }] };
const BID_CANCELLED_EVENT = { type: "event" as const, name: "BidCancelled", inputs: [{ indexed: true, name: "collection", type: "address" as const }, { indexed: true, name: "tokenId", type: "uint256" as const }, { indexed: true, name: "bidIndex", type: "uint256" as const }, { indexed: false, name: "bidder", type: "address" as const }] };

// ── Context shape ─────────────────────────────────────────────────────────────

interface ActivityContextValue {
  events: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  isDeployed: boolean;
}

const ActivityContext = createContext<ActivityContextValue>({
  events: [],
  isLoading: false,
  error: null,
  isDeployed: false,
});

export function useActivityContext() {
  return useContext(ActivityContext);
}

// ── Provider ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 12_000; // 12 s
const LOOK_BACK        = 200_000n;
const LIMIT            = 100;

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const { contracts } = useNetwork();
  const publicClient  = usePublicClient();

  const [events,    setEvents]    = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const marketplaceAddress = contracts.marketplace as `0x${string}`;
  const bidRegistryAddress = (contracts as any).bidRegistry as `0x${string}` | undefined;
  const isBidRegistryDeployed = !!bidRegistryAddress && bidRegistryAddress !== "0x0000000000000000000000000000000000000000";
  const isDeployed =
    !!marketplaceAddress &&
    marketplaceAddress !== "0x0000000000000000000000000000000000000000";

  // Track the highest block we've already ingested so polls only fetch new blocks
  const highestBlockRef = useRef<bigint>(0n);
  // Cache all listed logs so sale/cancel events can cross-reference them
  const listedLogsRef = useRef<any[]>([]);

  const fetchAll = useCallback(
    async (fromBlock: bigint, toBlock: bigint, isInitial: boolean) => {
      if (!publicClient || !isDeployed) return;

      const bidFetches = isBidRegistryDeployed
        ? [
            getLogsChunked(publicClient as any, { address: bidRegistryAddress!, event: BID_PLACED_EVENT,   fromBlock, toBlock }),
            getLogsChunked(publicClient as any, { address: bidRegistryAddress!, event: BID_ACCEPTED_EVENT, fromBlock, toBlock }),
            getLogsChunked(publicClient as any, { address: bidRegistryAddress!, event: BID_CANCELLED_EVENT,fromBlock, toBlock }),
          ]
        : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])];

      const [listedLogs, purchasedLogs, cancelledLogs, bidPlacedLogs, bidAcceptedLogs, bidCancelledLogs] = await Promise.all([
        getLogsChunked(publicClient as any, { address: marketplaceAddress, event: LISTED_EVENT,   fromBlock, toBlock }),
        getLogsChunked(publicClient as any, { address: marketplaceAddress, event: PURCHASED_EVENT,fromBlock, toBlock }),
        getLogsChunked(publicClient as any, { address: marketplaceAddress, event: CANCELLED_EVENT,fromBlock, toBlock }),
        ...bidFetches,
      ]);

      // Accumulate listed logs for cross-referencing
      if (isInitial) {
        listedLogsRef.current = listedLogs as any[];
      } else {
        listedLogsRef.current = [...listedLogsRef.current, ...(listedLogs as any[])];
      }
      const allListed = listedLogsRef.current;

      // Block timestamps — cap at 100 unique blocks to avoid rate limits
      const blockNumbers = new Set<bigint>();
      [...listedLogs, ...purchasedLogs, ...cancelledLogs, ...bidPlacedLogs, ...bidAcceptedLogs, ...bidCancelledLogs].forEach((l: any) => {
        if (l.blockNumber != null) blockNumbers.add(l.blockNumber);
      });
      const blockArr = Array.from(blockNumbers).slice(0, 100);
      const blockData = await Promise.allSettled(
        blockArr.map((bn) => (publicClient as any).getBlock({ blockNumber: bn }))
      );
      const blockTs = new Map<bigint, number>();
      blockArr.forEach((bn, i) => {
        const r = blockData[i];
        if (r.status === "fulfilled") {
          blockTs.set(bn, Number((r.value as any).timestamp) * 1000);
        }
      });

      const newEvents: ActivityEvent[] = [];

      for (const log of listedLogs as any[]) {
        const a = log.args as any;
        const isVeBTC =
          (a.collection as string).toLowerCase() === contracts.veBTC.toLowerCase();
        newEvents.push({
          type: "listed",
          listingId:        a.listingId,
          collection:       isVeBTC ? "veBTC" : "veMEZO",
          tokenId:          a.tokenId,
          price:            parseFloat(formatEther(a.price as bigint)).toFixed(4),
          paymentToken:     getPaymentSymbol(a.paymentToken, contracts.MUSD),
          from:             a.seller,
          to:               null,
          blockNumber:      log.blockNumber ?? 0n,
          transactionHash:  log.transactionHash ?? "",
          timestamp:        log.blockNumber ? (blockTs.get(log.blockNumber) ?? null) : null,
        });
      }

      for (const log of purchasedLogs as any[]) {
        const a = log.args as any;
        const listedLog = allListed.find((l: any) => (l.args as any).listingId === a.listingId);
        const collection = listedLog
          ? (listedLog.args as any).collection.toLowerCase() === contracts.veBTC.toLowerCase()
            ? "veBTC" : "veMEZO"
          : "veBTC";
        const tokenId    = listedLog ? (listedLog.args as any).tokenId : 0n;
        const payTok     = listedLog
          ? getPaymentSymbol((listedLog.args as any).paymentToken, contracts.MUSD)
          : "BTC";
        newEvents.push({
          type: "sale",
          listingId:       a.listingId,
          collection,
          tokenId,
          price:           parseFloat(formatEther(a.price as bigint)).toFixed(4),
          paymentToken:    payTok,
          from:            a.seller,
          to:              a.buyer,
          blockNumber:     log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
          timestamp:       log.blockNumber ? (blockTs.get(log.blockNumber) ?? null) : null,
        });
      }

      for (const log of cancelledLogs as any[]) {
        const a = log.args as any;
        const listedLog = allListed.find((l: any) => (l.args as any).listingId === a.listingId);
        const collection = listedLog
          ? (listedLog.args as any).collection.toLowerCase() === contracts.veBTC.toLowerCase()
            ? "veBTC" : "veMEZO"
          : "veBTC";
        const tokenId = listedLog ? (listedLog.args as any).tokenId : 0n;
        const price   = listedLog
          ? parseFloat(formatEther((listedLog.args as any).price as bigint)).toFixed(4)
          : "0";
        const payTok  = listedLog
          ? getPaymentSymbol((listedLog.args as any).paymentToken, contracts.MUSD)
          : "BTC";
        const seller  = listedLog ? (listedLog.args as any).seller : "";
        newEvents.push({
          type: "cancelled",
          listingId:       a.listingId,
          collection,
          tokenId,
          price,
          paymentToken:    payTok,
          from:            seller,
          to:              null,
          blockNumber:     log.blockNumber ?? 0n,
          transactionHash: log.transactionHash ?? "",
          timestamp:       log.blockNumber ? (blockTs.get(log.blockNumber) ?? null) : null,
        });
      }

      // ── Bid events ──────────────────────────────────────────────────────────
      const resolveCol = (addr: string): "veBTC" | "veMEZO" =>
        addr.toLowerCase() === contracts.veBTC.toLowerCase() ? "veBTC" : "veMEZO";

      for (const log of bidPlacedLogs as any[]) {
        const a = log.args as any;
        newEvents.push({ type: "bid-placed", listingId: a.bidIndex, collection: resolveCol(a.collection), tokenId: a.tokenId, price: parseFloat(formatEther(a.bidAmount as bigint)).toFixed(4), paymentToken: getPaymentSymbol(a.bidToken, contracts.MUSD), from: a.bidder, to: null, blockNumber: log.blockNumber ?? 0n, transactionHash: log.transactionHash ?? "", timestamp: log.blockNumber ? (blockTs.get(log.blockNumber) ?? null) : null });
      }
      for (const log of bidAcceptedLogs as any[]) {
        const a = log.args as any;
        newEvents.push({ type: "bid-accepted", listingId: a.bidIndex, collection: resolveCol(a.collection), tokenId: a.tokenId, price: parseFloat(formatEther(a.bidAmount as bigint)).toFixed(4), paymentToken: getPaymentSymbol(a.bidToken, contracts.MUSD), from: a.seller, to: a.bidder, blockNumber: log.blockNumber ?? 0n, transactionHash: log.transactionHash ?? "", timestamp: log.blockNumber ? (blockTs.get(log.blockNumber) ?? null) : null });
      }
      for (const log of bidCancelledLogs as any[]) {
        const a = log.args as any;
        newEvents.push({ type: "bid-cancelled", listingId: a.bidIndex, collection: resolveCol(a.collection), tokenId: a.tokenId, price: "—", paymentToken: "—", from: a.bidder, to: null, blockNumber: log.blockNumber ?? 0n, transactionHash: log.transactionHash ?? "", timestamp: log.blockNumber ? (blockTs.get(log.blockNumber) ?? null) : null });
      }

      if (newEvents.length === 0) return;

      setEvents((prev) => {
        const merged = isInitial
          ? newEvents
          : [...newEvents, ...prev];
        merged.sort((a, b) =>
          a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0
        );
        return merged.slice(0, LIMIT);
      });
    },
    [publicClient, isDeployed, marketplaceAddress, contracts.veBTC, contracts.MUSD]
  );

  // Initial full fetch
  useEffect(() => {
    if (!publicClient || !isDeployed) return;
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        const latest = await (publicClient as any).getBlockNumber();
        const from = latest > LOOK_BACK ? latest - LOOK_BACK : 0n;
        if (!cancelled) {
          highestBlockRef.current = latest;
          await fetchAll(from, latest, true);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load activity");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeployed, marketplaceAddress]);

  // Incremental polling — only fetch blocks newer than what we have
  useEffect(() => {
    if (!publicClient || !isDeployed) return;

    const timer = setInterval(async () => {
      try {
        const latest = await (publicClient as any).getBlockNumber();
        const from   = highestBlockRef.current + 1n;
        if (from > latest) return; // nothing new
        highestBlockRef.current = latest;
        await fetchAll(from, latest, false);
      } catch {
        // silently ignore poll errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [publicClient, isDeployed, fetchAll]);

  return (
    <ActivityContext.Provider value={{ events, isLoading, error, isDeployed }}>
      {children}
    </ActivityContext.Provider>
  );
}
