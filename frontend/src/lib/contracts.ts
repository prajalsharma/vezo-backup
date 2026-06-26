// Mezo Network Contract Addresses
//
// All addresses below are public on-chain contracts — not secrets.
// Env vars take precedence so custom deployments can override, but the
// hardcoded fallbacks mean the app works with zero env configuration.

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const addr = (key: string, fallback: string): `0x${string}` => {
  const value = process.env[key] || fallback;
  return value as `0x${string}`;
};

export const CONTRACTS = {
  testnet: {
    chainId: 31611,
    rpcUrl: "https://rpc.test.mezo.org",
    explorer: "https://explorer.test.mezo.org",

    BTC:  addr("NEXT_PUBLIC_BTC_ADDRESS",  "0x7b7c000000000000000000000000000000000000"),
    MEZO: addr("NEXT_PUBLIC_MEZO_ADDRESS", "0x7b7c000000000000000000000000000000000001"),
    MUSD: addr("NEXT_PUBLIC_MUSD_TESTNET", "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"),

    veBTC:  addr("NEXT_PUBLIC_VEBTC_TESTNET",  "0x38E35d92E6Bfc6787272A62345856B13eA12130a"),
    veMEZO: addr("NEXT_PUBLIC_VEMEZO_TESTNET", "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b"),

    marketplace:   addr("NEXT_PUBLIC_MARKETPLACE_TESTNET",    "0xF18016FbadfA732c58814b6341054484FcDBF26f"),
    adapter:       addr("NEXT_PUBLIC_ADAPTER_TESTNET",        "0x526A542F7B2809376391CD7f884Daf4967fFEb14"),
    router:        addr("NEXT_PUBLIC_ROUTER_TESTNET",         "0x157ed850E41e0f220549005da8b55bBE2AE32d7D"),
    admin:         addr("NEXT_PUBLIC_ADMIN_TESTNET",          "0xdBBc692828866ab0ee8BC8C2e6B7d911F7B89Ed4"),
    bidding:       addr("NEXT_PUBLIC_BIDDING_TESTNET",        "0x779cE3EE7A9eA6B4C717DA229644Cf8168c0d4eF"),
    snapshotStore: addr("NEXT_PUBLIC_SNAPSHOT_STORE_TESTNET", "0x8131676B5c12C0927cF910dd57c6BC16c7Db1957"),
    oracleHub:     addr("NEXT_PUBLIC_ORACLE_HUB_TESTNET",     "0x9C991f037FEDd7a6025aA2e402b8354c044D056c"),
    quoteRouter:   addr("NEXT_PUBLIC_QUOTE_ROUTER_TESTNET",   "0x85E881F000DC10Eb53e7d3896DaAC12B9073142F"),
    swapRouter:    addr("NEXT_PUBLIC_SWAP_ROUTER_TESTNET",    "0x0F16b6B253B968B8B6fe6554E32453935De22698"),
    // SwapPaymentRouter (pay-with-any-token via DEX + buyNFT). Not yet deployed;
    // set NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_TESTNET after deploy to enable the swap UI.
    swapPaymentRouter: addr("NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_TESTNET", ZERO_ADDRESS),
  },
  mainnet: {
    chainId: 31612,
    rpcUrl: "https://mainnet.mezo.public.validationcloud.io",
    explorer: "https://explorer.mezo.org",

    BTC:  addr("NEXT_PUBLIC_BTC_ADDRESS",  "0x7b7c000000000000000000000000000000000000"),
    MEZO: addr("NEXT_PUBLIC_MEZO_ADDRESS", "0x7b7c000000000000000000000000000000000001"),
    MUSD: addr("NEXT_PUBLIC_MUSD_MAINNET", "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186"),

    veBTC:  addr("NEXT_PUBLIC_VEBTC_MAINNET",  "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279"),
    veMEZO: addr("NEXT_PUBLIC_VEMEZO_MAINNET", "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122"),

    marketplace:   addr("NEXT_PUBLIC_MARKETPLACE_MAINNET",    "0x293ba099c5Cf32af54013F00fEe8D2EA1cad8570"),
    adapter:       addr("NEXT_PUBLIC_ADAPTER_MAINNET",        "0x8EC595099030aB282511c87cAF104E734418Eff5"),
    router:        addr("NEXT_PUBLIC_ROUTER_MAINNET",         "0xA4098F23aA2883DA13A714982d89BFB403718fb9"),
    admin:         addr("NEXT_PUBLIC_ADMIN_MAINNET",          "0x5bBc2d83D0786Bf2Bc56096d832e6B7cfcca9396"),
    bidding:       addr("NEXT_PUBLIC_BIDDING_MAINNET",        "0xB61Ff06218D9784D71072ebc6921C682751cba3C"),
    snapshotStore: addr("NEXT_PUBLIC_SNAPSHOT_STORE_MAINNET", "0xffCE94434A5b4b0C21a66C0E0183345452AA5424"),
    oracleHub:     addr("NEXT_PUBLIC_ORACLE_HUB_MAINNET",     "0x8bE4D741353b0B7724153B25F772a595bDA2C588"),
    quoteRouter:   addr("NEXT_PUBLIC_QUOTE_ROUTER_MAINNET",   "0x7ED3d6793273f434851385854d2779d20c90b3A5"),
    swapRouter:    addr("NEXT_PUBLIC_SWAP_ROUTER_MAINNET",    "0x83a9F46C084184ae8f3B4eB4265FB081823E5013"),
    // SwapPaymentRouter (pay-with-any-token via DEX + buyNFT). Not yet deployed;
    // set NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_MAINNET after deploy to enable the swap UI.
    swapPaymentRouter: addr("NEXT_PUBLIC_SWAP_PAYMENT_ROUTER_MAINNET", ZERO_ADDRESS),
  },
} as const;

export type NetworkType = "testnet" | "mainnet";

export function getContracts(network: NetworkType) {
  return CONTRACTS[network];
}

export function isMarketplaceDeployed(network: NetworkType): boolean {
  return getContracts(network).marketplace !== ZERO_ADDRESS;
}

export const PAYMENT_TOKENS = [
  { symbol: "BTC",  name: "Bitcoin",          decimals: 18, isNative: true  },
  { symbol: "MEZO", name: "MEZO",             decimals: 18, isNative: false },
  { symbol: "MUSD", name: "MUSD Stablecoin",  decimals: 18, isNative: false },
] as const;

export const COLLECTIONS = {
  veBTC: {
    name: "veBTC",
    description: "Vote-escrowed BTC NFTs",
    maxLock: 28 * 24 * 60 * 60,
    symbol: "veBTC",
  },
  veMEZO: {
    name: "veMEZO",
    description: "Vote-escrowed MEZO NFTs",
    maxLock: 1456 * 24 * 60 * 60,
    symbol: "veMEZO",
  },
} as const;
