"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { createPublicClient, http, formatEther, parseAbiItem, type AbiEvent } from "viem";
import { useNetwork } from "./useNetwork";
import { mezoMainnet, mezoTestnet } from "@/lib/wagmi";
import { computeDiscountBpsNumber } from "@/lib/computeDiscount";

export interface ActivityEvent {
  type: "sale" | "listed" | "cancelled";
  listingId: bigint;
  collection: "veBTC" | "veMEZO";
  tokenId: bigint;
  price: string;
  paymentToken: string;
  /** Discount in basis points (e.g. 500 = 5% OFF). Negative = premium. null if not computable. */
  discountBps: number | null;
  from: string;
  to: string | null;
  blockNumber: bigint;
  transactionHash: string;
  timestamp: number | null;
}

// Primary + fallback RPCs per network
const RPC_URLS: Record<number, string[]> = {
  31612: [
    "https://mainnet.mezo.public.validationcloud.io",
    "https://rpc.mezo.org",
  ],
  31611: [
    "https://rpc.test.mezo.org",
  ],
};

// How far back to look and how many blocks per chunk.
// Mainnet: scan the last 50k blocks (~2 days at ~3.5 s/block).
// Testnet: scan from genesis (block 0) — the chain is young with few blocks.
const LOOK_BACK_BLOCKS_MAINNET = 50_000n;
const LOOK_BACK_BLOCKS_TESTNET = 0n; // means "from genesis"
const CHUNK_SIZE = 2_000n;

// ── Adapter ABI (getIntrinsicValue only) ─────────────────────────────────────
const ADAPTER_ABI_IV = [
  {
    name: "getIntrinsicValue",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "collection", type: "address" },
      { name: "tokenId",    type: "uint256" },
    ],
    outputs: [
      { name: "amount",  type: "uint256" },
      { name: "lockEnd", type: "uint256" },
    ],
  },
] as const;

// ── Token address constants ───────────────────────────────────────────────────
const BTC_ADDR  = "0x7b7c000000000000000000000000000000000000";
const MEZO_ADDR = "0x7b7c000000000000000000000000000000000001";

// Discount calculation delegates to computeDiscount.ts. Cross-token listings
// intentionally return null until a reliable oracle-backed comparison exists.

// Typed event ABIs
const LISTED_EVENT    = parseAbiItem("event Listed(uint256 indexed listingId, address indexed seller, address indexed collection, uint256 tokenId, uint256 price, address paymentToken)");
const PURCHASED_EVENT = parseAbiItem("event Purchased(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price)");
const CANCELLED_EVENT = parseAbiItem("event Cancelled(uint256 indexed listingId)");

function getPaymentSymbol(token: string, musd: string): string {
  const lower = token.toLowerCase();
  if (lower === "0x7b7c000000000000000000000000000000000000") return "BTC";
  if (lower === "0x7b7c000000000000000000000000000000000001") return "MEZO";
  if (lower === musd.toLowerCase()) return "MUSD";
  if (!token) return "—";
  return token.slice(0, 6) + "…";
}

type AnyClient = ReturnType<typeof createPublicClient>;

/** Try each RPC URL in sequence; return the first successful result */
async function withFallback<T>(
  chainId: number,
  fn: (client: AnyClient) => Promise<T>
): Promise<T> {
  const urls = RPC_URLS[chainId] ?? RPC_URLS[31612];
  const chain = chainId === 31612 ? mezoMainnet : mezoTestnet;
  let lastErr: unknown;
  for (const url of urls) {
    const client = createPublicClient({ chain, transport: http(url) });
    try {
      return await fn(client);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Fetch logs in CHUNK_SIZE slices to stay within RPC range limits */
async function fetchLogsChunked(
  chainId: number,
  address: `0x${string}`,
  event: Parameters<AnyClient["getLogs"]>[0]["event"],
  fromBlock: bigint,
  toBlock: bigint
): Promise<ReturnType<AnyClient["getLogs"]> extends Promise<infer R> ? R : never> {
  const allLogs: any[] = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + CHUNK_SIZE - 1n > toBlock ? toBlock : start + CHUNK_SIZE - 1n;
    const chunk = await withFallback(chainId, (client) =>
      client.getLogs({ address, event, fromBlock: start, toBlock: end } as any)
    );
    allLogs.push(...chunk);
    start = end + 1n;
  }
  return allLogs as any;
}

export function useActivityFeed(limit = 50) {
  const { contracts, chainId } = useNetwork();
  const publicClient = usePublicClient();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketplaceAddress = contracts.marketplace as `0x${string}`;
  const isDeployed =
    marketplaceAddress !== "0x0000000000000000000000000000000000000000";

  useEffect(() => {
    if (!publicClient || !isDeployed) return;

    let cancelled = false;

    async function fetchEvents() {
      setIsLoading(true);
      setError(null);

      try {
        // Get current block number via fallback-aware client
        const latestBlock = await withFallback(chainId, (client) =>
          client.getBlockNumber()
        );
        // Testnet scans from genesis; mainnet scans the last 50k blocks
        const isTestnet = chainId === 31611;
        const lookBack = isTestnet ? LOOK_BACK_BLOCKS_TESTNET : LOOK_BACK_BLOCKS_MAINNET;
        const fromBlock = lookBack === 0n ? 0n : (latestBlock > lookBack ? latestBlock - lookBack : 0n);

        if (cancelled) return;

        // Fetch all three event types in parallel using chunked requests
        const [listedLogs, purchasedLogs, cancelledLogs] = await Promise.all([
          fetchLogsChunked(chainId, marketplaceAddress, LISTED_EVENT,    fromBlock, latestBlock),
          fetchLogsChunked(chainId, marketplaceAddress, PURCHASED_EVENT, fromBlock, latestBlock),
          fetchLogsChunked(chainId, marketplaceAddress, CANCELLED_EVENT, fromBlock, latestBlock),
        ]);

        if (cancelled) return;

        // Collect unique block numbers to fetch timestamps
        const blockNumbers = new Set<bigint>();
        [...listedLogs, ...purchasedLogs, ...cancelledLogs].forEach((log: any) => {
          if (log.blockNumber != null) blockNumbers.add(log.blockNumber);
        });

        // Fetch block timestamps (capped to avoid rate limits)
        const blockTimestamps = new Map<bigint, number>();
        const blockArr = Array.from(blockNumbers).slice(0, 100);
        const blockData = await Promise.allSettled(
          blockArr.map((bn) =>
            withFallback(chainId, (client) => client.getBlock({ blockNumber: bn }))
          )
        );
        blockArr.forEach((bn, i) => {
          const result = blockData[i];
          if (result.status === "fulfilled") {
            blockTimestamps.set(bn, Number(result.value.timestamp) * 1000);
          }
        });

        if (cancelled) return;

        // ── Fetch intrinsic values from adapter for unique (collection, tokenId) pairs ──
        // Build a deduplicated map keyed by "collection:tokenId"
        const ivMap = new Map<string, bigint>();
        const adapterAddress = contracts.adapter as `0x${string}`;
        const isAdapterReady =
          !!adapterAddress &&
          adapterAddress !== "0x0000000000000000000000000000000000000000";

        if (isAdapterReady) {
          // Collect unique pairs from all log types
          const pairs: { collection: string; tokenId: bigint; key: string }[] = [];
          const seen = new Set<string>();

          const collectPair = (collection: string, tokenId: bigint) => {
            if (!collection || tokenId === undefined) return;
            const key = `${collection.toLowerCase()}:${tokenId}`;
            if (!seen.has(key)) {
              seen.add(key);
              pairs.push({ collection, tokenId, key });
            }
          };

          for (const log of listedLogs as any[]) {
            const a = log.args ?? {};
            collectPair(String(a.collection ?? ""), a.tokenId ?? 0n);
          }
          for (const log of purchasedLogs as any[]) {
            const a = log.args ?? {};
            const ll = (listedLogs as any[]).find((l: any) => l.args?.listingId === a.listingId);
            if (ll) collectPair(String(ll.args?.collection ?? ""), ll.args?.tokenId ?? 0n);
          }
          for (const log of cancelledLogs as any[]) {
            const a = log.args ?? {};
            const ll = (listedLogs as any[]).find((l: any) => l.args?.listingId === a.listingId);
            if (ll) collectPair(String(ll.args?.collection ?? ""), ll.args?.tokenId ?? 0n);
          }

          // Batch fetch intrinsic values; silently ignore failures per token
          const ivResults = await Promise.allSettled(
            pairs.map(({ collection, tokenId }) =>
              withFallback(chainId, (client) =>
                client.readContract({
                  address: adapterAddress,
                  abi: ADAPTER_ABI_IV,
                  functionName: "getIntrinsicValue",
                  args: [collection as `0x${string}`, tokenId],
                })
              )
            )
          );

          pairs.forEach(({ key }, i) => {
            const res = ivResults[i];
            if (res.status === "fulfilled") {
              const [amount] = res.value as [bigint, bigint];
              ivMap.set(key, amount);
            }
          });
        }

        if (cancelled) return;

        const allEvents: ActivityEvent[] = [];

        for (const log of listedLogs as any[]) {
          const args = log.args ?? {};
          const isVeBTC =
            String(args.collection ?? "").toLowerCase() ===
            contracts.veBTC.toLowerCase();
          const nftTokenAddr = isVeBTC ? BTC_ADDR : MEZO_ADDR;
          const ivKey = `${String(args.collection ?? "").toLowerCase()}:${args.tokenId ?? 0n}`;
          const iv = ivMap.get(ivKey) ?? 0n;
          const priceRaw = (args.price as bigint) ?? 0n;
          allEvents.push({
            type: "listed",
            listingId: args.listingId ?? 0n,
            collection: isVeBTC ? "veBTC" : "veMEZO",
            tokenId: args.tokenId ?? 0n,
            price: parseFloat(formatEther(priceRaw)).toFixed(4),
            paymentToken: getPaymentSymbol(args.paymentToken ?? "", contracts.MUSD),
            discountBps: computeDiscountBpsNumber(iv, nftTokenAddr, priceRaw, args.paymentToken ?? ""),
            from: args.seller ?? "",
            to: null,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? "",
            timestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? null) : null,
          });
        }

        for (const log of purchasedLogs as any[]) {
          const args = log.args ?? {};
          const listedLog = (listedLogs as any[]).find(
            (l: any) => l.args?.listingId === args.listingId
          );
          const listedArgs = listedLog?.args ?? {};
          const collection =
            String(listedArgs.collection ?? "").toLowerCase() ===
            contracts.veBTC.toLowerCase()
              ? "veBTC"
              : "veMEZO";
          const nftTokenAddr = collection === "veBTC" ? BTC_ADDR : MEZO_ADDR;
          const ivKey = `${String(listedArgs.collection ?? "").toLowerCase()}:${listedArgs.tokenId ?? 0n}`;
          const iv = ivMap.get(ivKey) ?? 0n;
          const priceRaw = (args.price as bigint) ?? 0n;

          allEvents.push({
            type: "sale",
            listingId: args.listingId ?? 0n,
            collection,
            tokenId: listedArgs.tokenId ?? 0n,
            price: parseFloat(formatEther(priceRaw)).toFixed(4),
            paymentToken: getPaymentSymbol(listedArgs.paymentToken ?? "", contracts.MUSD),
            discountBps: computeDiscountBpsNumber(iv, nftTokenAddr, priceRaw, listedArgs.paymentToken ?? ""),
            from: args.seller ?? "",
            to: args.buyer ?? null,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? "",
            timestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? null) : null,
          });
        }

        for (const log of cancelledLogs as any[]) {
          const args = log.args ?? {};
          const listedLog = (listedLogs as any[]).find(
            (l: any) => l.args?.listingId === args.listingId
          );
          const listedArgs = listedLog?.args ?? {};
          const collection =
            String(listedArgs.collection ?? "").toLowerCase() ===
            contracts.veBTC.toLowerCase()
              ? "veBTC"
              : "veMEZO";
          const nftTokenAddr = collection === "veBTC" ? BTC_ADDR : MEZO_ADDR;
          const ivKey = `${String(listedArgs.collection ?? "").toLowerCase()}:${listedArgs.tokenId ?? 0n}`;
          const iv = ivMap.get(ivKey) ?? 0n;
          const priceRaw = (listedArgs.price as bigint) ?? 0n;

          allEvents.push({
            type: "cancelled",
            listingId: args.listingId ?? 0n,
            collection,
            tokenId: listedArgs.tokenId ?? 0n,
            price: parseFloat(formatEther(priceRaw)).toFixed(4),
            paymentToken: getPaymentSymbol(listedArgs.paymentToken ?? "", contracts.MUSD),
            discountBps: computeDiscountBpsNumber(iv, nftTokenAddr, priceRaw, listedArgs.paymentToken ?? ""),
            from: listedArgs.seller ?? "",
            to: null,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? "",
            timestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? null) : null,
          });
        }

        // Sort by block number descending, then cap
        allEvents.sort((a, b) =>
          a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0
        );

        if (!cancelled) {
          setEvents(allEvents.slice(0, limit));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load activity");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [publicClient, marketplaceAddress, isDeployed, chainId, contracts.veBTC, contracts.MUSD, contracts.adapter, limit]);

  return { events, isLoading, error, isDeployed };
}
