// Mezo Network Contract Addresses
//
// All addresses below are public on-chain contract addresses — not secrets.
// They are hardcoded as fallbacks so the app works without env vars configured.
// Override via environment variables for custom deployments.

const getEnvAddress = (key: string, fallback: string): `0x${string}` => {
  const value = process.env[key] || fallback;
  return value as `0x${string}`;
};

export const CONTRACTS = {
  testnet: {
    chainId: 31611,
    rpcUrl: "https://rpc.test.mezo.org",
    explorer: "https://explorer.test.mezo.org",

    // Token addresses (fixed on Mezo network)
    BTC:  getEnvAddress("NEXT_PUBLIC_BTC_ADDRESS",  "0x7b7c000000000000000000000000000000000000"),
    MEZO: getEnvAddress("NEXT_PUBLIC_MEZO_ADDRESS", "0x7b7c000000000000000000000000000000000001"),
    MUSD: getEnvAddress("NEXT_PUBLIC_MUSD_TESTNET", "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"),

    // veNFT addresses
    veBTC:  getEnvAddress("NEXT_PUBLIC_VEBTC_TESTNET",  "0x38E35d92E6Bfc6787272A62345856B13eA12130a"),
    veMEZO: getEnvAddress("NEXT_PUBLIC_VEMEZO_TESTNET", "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b"),

    // Marketplace contracts — deployed on Mezo Testnet
    marketplace:  getEnvAddress("NEXT_PUBLIC_MARKETPLACE_TESTNET",  "0xcFbAf5F9563AFa8E4CD1861876a6BD011aA00ddb"),
    adapter:      getEnvAddress("NEXT_PUBLIC_ADAPTER_TESTNET",      "0x3B302be6d65CeAF32310A7F37E332EdbBA3759E3"),
    router:       getEnvAddress("NEXT_PUBLIC_ROUTER_TESTNET",       "0xDcB630Bf1f306D215A81A998D235Eb457fe10619"),
    admin:        getEnvAddress("NEXT_PUBLIC_ADMIN_TESTNET",        "0x21943576a5152f6E1503B3b800Fd7830ab2dD7ce"),
    swapRouter:   getEnvAddress("NEXT_PUBLIC_SWAP_ROUTER_TESTNET",  "0x0000000000000000000000000000000000000000"),
    bidRegistry:  getEnvAddress("NEXT_PUBLIC_BID_REGISTRY_TESTNET", "0x0000000000000000000000000000000000000000"),
  },
  mainnet: {
    chainId: 31612,
    rpcUrl: "https://rpc.mezo.org",
    explorer: "https://explorer.mezo.org",

    // Token addresses (fixed on Mezo network)
    BTC:  getEnvAddress("NEXT_PUBLIC_BTC_ADDRESS",  "0x7b7c000000000000000000000000000000000000"),
    MEZO: getEnvAddress("NEXT_PUBLIC_MEZO_ADDRESS", "0x7b7c000000000000000000000000000000000001"),
    MUSD: getEnvAddress("NEXT_PUBLIC_MUSD_MAINNET", "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186"),

    // veNFT addresses
    veBTC:  getEnvAddress("NEXT_PUBLIC_VEBTC_MAINNET",  "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279"),
    veMEZO: getEnvAddress("NEXT_PUBLIC_VEMEZO_MAINNET", "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122"),

    // Marketplace contracts — deployed on Mezo Mainnet
    marketplace:  getEnvAddress("NEXT_PUBLIC_MARKETPLACE_MAINNET",  "0x9B9Cbc100287248aa2a1e607524aeec93B461B37"),
    adapter:      getEnvAddress("NEXT_PUBLIC_ADAPTER_MAINNET",      "0xF9B0B009c97BD843B173B860B79e96b5cc440E06"),
    router:       getEnvAddress("NEXT_PUBLIC_ROUTER_MAINNET",       "0xeCc1929436e1ab3e54c69EbD234062439a8eE369"),
    admin:        getEnvAddress("NEXT_PUBLIC_ADMIN_MAINNET",        "0x5d7C05C26Aef7ED038e1B3aC26Ac4755C3e85685"),
    swapRouter:   getEnvAddress("NEXT_PUBLIC_SWAP_ROUTER_MAINNET",  "0x0000000000000000000000000000000000000000"),
    bidRegistry:  getEnvAddress("NEXT_PUBLIC_BID_REGISTRY_MAINNET", "0x0000000000000000000000000000000000000000"),
  },
} as const;

export type NetworkType = "testnet" | "mainnet";

export function getContracts(network: NetworkType) {
  return CONTRACTS[network];
}

// Check if marketplace is deployed
export function isMarketplaceDeployed(network: NetworkType): boolean {
  const contracts = getContracts(network);
  return (
    contracts.marketplace !== "0x0000000000000000000000000000000000000000"
  );
}

// Payment token options
export const PAYMENT_TOKENS = [
  { symbol: "BTC", name: "Bitcoin", decimals: 18, isNative: true },
  { symbol: "MEZO", name: "MEZO", decimals: 18, isNative: false },
  { symbol: "MUSD", name: "MUSD Stablecoin", decimals: 18, isNative: false },
] as const;

// Collection info
export const COLLECTIONS = {
  veBTC: {
    name: "veBTC",
    description: "Vote-escrowed BTC NFTs",
    maxLock: 28 * 24 * 60 * 60, // 28 days
    symbol: "veBTC",
  },
  veMEZO: {
    name: "veMEZO",
    description: "Vote-escrowed MEZO NFTs",
    maxLock: 1456 * 24 * 60 * 60, // 4 years
    symbol: "veMEZO",
  },
} as const;
