"use client";

import { useState, useCallback, useEffect } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { mezoTestnet, mezoMainnet } from "@/lib/wagmi";
import { getContracts, NetworkType } from "@/lib/contracts";

const STORAGE_KEY = "vezo-selected-network";

function getStoredNetwork(): NetworkType {
  if (typeof window === "undefined") return "mainnet";
  return (localStorage.getItem(STORAGE_KEY) as NetworkType) ?? "mainnet";
}

export function useNetwork() {
  const walletChainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isMezoNetwork =
    walletChainId === mezoTestnet.id || walletChainId === mezoMainnet.id;

  // selectedNetwork drives ALL data reads and is independent of wallet chain.
  // Defaults to mainnet so live listings show regardless of wallet state.
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkType>(getStoredNetwork);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "mainnet" || e.newValue === "testnet")) {
        setSelectedNetwork(e.newValue as NetworkType);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const network: NetworkType = selectedNetwork;
  const contracts = getContracts(network);

  // chainId for RPC reads — must match selectedNetwork, NOT the wallet chain.
  // Without this, reading a mainnet address with chainId=31611 (testnet) returns nothing.
  const chainId =
    selectedNetwork === "mainnet" ? mezoMainnet.id : mezoTestnet.id;

  const switchToTestnet = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "testnet");
    setSelectedNetwork("testnet");
    switchChain?.({ chainId: mezoTestnet.id });
  }, [switchChain]);

  const switchToMainnet = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "mainnet");
    setSelectedNetwork("mainnet");
    switchChain?.({ chainId: mezoMainnet.id });
  }, [switchChain]);

  const toggleNetwork = useCallback(() => {
    if (selectedNetwork === "testnet") {
      switchToMainnet();
    } else {
      switchToTestnet();
    }
  }, [selectedNetwork, switchToMainnet, switchToTestnet]);

  return {
    chainId,           // read chain — matches selectedNetwork
    walletChainId,     // actual wallet chain — for transaction/switch logic
    network,
    isTestnet: selectedNetwork === "testnet",
    isMainnet: selectedNetwork === "mainnet",
    isMezoNetwork,
    contracts,
    switchToTestnet,
    switchToMainnet,
    toggleNetwork,
  };
}
