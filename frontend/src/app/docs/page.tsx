import dynamic from "next/dynamic";

const DocsClient = dynamic(() => import("@/components/DocsClient"), {
  ssr: false,
});

export default function DocsPage() {
  return <DocsClient />;
}
