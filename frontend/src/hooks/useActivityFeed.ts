"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatEther } from "viem";
import { useNetwork } from "./useNetwork";

export interface ActivityEvent {
  type: "sale" | "listed" | "cancelled" | "bid-placed" | "bid-accepted" | "bid-cancelled";
  listingId: bigint;
  collection: "veBTC" | "veMEZO";
  tokenId: bigint;
  price: string;
  paymentToken: string;
  from: string;
  to: string | null;
  blockNumber: bigint;
  transactionHash: string;
  timestamp: number | null;
}

function getPaymentSymbol(token: string, musd: string): string {
  const lower = token.toLowerCase();
  if (lower === "0x7b7c000000000000000000000000000000000000") return "BTC";
  if (lower === "0x7b7c000000000000000000000000000000000001") return "MEZO";
  if (lower === musd.toLowerCase()) return "MUSD";
  return token.slice(0, 6) + "…";
}

// Mezo testnet RPC limits getLogs to max 10,000 blocks per request.
// This helper fetches logs across a range by splitting into 10k-block chunks.
async function getLogsChunked(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  params: {
    address: `0x${string}`;
    event: Parameters<typeof publicClient.getLogs>[0]["event"];
    fromBlock: bigint;
    toBlock: bigint;
  }
): Promise<Awaited<ReturnType<typeof publicClient.getLogs>>> {
  const CHUNK_SIZE = 9_000n;
  const allLogs: Awaited<ReturnType<typeof publicClient.getLogs>> = [];
  let from = params.fromBlock;

  while (from <= params.toBlock) {
    const to = from + CHUNK_SIZE > params.toBlock ? params.toBlock : from + CHUNK_SIZE;
    const logs = await publicClient.getLogs({
      address: params.address,
      event: params.event,
      fromBlock: from,
      toBlock: to,
    });
    allLogs.push(...(logs as any[]));
    from = to + 1n;
  }

  return allLogs;
}

export function useActivityFeed(limit = 50) {
  const { contracts } = useNetwork();
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
        // Get the current block to define our range
        const latestBlock = await publicClient!.getBlockNumber();

        // Deploy block is unknown; look back at most 200k blocks (≈ ~55 days on Mezo)
        // using chunked requests of 9k blocks to respect RPC limits.
        const LOOK_BACK = 200_000n;
        const fromBlock = latestBlock > LOOK_BACK ? latestBlock - LOOK_BACK : 0n;

        const listedEvent = {
          type: "event" as const,
          name: "Listed",
          inputs: [
            { indexed: true, name: "listingId", type: "uint256" as const },
            { indexed: true, name: "seller", type: "address" as const },
            { indexed: true, name: "collection", type: "address" as const },
            { indexed: false, name: "tokenId", type: "uint256" as const },
            { indexed: false, name: "price", type: "uint256" as const },
            { indexed: false, name: "paymentToken", type: "address" as const },
          ],
        };

        const purchasedEvent = {
          type: "event" as const,
          name: "Purchased",
          inputs: [
            { indexed: true, name: "listingId", type: "uint256" as const },
            { indexed: true, name: "buyer", type: "address" as const },
            { indexed: true, name: "seller", type: "address" as const },
            { indexed: false, name: "price", type: "uint256" as const },
          ],
        };

        const cancelledEvent = {
          type: "event" as const,
          name: "Cancelled",
          inputs: [
            { indexed: true, name: "listingId", type: "uint256" as const },
          ],
        };

        // Fetch all three event types in parallel using chunked requests
        const [listedLogs, purchasedLogs, cancelledLogs] = await Promise.all([
          getLogsChunked(publicClient!, {
            address: marketplaceAddress,
            event: listedEvent,
            fromBlock,
            toBlock: latestBlock,
          }),
          getLogsChunked(publicClient!, {
            address: marketplaceAddress,
            event: purchasedEvent,
            fromBlock,
            toBlock: latestBlock,
          }),
          getLogsChunked(publicClient!, {
            address: marketplaceAddress,
            event: cancelledEvent,
            fromBlock,
            toBlock: latestBlock,
          }),
        ]);

        if (cancelled) return;

        // Collect unique block numbers to fetch timestamps
        const blockNumbers = new Set<bigint>();
        [...listedLogs, ...purchasedLogs, ...cancelledLogs].forEach((log) => {
          if (log.blockNumber != null) blockNumbers.add(log.blockNumber);
        });

        // Fetch block timestamps in parallel (capped to avoid rate limits)
        const blockTimestamps = new Map<bigint, number>();
        const blockArr = Array.from(blockNumbers).slice(0, 100);
        const blockData = await Promise.allSettled(
          blockArr.map((bn) => publicClient!.getBlock({ blockNumber: bn }))
        );
        blockArr.forEach((bn, i) => {
          const result = blockData[i];
          if (result.status === "fulfilled") {
            blockTimestamps.set(bn, Number(result.value.timestamp) * 1000);
          }
        });

        if (cancelled) return;

        const allEvents: ActivityEvent[] = [];

        for (const log of listedLogs) {
          const args = log.args as any;
          const isVeBTC =
            (args.collection as string).toLowerCase() ===
            contracts.veBTC.toLowerCase();
          allEvents.push({
            type: "listed",
            listingId: args.listingId,
            collection: isVeBTC ? "veBTC" : "veMEZO",
            tokenId: args.tokenId,
            price: parseFloat(formatEther(args.price as bigint)).toFixed(4),
            paymentToken: getPaymentSymbol(args.paymentToken, contracts.MUSD),
            from: args.seller,
            to: null,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? "",
            timestamp: log.blockNumber
              ? (blockTimestamps.get(log.blockNumber) ?? null)
              : null,
          });
        }

        for (const log of purchasedLogs) {
          const args = log.args as any;
          const listedLog = listedLogs.find(
            (l) => (l.args as any).listingId === args.listingId
          );
          const collection = listedLog
            ? (listedLog.args as any).collection.toLowerCase() ===
              contracts.veBTC.toLowerCase()
              ? "veBTC"
              : "veMEZO"
            : "veBTC";
          const tokenId = listedLog ? (listedLog.args as any).tokenId : 0n;
          const paymentToken = listedLog
            ? getPaymentSymbol(
                (listedLog.args as any).paymentToken,
                contracts.MUSD
              )
            : "BTC";

          allEvents.push({
            type: "sale",
            listingId: args.listingId,
            collection,
            tokenId,
            price: parseFloat(formatEther(args.price as bigint)).toFixed(4),
            paymentToken,
            from: args.seller,
            to: args.buyer,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? "",
            timestamp: log.blockNumber
              ? (blockTimestamps.get(log.blockNumber) ?? null)
              : null,
          });
        }

        for (const log of cancelledLogs) {
          const args = log.args as any;
          const listedLog = listedLogs.find(
            (l) => (l.args as any).listingId === args.listingId
          );
          const collection = listedLog
            ? (listedLog.args as any).collection.toLowerCase() ===
              contracts.veBTC.toLowerCase()
              ? "veBTC"
              : "veMEZO"
            : "veBTC";
          const tokenId = listedLog ? (listedLog.args as any).tokenId : 0n;
          const price = listedLog
            ? parseFloat(
                formatEther((listedLog.args as any).price as bigint)
              ).toFixed(4)
            : "0";
          const paymentToken = listedLog
            ? getPaymentSymbol(
                (listedLog.args as any).paymentToken,
                contracts.MUSD
              )
            : "BTC";
          const seller = listedLog ? (listedLog.args as any).seller : "";

          allEvents.push({
            type: "cancelled",
            listingId: args.listingId,
            collection,
            tokenId,
            price,
            paymentToken,
            from: seller,
            to: null,
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash ?? "",
            timestamp: log.blockNumber
              ? (blockTimestamps.get(log.blockNumber) ?? null)
              : null,
          });
        }

        // Sort by block number descending (most recent first), then cap
        allEvents.sort((a, b) =>
          a.blockNumber > b.blockNumber
            ? -1
            : a.blockNumber < b.blockNumber
            ? 1
            : 0
        );

        setEvents(allEvents.slice(0, limit));
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
  }, [publicClient, marketplaceAddress, isDeployed, contracts.veBTC, contracts.MUSD, limit]);

  return { events, isLoading, error, isDeployed };
}
