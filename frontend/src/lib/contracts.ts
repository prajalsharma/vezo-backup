// Mezo Network Contract Addresses
//
// Token and veNFT addresses are fixed public contracts on Mezo, so they can
// safely fall back to known values. Deployment-specific marketplace addresses
// MUST come from environment variables so a new frontend never silently points
// at an older marketplace deployment.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const getEnvAddress = (key: string, fallback: string): `0x${string}` => {
  const value = process.env[key] || fallback;
  return value as `0x${string}`;
};

const getDeploymentAddress = (key: string): `0x${string}` => {
  return (process.env[key] || ZERO_ADDRESS) as `0x${string}`;
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

    // Marketplace contracts — deployed 2026-05-15 (deployer: 0x03ffb3720214bDB0DB5F5F71b6cE16B008f762d2)
    marketplace:     getEnvAddress("NEXT_PUBLIC_MARKETPLACE_TESTNET",      "0xF18016FbadfA732c58814b6341054484FcDBF26f"),
    adapter:         getEnvAddress("NEXT_PUBLIC_ADAPTER_TESTNET",          "0x526A542F7B2809376391CD7f884Daf4967fFEb14"),
    router:          getEnvAddress("NEXT_PUBLIC_ROUTER_TESTNET",           "0x157ed850E41e0f220549005da8b55bBE2AE32d7D"),
    admin:           getEnvAddress("NEXT_PUBLIC_ADMIN_TESTNET",            "0xdBBc692828866ab0ee8BC8C2e6B7d911F7B89Ed4"),
    // v2 modules — deployed 2026-05-15
    bidding:         getEnvAddress("NEXT_PUBLIC_BIDDING_TESTNET",          "0x779cE3EE7A9eA6B4C717DA229644Cf8168c0d4eF"),
    snapshotStore:   getEnvAddress("NEXT_PUBLIC_SNAPSHOT_STORE_TESTNET",   "0x8131676B5c12C0927cF910dd57c6BC16c7Db1957"),
    oracleHub:       getEnvAddress("NEXT_PUBLIC_ORACLE_HUB_TESTNET",       "0x9C991f037FEDd7a6025aA2e402b8354c044D056c"),
    quoteRouter:     getEnvAddress("NEXT_PUBLIC_QUOTE_ROUTER_TESTNET",     "0x85E881F000DC10Eb53e7d3896DaAC12B9073142F"),
    swapRouter:      getEnvAddress("NEXT_PUBLIC_SWAP_ROUTER_TESTNET",      "0x0F16b6B253B968B8B6fe6554E32453935De22698"),
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

    // Marketplace contracts — env vars take precedence; fallback to known
    // deployment addresses so the old deployment shows listings without
    // requiring a redeploy or env change on the hosting platform.
    marketplace:     getEnvAddress("NEXT_PUBLIC_MARKETPLACE_MAINNET",      "0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570"),
    adapter:         getEnvAddress("NEXT_PUBLIC_ADAPTER_MAINNET",          "0x8EC595099030aB282511c87cAF104E734418Eff5"),
    router:          getEnvAddress("NEXT_PUBLIC_ROUTER_MAINNET",           "0xA4098F23aA2883DA13A714982d89BFB403718fb9"),
    admin:           getEnvAddress("NEXT_PUBLIC_ADMIN_MAINNET",            "0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396"),
    // ── New module addresses (set after mainnet deployment)
    bidding:         getDeploymentAddress("NEXT_PUBLIC_BIDDING_MAINNET"),
    snapshotStore:   getDeploymentAddress("NEXT_PUBLIC_SNAPSHOT_STORE_MAINNET"),
    oracleHub:       getDeploymentAddress("NEXT_PUBLIC_ORACLE_HUB_MAINNET"),
    quoteRouter:     getDeploymentAddress("NEXT_PUBLIC_QUOTE_ROUTER_MAINNET"),
    swapRouter:      getDeploymentAddress("NEXT_PUBLIC_SWAP_ROUTER_MAINNET"),
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
