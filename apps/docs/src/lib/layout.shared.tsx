import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Globe } from "lucide-react";
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
    githubUrl: "https://github.com/d4mr/opensesh",
    links: [
      {
        text: "app.opensesh.io",
        url: "https://app.opensesh.io",
        external: true,
      },
      {
        type: "icon",
        text: "opensesh.io",
        icon: <Globe />,
        url: "https://opensesh.io",
        external: true,
      },
    ],
  };
}
