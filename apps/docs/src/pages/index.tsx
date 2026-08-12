import { DocPage } from "@/components/doc-page";

export default function Home() {
  return <DocPage slugs={[]} />;
}

export async function getConfig() {
  return {
    render: "static" as const,
  } as const;
}
