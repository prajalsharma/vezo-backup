import {
  getConfig,
  getDefaultWallets,
  mezoMainnet,
  mezoTestnet,
  PassportProvider
} from "@mezo-org/passport";
import { http } from "wagmi";
import {
  metaMaskWallet,
  okxWallet,
  injectedWallet,
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";

export { mezoMainnet, mezoTestnet, PassportProvider };

// WalletConnect Project ID is required for RainbowKit v2.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "your_walletconnect_project_id";

// Custom wallet list:
// - "Bitcoin" group keeps the BTC-side passport wallets (Unisat, OKX-BTC, Xverse)
//   for users who want to connect via the Mezo Passport bridge.
// - "EVM Wallets" group uses standard RainbowKit EVM connectors.
//   OKX is placed here as an EVM wallet so it connects to the EVM side,
//   not the Bitcoin side, fixing the bc1p... address issue.
function buildWallets(network: "mainnet" | "testnet") {
  const btcWallets = getDefaultWallets(network);
  return [
    // Keep the Bitcoin group wallets from passport
    ...btcWallets,
    {
      groupName: "EVM Wallets",
      wallets: [
        metaMaskWallet,
        okxWallet,           // EVM OKX — connects to EVM, not BTC
        coinbaseWallet,
        rainbowWallet,
        injectedWallet,
      ],
    },
  ];
}

export const config = typeof window !== "undefined" ? getConfig({
  appName: "Vezo Exchange",
  walletConnectProjectId: projectId,
  // Default to mainnet so the UI shows live data on first load.
  mezoNetwork: "mainnet",
  chains: [mezoMainnet, mezoTestnet],
  // Inject custom wallet list so OKX appears as an EVM wallet
  wallets: buildWallets("mainnet"),
  transports: {
    // Use the validationcloud endpoint as the primary — it supports larger log ranges
    [mezoMainnet.id]: http(
      process.env.NEXT_PUBLIC_RPC_MAINNET ||
        "https://mainnet.mezo.public.validationcloud.io"
    ),
    [mezoTestnet.id]: http(
      process.env.NEXT_PUBLIC_RPC_TESTNET || "https://rpc.test.mezo.org"
    ),
  },
  ssr: false,
}) : null;

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
