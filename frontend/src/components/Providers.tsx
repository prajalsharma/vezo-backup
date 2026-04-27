"use client";

import { RainbowKitProvider, darkTheme, Theme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config, mezoTestnet, mezoMainnet, PassportProvider } from "@/lib/wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";

// Custom Mezo theme for RainbowKit
const mezoTheme: Theme = {
  ...darkTheme({
    accentColor: "#F7931A",
    accentColorForeground: "black",
    borderRadius: "large",
    fontStack: "system",
    overlayBlur: "small",
  }),
  colors: {
    ...darkTheme().colors,
    accentColor: "#F7931A",
    accentColorForeground: "#000000",
    actionButtonBorder: "rgba(255, 255, 255, 0.1)",
    actionButtonBorderMobile: "rgba(255, 255, 255, 0.1)",
    actionButtonSecondaryBackground: "rgba(255, 255, 255, 0.05)",
    closeButton: "rgba(255, 255, 255, 0.6)",
    closeButtonBackground: "rgba(255, 255, 255, 0.1)",
    connectButtonBackground: "rgba(255, 255, 255, 0.05)",
    connectButtonBackgroundError: "#FF6B6B",
    connectButtonInnerBackground: "linear-gradient(135deg, #F7931A 0%, #D97706 100%)",
    connectButtonText: "#FFFFFF",
    connectButtonTextError: "#FFFFFF",
    connectionIndicator: "#22C55E",
    downloadBottomCardBackground: "linear-gradient(135deg, rgba(247, 147, 26, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
    downloadTopCardBackground: "linear-gradient(135deg, #F7931A 0%, #D97706 100%)",
    error: "#FF6B6B",
    generalBorder: "rgba(255, 255, 255, 0.1)",
    generalBorderDim: "rgba(255, 255, 255, 0.05)",
    menuItemBackground: "rgba(255, 255, 255, 0.05)",
    modalBackdrop: "rgba(0, 0, 0, 0.7)",
    modalBackground: "rgba(26, 26, 35, 0.95)",
    modalBorder: "rgba(255, 255, 255, 0.1)",
    modalText: "#FFFFFF",
    modalTextDim: "rgba(255, 255, 255, 0.6)",
    modalTextSecondary: "rgba(255, 255, 255, 0.5)",
    profileAction: "rgba(255, 255, 255, 0.05)",
    profileActionHover: "rgba(255, 255, 255, 0.1)",
    profileForeground: "rgba(26, 26, 35, 0.95)",
    selectedOptionBorder: "rgba(247, 147, 26, 0.5)",
    standby: "#F7931A",
  },
  fonts: {
    body: "Inter, system-ui, sans-serif",
  },
  radii: {
    actionButton: "12px",
    connectButton: "12px",
    menuButton: "12px",
    modal: "20px",
    modalMobile: "20px",
  },
  shadows: {
    connectButton: "0 4px 12px rgba(247, 147, 26, 0.15)",
    dialog: "0 8px 32px rgba(0, 0, 0, 0.4)",
    profileDetailsAction: "0 2px 6px rgba(0, 0, 0, 0.2)",
    selectedOption: "0 0 0 2px rgba(247, 147, 26, 0.3)",
    selectedWallet: "0 0 0 2px rgba(247, 147, 26, 0.3)",
    walletLogo: "0 2px 8px rgba(0, 0, 0, 0.3)",
  },
};

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  if (!config) return <>{children}</>;

  const passportEnvironment =
    process.env.NEXT_PUBLIC_PASSPORT_ENV === "mainnet" ? "mainnet" : "testnet";

  return (
    <PassportProvider environment={passportEnvironment}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={mezoTheme}
            modalSize="compact"
            showRecentTransactions={true}
            initialChain={mezoMainnet}
            appInfo={{
              appName: "Vezo Exchange",
              learnMoreUrl: "https://mezo.org",
            }}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </PassportProvider>
  );
}
