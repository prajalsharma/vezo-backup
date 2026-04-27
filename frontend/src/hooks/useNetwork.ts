"use client";

import { useState, useCallback } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { mezoTestnet, mezoMainnet } from "@/lib/wagmi";
import { getContracts, NetworkType } from "@/lib/contracts";

export function useNetwork() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isTestnet = chainId === mezoTestnet.id;
  const isMainnet = chainId === mezoMainnet.id;
  const isMezoNetwork = isTestnet || isMainnet;

  const network: NetworkType = isMainnet ? "mainnet" : "testnet";
  const contracts = getContracts(network);

  const switchToTestnet = useCallback(() => {
    switchChain?.({ chainId: mezoTestnet.id });
  }, [switchChain]);

  const switchToMainnet = useCallback(() => {
    switchChain?.({ chainId: mezoMainnet.id });
  }, [switchChain]);

  const toggleNetwork = useCallback(() => {
    if (isTestnet) {
      switchToMainnet();
    } else {
      switchToTestnet();
    }
  }, [isTestnet, switchToMainnet, switchToTestnet]);

  return {
    chainId,
    network,
    isTestnet,
    isMainnet,
    isMezoNetwork,
    contracts,
    switchToTestnet,
    switchToMainnet,
    toggleNetwork,
  };
}
