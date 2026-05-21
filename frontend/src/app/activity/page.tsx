import dynamic from "next/dynamic";

const ActivityClient = dynamic(() => import("@/components/ActivityClient"), {
  ssr: false,
});

export default function ActivityPage() {
  return <ActivityClient />;
}
