import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";

import { DemoRoleSwitcher } from "@/components/app/demo-role-switcher";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async () => {
    // Documents must revalidate on every load: without this, browsers
    // heuristically cache the HTML shell and keep referencing deleted asset
    // hashes after a deploy. Hashed assets stay immutable-cached.
    if (typeof window === "undefined") {
      const { setResponseHeader } = await import("@tanstack/react-start/server");
      setResponseHeader("Cache-Control", "no-cache");
    }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "opensesh",
      },
      {
        name: "description",
        content: "Conference programs from call for proposals through publish.",
      },
      {
        property: "og:image",
        content: "/brand/og.png",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/brand/opensesh-mark.svg",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <DemoRoleSwitcher />
          <Toaster />
        </ThemeProvider>

        <Scripts />
      </body>
    </html>
  );
}
