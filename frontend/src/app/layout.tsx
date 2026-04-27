import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import dynamic from "next/dynamic";
const Providers = dynamic(() => import("@/components/Providers"), {
  ssr: false,
});

const ClientLayout = dynamic(() => import("@/components/ClientLayout"), {
  ssr: false,
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Vezo Exchange | Trade Vote-Escrowed NFTs",
  description:
    "The premier marketplace for trading veBTC and veMEZO NFTs on Mezo Network. Buy vote-escrowed NFTs at a discount and unlock voting power.",
  keywords: ["Mezo", "veNFT", "veBTC", "veMEZO", "NFT", "marketplace", "DeFi", "voting power", "Vezo Exchange"],
  authors: [{ name: "Vezo Exchange" }],
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Vezo Exchange",
    description: "Trade veBTC and veMEZO NFTs at a discount on Mezo Network",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vezo Exchange",
    description: "Trade veBTC and veMEZO NFTs at a discount on Mezo Network",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans bg-mezo-dark text-white min-h-screen antialiased`}
      >
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
