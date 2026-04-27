// Mezo Network Contract Addresses
//
// Token and veNFT addresses are fixed public contracts on Mezo, so they can
// safely fall back to known values. Deployment-specific marketplace addresses
// are read from environment variables and fall back to the known deployed
// addresses so the UI never silently breaks when env inlining is missed.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const getEnvAddress = (key: string, fallback: string): `0x${string}` => {
  const value = process.env[key] || fallback;
  return value as `0x${string}`;
};

// Same as getEnvAddress but named clearly for deployment contracts.
// A non-zero fallback is provided so isMarketplaceReady stays true even if
// Next.js fails to inline the NEXT_PUBLIC_* var at build time.
const getDeploymentAddress = (key: string, fallback: string): `0x${string}` => {
  return (process.env[key] || fallback) as `0x${string}`;
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

    // Marketplace contracts — env var is preferred; fallback to known deployed
    // addresses so the UI never silently breaks when env inlining is missed.
    marketplace: getDeploymentAddress("NEXT_PUBLIC_MARKETPLACE_TESTNET", "0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570"),
    adapter:     getDeploymentAddress("NEXT_PUBLIC_ADAPTER_TESTNET",     "0x8EC595099030aB282511c87cAF104E734418Eff5"),
    router:      getDeploymentAddress("NEXT_PUBLIC_ROUTER_TESTNET",      "0xA4098F23aA2883DA13A714982d89BFB403718fb9"),
    admin:       getDeploymentAddress("NEXT_PUBLIC_ADMIN_TESTNET",       "0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396"),
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

    // Marketplace contracts — env var is preferred; fallback to known deployed
    // addresses so the UI never silently breaks when env inlining is missed.
    marketplace: getDeploymentAddress("NEXT_PUBLIC_MARKETPLACE_MAINNET", "0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570"),
    adapter:     getDeploymentAddress("NEXT_PUBLIC_ADAPTER_MAINNET",     "0x8EC595099030aB282511c87cAF104E734418Eff5"),
    router:      getDeploymentAddress("NEXT_PUBLIC_ROUTER_MAINNET",      "0xA4098F23aA2883DA13A714982d89BFB403718fb9"),
    admin:       getDeploymentAddress("NEXT_PUBLIC_ADMIN_MAINNET",       "0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396"),
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
    contracts.marketplace !== ZERO_ADDRESS
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
