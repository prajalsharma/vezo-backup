import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";

const Providers = dynamic(() => import("@/components/Providers"), {
  ssr: false,
});

const ClientLayout = dynamic(() => import("@/components/ClientLayout"), {
  ssr: false,
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // respect iOS safe-area insets (used by the bottom nav)
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
    { media: "(prefers-color-scheme: light)", color: "#F2EFE9" },
  ],
};

export const metadata: Metadata = {
  title: "vezo | veNFT Marketplace",
  description:
    "The premier marketplace for trading veBTC and veMEZO NFTs on Mezo Network. Buy vote-escrowed NFTs at a discount and unlock voting power.",
  keywords: ["Mezo", "veNFT", "veBTC", "veMEZO", "NFT", "marketplace", "DeFi", "voting power", "Vezo"],
  authors: [{ name: "Vezo" }],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Vezo — veNFT Marketplace",
    description: "Trade veBTC and veMEZO NFTs at a discount on Mezo Network",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vezo — veNFT Marketplace",
    description: "Trade veBTC and veMEZO NFTs at a discount on Mezo Network",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint (default: light) — avoids a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('vezo-theme');var d=t==='dark';var c=document.documentElement.classList;c.toggle('dark',d);c.toggle('light',!d);}catch(e){}})();",
          }}
        />
      </head>
      <body
        className={`${outfit.variable} font-sans min-h-[100dvh] antialiased`}
        style={{ background: "var(--bg)", color: "var(--text-1)" }}
      >
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
