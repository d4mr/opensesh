import { APP_URL, demoHref, GITHUB_URL } from "../config";
import { BrandMark, ButtonLink, GithubIcon } from "./ui";

const links = [
  { label: "Product", href: "#product" },
  { label: "Spotlight", href: "#spotlight" },
  { label: "Workflow", href: "#workflow" },
  { label: "Compare", href: "#compare" },
  { label: "Open source", href: "#open-source" },
];

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-black/5 bg-white/75 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2">
          <BrandMark className="size-6" />
          <span className="text-sm font-semibold tracking-tight">opensesh</span>
        </a>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="pressable grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-paper hover:text-foreground"
          >
            <GithubIcon className="size-4.5" />
          </a>
          <a
            href={`${APP_URL}/login`}
            className="hidden text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Sign in
          </a>
          <ButtonLink href={demoHref("organizer")} size="md">
            Open the demo
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
