import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img src="/brand/opensesh-mark.svg" alt="" className="size-5" />
          {appName}
        </>
      ),
    },
    links: [
      {
        text: "app.opensesh.io",
        url: "https://app.opensesh.io",
        external: true,
      },
    ],
  };
}
