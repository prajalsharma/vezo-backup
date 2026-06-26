"use client";

/**
 * useSwapAndBuy — pay for an ERC-20-quoted listing (e.g. MUSD) using a DIFFERENT
 * token, swapping through Mezo's Velodrome-v2 DEX, then buying via the existing
 * marketplace. 100% on-chain — no API key, the buyer just pays gas.
 *
 * Flow: quoteSwap() reads the live pool rate → caller derives maxAmountIn /
 * amountOutMin with a slippage buffer → swapAndBuy() approves + executes.
 *
 * Constraints (Mezo mainnet): the listing quote token must be ERC-20 (MUSD); the
 * pay token must have a Velodrome pool to it — BTC, mUSDC, mUSDT. MEZO has no pool
 * and cannot be swapped. Gated on `contracts.swapPaymentRouter` being deployed.
 */

import { useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, maxUint256 } from "viem";
import { useNetwork } from "./useNetwork";

const ZERO = "0x0000000000000000000000000000000000000000";

const SWAP_PAYMENT_ROUTER_ABI = [
  {
    name: "swapAndBuy",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "payToken", type: "address" },
      { name: "maxAmountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "stable", type: "bool" },
    ],
    outputs: [],
  },
] as const;

const VELO_FACTORY_ABI = [
  { name: "getPool", type: "function", stateMutability: "view",
    inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }, { name: "stable", type: "bool" }],
    outputs: [{ type: "address" }] },
] as const;

const VELO_POOL_ABI = [
  { name: "getAmountOut", type: "function", stateMutability: "view",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "tokenIn", type: "address" }],
    outputs: [{ type: "uint256" }] },
] as const;

export interface SwapAndBuyParams {
  listingId: number;
  payToken: `0x${string}`;
  maxAmountIn: bigint;
  amountOutMin: bigint;     // must be >= listing price
  stable?: boolean;
  buyerAddress: `0x${string}`;
}

export function useSwapAndBuy() {
  const { contracts } = useNetwork();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const c = contracts as { swapPaymentRouter?: string; poolFactory?: string };
  const spr = c.swapPaymentRouter as `0x${string}` | undefined;
  const factory = c.poolFactory as `0x${string}` | undefined;
  const isSwapDeployed = !!spr && spr !== ZERO && !!factory && factory !== ZERO;

  /** Read the live pool output for `amountIn` of `payToken` → `quoteToken`. Returns
   *  the expected quote-token amount, or null if no pool / not ready. */
  const quoteSwap = useCallback(
    async (payToken: `0x${string}`, quoteToken: `0x${string}`, amountIn: bigint, stable = false) => {
      if (!publicClient || !factory || factory === ZERO) return null;
      const pool = (await publicClient.readContract({
        address: factory, abi: VELO_FACTORY_ABI, functionName: "getPool", args: [payToken, quoteToken, stable],
      })) as `0x${string}`;
      if (!pool || pool === ZERO) return null;
      return (await publicClient.readContract({
        address: pool, abi: VELO_POOL_ABI, functionName: "getAmountOut", args: [amountIn, payToken],
      })) as bigint;
    },
    [publicClient, factory]
  );

  const swapAndBuy = useCallback(
    async (params: SwapAndBuyParams) => {
      if (!isSwapDeployed || !spr) throw new Error("Swap router not deployed on this network");
      if (!publicClient) throw new Error("Network not ready — try again");
      const { listingId, payToken, maxAmountIn, amountOutMin, stable = false, buyerAddress } = params;

      const allowance = (await publicClient.readContract({
        address: payToken, abi: erc20Abi, functionName: "allowance", args: [buyerAddress, spr],
      })) as bigint;
      if (allowance < maxAmountIn) {
        const approveHash = await writeContractAsync({
          address: payToken, abi: erc20Abi, functionName: "approve", args: [spr, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      return writeContractAsync({
        address: spr,
        abi: SWAP_PAYMENT_ROUTER_ABI,
        functionName: "swapAndBuy",
        args: [BigInt(listingId), payToken, maxAmountIn, amountOutMin, stable],
      });
    },
    [isSwapDeployed, spr, publicClient, writeContractAsync]
  );

  return { swapAndBuy, quoteSwap, isSwapDeployed, swapPaymentRouter: spr, poolFactory: factory };
}
