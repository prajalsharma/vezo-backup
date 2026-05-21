import dynamic from "next/dynamic";

const MyListingsClient = dynamic(() => import("@/components/MyListingsClient"), {
  ssr: false,
});

export default function MyListingsPage() {
  return <MyListingsClient />;
}
