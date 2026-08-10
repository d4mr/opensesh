import { ArrowRightIcon } from "lucide-react";

import { demoHref, GITHUB_URL } from "../config";
import { ButtonLink, GithubIcon, Overline } from "./ui";

export function Hero() {
  return (
    <section id="top" className="relative">
      <div className="relative overflow-hidden">
        {/* Full-bleed haze wash behind the headline. */}
        <img
          src="/art/renaissance-salon-full-green-haze.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/55 to-white" />

        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center px-6 pt-36 pb-16 text-center md:pt-44 md:pb-20">
          <Overline>Open-source conference program management</Overline>
          <h1 className="mt-4 text-balance text-5xl font-semibold tracking-tight md:text-7xl">
            The <em className="font-display font-normal italic text-primary">open</em> program OS
            for conferences.
          </h1>
          <p className="mt-5 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground md:text-lg">
            opensesh runs your call for papers, review, speaker onboarding, agenda, and published
            schedule — the workflow conference teams pay $40,000 a year for, rebuilt in the open and
            deployed to your own Cloudflare account in one command.
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

      {/* Full-bleed foreground piece, edge to edge, blended into the page. */}
      <figure className="relative">
        <img
          src="/art/ancient-agora-conference.png"
          alt="Engraving of a speaker addressing a seated crowd in an ancient Greek agora"
          className="h-[46svh] w-full object-cover object-[center_30%] md:h-[62svh] [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]"
        />
        <figcaption className="absolute right-6 bottom-6 rounded-md bg-white/80 px-2.5 py-1 font-display text-sm italic text-foreground/80 backdrop-blur-sm">
          The call for speakers, as practiced since 400 BC.
        </figcaption>
      </figure>
    </section>
  );
}
