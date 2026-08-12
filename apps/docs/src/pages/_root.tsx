import type { ReactNode } from "react";
import { Provider } from "@/components/provider";
import "@/styles/globals.css";

export default async function RootElement({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/brand/opensesh-mark.svg" />
        <meta
          name="description"
          content="Documentation for opensesh — the open program OS for conferences. Call for papers, review, agenda, speakers, and embeds, self-hosted on Cloudflare Workers."
        />
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
