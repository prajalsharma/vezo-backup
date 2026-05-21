/**
 * useBidding — React hook for the VeNFTBidding contract
 *
 * Provides:
 *  - createBid()   — place a bid on a veNFT
 *  - cancelBid()   — cancel an active bid
 *  - acceptBid()   — accept a bid (NFT owner only)
 *  - watchlist()   — emit a watchlist signal (zero gas on-chain)
 *  - useActiveBids — read active bids for a given token
 *  - useBidderBids — read a bidder's bid IDs
 *
 * All writes use wagmi writeContract with simulation-first pattern.
 * Reads use wagmi readContract / useReadContract.
 */

"use client";

import { useCallback } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
} from "wagmi";
import { parseUnits, erc20Abi } from "viem";
import { useNetwork } from "./useNetwork";
import { getContracts } from "../lib/contracts";
import { VeNFTBiddingABI } from "../lib/abis";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateBidParams {
  collection:        `0x${string}`;
  tokenId:           bigint;
  paymentToken:      `0x${string}`;
  amount:            bigint;           // in payment token units (18 dec)
  expiry:            bigint;           // Unix timestamp
  minIntrinsicValue?: bigint;          // 0n = any
  maxIntrinsicValue?: bigint;          // 0n = any
  minVotingPower?:    bigint;          // 0n = any
  minLockDuration?:   bigint;          // 0n = any
  requireAutoMaxLock?: boolean;        // false = any
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useBidding() {
  const { network } = useNetwork();
  const contracts   = getContracts(network);
  const publicClient = usePublicClient();

  const biddingAddress = contracts.bidding as `0x${string}` | undefined;

  const {
    writeContractAsync,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // ── createBid ─────────────────────────────────────────────────────────────

  const createBid = useCallback(
    async (params: CreateBidParams) => {
      if (!biddingAddress || biddingAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Bidding contract not deployed on this network");
      }

      const {
        collection,
        tokenId,
        paymentToken,
        amount,
        expiry,
        minIntrinsicValue  = 0n,
        maxIntrinsicValue  = 0n,
        minVotingPower     = 0n,
        minLockDuration    = 0n,
        requireAutoMaxLock = false,
      } = params;

      // BidFilter struct (range hints for indexers — mirrors the contract's BidFilter)
      const filter = {
        minIntrinsicValue,
        maxIntrinsicValue,
        maxLockDuration:    0n,   // not enforced on-chain; use minLockDuration below
        minVotingPower,
        requireAutoMaxLock,
      };

      return writeContractAsync({
        address:      biddingAddress,
        abi:          VeNFTBiddingABI,
        functionName: "createBid",
        args: [
          collection,
          tokenId,
          paymentToken,
          amount,
          expiry,
          filter,
          minIntrinsicValue,
          maxIntrinsicValue,
          minVotingPower,
          minLockDuration,
          requireAutoMaxLock,
        ],
      });
    },
    [biddingAddress, writeContractAsync]
  );

  // ── cancelBid ─────────────────────────────────────────────────────────────

  const cancelBid = useCallback(
    async (bidId: bigint) => {
      if (!biddingAddress || biddingAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Bidding contract not deployed on this network");
      }
      return writeContractAsync({
        address:      biddingAddress,
        abi:          VeNFTBiddingABI,
        functionName: "cancelBid",
        args:         [bidId],
      });
    },
    [biddingAddress, writeContractAsync]
  );

  // ── acceptBid ─────────────────────────────────────────────────────────────

  const acceptBid = useCallback(
    async (bidId: bigint) => {
      if (!biddingAddress || biddingAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("Bidding contract not deployed on this network");
      }
      return writeContractAsync({
        address:      biddingAddress,
        abi:          VeNFTBiddingABI,
        functionName: "acceptBid",
        args:         [bidId],
      });
    },
    [biddingAddress, writeContractAsync]
  );

  // ── emitWatchlist ─────────────────────────────────────────────────────────

  const toggleWatchlist = useCallback(
    async (collection: `0x${string}`, tokenId: bigint, watching: boolean) => {
      if (!biddingAddress || biddingAddress === "0x0000000000000000000000000000000000000000") return;
      return writeContractAsync({
        address:      biddingAddress,
        abi:          VeNFTBiddingABI,
        functionName: "emitWatchlistUpdate",
        args:         [collection, tokenId, watching],
      });
    },
    [biddingAddress, writeContractAsync]
  );

  return {
    // Addresses
    biddingAddress,

    // Write actions
    createBid,
    cancelBid,
    acceptBid,
    toggleWatchlist,

    // Write state
    txHash,
    isWritePending,
    isConfirming,
    isConfirmed,
    writeError,
  };
}

// ─── Read hook: active bids for a token ─────────────────────────────────────

export function useActiveTokenBids(
  collection: `0x${string}` | undefined,
  tokenId:    bigint | undefined
) {
  const { network } = useNetwork();
  const contracts   = getContracts(network);
  const biddingAddress = contracts.bidding as `0x${string}` | undefined;

  return useReadContract({
    address:      biddingAddress,
    abi:          VeNFTBiddingABI,
    functionName: "getActiveTokenBids",
    args:         collection && tokenId !== undefined ? [collection, tokenId] : undefined,
    query: {
      enabled: !!(biddingAddress && collection && tokenId !== undefined &&
                  biddingAddress !== "0x0000000000000000000000000000000000000000"),
    },
  });
}

// ─── Read hook: all bid IDs for a bidder ────────────────────────────────────

export function useBidderBids(bidder: `0x${string}` | undefined) {
  const { network } = useNetwork();
  const contracts   = getContracts(network);
  const biddingAddress = contracts.bidding as `0x${string}` | undefined;

  return useReadContract({
    address:      biddingAddress,
    abi:          VeNFTBiddingABI,
    functionName: "getBidderBids",
    args:         bidder ? [bidder] : undefined,
    query: {
      enabled: !!(biddingAddress && bidder &&
                  biddingAddress !== "0x0000000000000000000000000000000000000000"),
    },
  });
}
