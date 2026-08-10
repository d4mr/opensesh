import { ArrowRightIcon } from "lucide-react";

import { demoHref, GITHUB_URL } from "../config";
import { Breakout, ButtonLink, GithubIcon, Overline } from "./ui";

export function Hero() {
  return (
    <section id="top">
      {/* Fat row: the salon haze is the hero visual, full-bleed behind the
          headline, dither-blended into the page at its base. */}
      <Breakout>
        <div className="relative">
          <img
            src="/art/renaissance-salon-full-green-haze.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-white/40" />
          <div className="dither-down pointer-events-none absolute inset-x-0 bottom-0 h-40 -scale-y-100" />

          <div className="relative mx-auto flex min-h-[78svh] w-full max-w-4xl flex-col items-center justify-center px-6 pt-24 pb-20 text-center">
            <Overline>Open-source conference program management</Overline>
            <h1 className="mt-4 text-balance text-5xl font-semibold tracking-tight md:text-7xl">
              The <span className="text-primary">open</span> program OS for conferences.
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
              Call for papers, review, speaker onboarding, and the published agenda in one place.
              It's the workflow conference teams pay $40,000 a year for, free and open source,
              running on your own infrastructure.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href={demoHref("organizer")} size="lg">
                Explore the live demo
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href={GITHUB_URL} variant="outline" size="lg" external>
                <GithubIcon className="size-4" />
                View source
              </ButtonLink>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              No signup. Jump in as{" "}
              <a
                href={demoHref("organizer")}
                className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                organizer
              </a>
              ,{" "}
              <a
                href={demoHref("reviewer")}
                className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                reviewer
              </a>
              , or{" "}
              <a
                href={demoHref("speaker")}
                className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
              >
                speaker
              </a>
              .
            </p>
          </div>
        </div>
      </Breakout>
    </section>
  );
}
