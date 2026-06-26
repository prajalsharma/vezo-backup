"use client";

/**
 * useSwapAndBuy — pay for a listing in ANY supported token.
 *
 * Wraps SwapPaymentRouter.swapAndBuy: the contract reads the listing price
 * on-chain, swaps the buyer's chosen token → the listing currency via a
 * Uniswap-V2-compatible DEX, calls the marketplace's buyNFT, forwards the NFT
 * to the buyer, and refunds any surplus.
 *
 * Gated on `contracts.swapPaymentRouter` being deployed (non-zero). Until the
 * contract is deployed AND a DEX router is configured on-chain, `isSwapDeployed`
 * is false and the swap UI must not be shown.
 */

import { useCallback } from "react";
import { useWriteContract, usePublicClient } from "wagmi";
import { erc20Abi, maxUint256 } from "viem";
import { useNetwork } from "./useNetwork";

const ZERO = "0x0000000000000000000000000000000000000000";
const BTC = "0x7b7c000000000000000000000000000000000000";

const SWAP_PAYMENT_ROUTER_ABI = [
  {
    name: "swapAndBuy",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "buyToken", type: "address" },
      { name: "maxAmountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "maxSlippageBps", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export interface SwapAndBuyParams {
  listingId: number;
  buyToken: `0x${string}`;
  maxAmountIn: bigint;      // max buyToken to spend (incl. swap fee)
  amountOutMin: bigint;     // must be >= listing price (the contract's floor)
  maxSlippageBps?: bigint;
  buyerAddress: `0x${string}`;
}

export function useSwapAndBuy() {
  const { contracts } = useNetwork();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const spr = (contracts as { swapPaymentRouter?: string }).swapPaymentRouter as `0x${string}` | undefined;
  const isSwapDeployed = !!spr && spr !== ZERO;

  const swapAndBuy = useCallback(
    async (params: SwapAndBuyParams) => {
      if (!isSwapDeployed || !spr) throw new Error("Swap router not deployed on this network");
      if (!publicClient) throw new Error("Network not ready — try again");

      const { listingId, buyToken, maxAmountIn, amountOutMin, maxSlippageBps = 0n, buyerAddress } = params;
      const isNative = buyToken.toLowerCase() === BTC;

      // ERC-20 pay token: ensure the SwapPaymentRouter has allowance to pull it.
      if (!isNative) {
        const allowance = (await publicClient.readContract({
          address: buyToken,
          abi: erc20Abi,
          functionName: "allowance",
          args: [buyerAddress, spr],
        })) as bigint;
        if (allowance < maxAmountIn) {
          const approveHash = await writeContractAsync({
            address: buyToken,
            abi: erc20Abi,
            functionName: "approve",
            args: [spr, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      return writeContractAsync({
        address: spr,
        abi: SWAP_PAYMENT_ROUTER_ABI,
        functionName: "swapAndBuy",
        args: [BigInt(listingId), buyToken, maxAmountIn, amountOutMin, maxSlippageBps],
        value: isNative ? maxAmountIn : 0n,
      });
    },
    [isSwapDeployed, spr, publicClient, writeContractAsync]
  );

  return { swapAndBuy, isSwapDeployed, swapPaymentRouter: spr };
}
