import type { ReactNode } from "react";
import { Provider } from "@/components/provider";
import "@/styles/globals.css";

export default async function RootElement({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Per-page title/description/OG live in <PageMeta> inside DocPage. */}
        <link rel="icon" type="image/svg+xml" href="/brand/opensesh-mark.svg" />
      </head>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}

export async function getConfig() {
  return {
    render: "static",
  } as const;
}
