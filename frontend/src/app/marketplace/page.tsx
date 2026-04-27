import dynamic from "next/dynamic";

const MarketplaceClient = dynamic(() => import("@/components/MarketplaceClient"), {
  ssr: false,
});

export default function MarketplacePage() {
  return <MarketplaceClient />;
}
