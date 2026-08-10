import { ArrowRightIcon, CheckIcon, MinusIcon } from "lucide-react";

import { demoHref, GITHUB_URL } from "../config";
import { AgendaDemo } from "./demos/agenda-demo";
import { EmbedDemo } from "./demos/embed-demo";
import { FormDemo } from "./demos/form-demo";
import { PortalDemo } from "./demos/portal-demo";
import { ReviewDemo } from "./demos/review-demo";
import { BrandMark, Breakout, ButtonLink, cn, Crosses, GithubIcon, Overline, Reveal } from "./ui";

/* ------------------------------------------------------------------ stats */

const stats = [
  { value: "$40,000/yr", label: "what Sessionboard charges for this workflow" },
  { value: "$0", label: "what opensesh costs. MIT-licensed, forever" },
  { value: "1 command", label: "deploys it to your own Cloudflare account" },
];

export function Stats() {
  return (
    <section className="relative border-y bg-paper">
      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stats.map((stat) => (
          <div key={stat.value} className="px-6 py-8 text-center">
            <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ loop */

const loopSteps = [
  { step: "01", name: "Collect", detail: "Publish a call for papers speakers finish in minutes." },
  { step: "02", name: "Review", detail: "Score submissions with your team and decide." },
  { step: "03", name: "Onboard", detail: "Accepted speakers get a portal, not an email thread." },
  { step: "04", name: "Schedule", detail: "Build the agenda and catch conflicts as you drag." },
  { step: "05", name: "Publish", detail: "Embed the schedule on your site with one tag." },
];

export function Loop() {
  return (
    <section id="workflow" className="relative border-b">
      <div className="px-6 py-20 md:px-10 md:py-24">
        <Reveal className="max-w-2xl">
          <Overline>How it works</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Run the whole program in one place.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Accept a talk and the speaker gets their portal. A speaker finishes onboarding and their
            session is ready to schedule. You move a session and your website updates. You never
            copy data between tools again.
          </p>
        </Reveal>
      </div>
      <div className="grid border-t sm:grid-cols-2 md:grid-cols-5">
        {loopSteps.map((item, index) => (
          <Reveal
            key={item.step}
            delay={index * 60}
            className={cn(
              "border-b p-5 sm:border-r md:border-b-0",
              index === loopSteps.length - 1 && "border-b-0 md:border-r-0",
            )}
          >
            <p className="font-mono text-xs text-primary tabular-nums">{item.step}</p>
            <p className="mt-2.5 text-sm font-semibold">{item.name}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.detail}</p>
          </Reveal>
        ))}
      </div>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ features */

const features = [
  {
    id: "collect",
    overline: "Collect",
    title: "A call for papers speakers actually finish.",
    body: "Ask workshops about capacity and panels about panelists without making everyone else scroll past irrelevant fields. Drafts save as speakers type, and every submission lands in the right reviewer's queue by track.",
    bullets: [
      "Conditional questions keep the form short",
      "Submissions route to reviewers by track",
      "Drafts autosave; speakers return by magic link",
      "A review step catches mistakes before submit",
    ],
    demo: <FormDemo />,
  },
  {
    id: "review",
    overline: "Review",
    title: "Decide in an afternoon, not a month of meetings.",
    body: "Reviewers see their track's queue, score one to five, and leave comments. When you accept a talk, opensesh creates the session, opens the speaker's portal, and assigns their onboarding tasks for you.",
    bullets: [
      "Queues scoped to each reviewer's tracks",
      "Scores, comments, and team averages in one view",
      "Accepting a talk starts onboarding automatically",
    ],
    demo: <ReviewDemo />,
  },
  {
    id: "onboard",
    overline: "Onboard",
    title: "Stop chasing speakers over email.",
    body: "Accepted speakers sign in with a magic link. No account setup, no password resets. They upload bios, headshots, and slides themselves, and you watch progress from your dashboard instead of digging through an inbox.",
    bullets: [
      "Magic-link sign-in, nothing for speakers to set up",
      "Bios, headshots, slides, and file requests in one place",
      "See who's done and who needs a nudge",
    ],
    demo: <PortalDemo />,
  },
  {
    id: "schedule",
    overline: "Schedule",
    title: "Catch the double-booking before your attendees do.",
    body: "Drag sessions across rooms and time slots. If a speaker ends up in two rooms at once, or a room gets two sessions in the same slot, you see it immediately, while it's still cheap to fix.",
    bullets: [
      "Day, room, and list views of the same agenda",
      "Speaker and room conflicts flagged as you drag",
      "Accepted but unscheduled sessions wait in a tray",
    ],
    demo: <AgendaDemo />,
  },
  {
    id: "publish",
    overline: "Publish",
    title: "Your schedule on your website, always current.",
    body: "Paste one script tag into your conference site and get a schedule and speaker gallery that match your styling. Move a session in opensesh and the page updates. No PDF exports, no rebuilds, no stale agendas.",
    bullets: [
      "Schedule and speaker gallery widgets",
      "Looks native on your site, works on phones",
      "Updates the moment the agenda changes",
    ],
    demo: <EmbedDemo />,
  },
];

export function Features() {
  return (
    <section id="product" className="relative border-b">
      <div className="border-b px-6 py-20 md:px-10 md:py-24">
        <Reveal className="max-w-2xl">
          <Overline>The product</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Everything between "call for papers" and doors open.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The panels below are small working demos, not screenshots. Try them.
          </p>
        </Reveal>
      </div>
      {features.map((feature, index) => (
        <div
          key={feature.id}
          className={cn(
            "grid items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-16 md:px-10 md:py-20",
            index < features.length - 1 && "border-b",
            index % 2 === 1 && "md:[&>*:first-child]:order-2",
          )}
        >
          <Reveal>
            <Overline>{feature.overline}</Overline>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-[28px] md:leading-snug">
              {feature.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{feature.body}</p>
            <ul className="mt-5 space-y-2">
              {feature.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5 text-sm">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {bullet}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={100}>{feature.demo}</Reveal>
        </div>
      ))}
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ art band */

export function GardenBand() {
  return (
    <Breakout>
      <figure className="relative">
        <img
          src="/art/garden-congress.png"
          alt="Engraving of a large open-air congress in a classical garden"
          className="h-[44svh] w-full object-cover object-center md:h-[56svh]"
        />
        <div className="dither-down pointer-events-none absolute inset-x-0 top-0 h-40" />
        <div className="dither-down pointer-events-none absolute inset-x-0 bottom-0 h-40 -scale-y-100" />
        <figcaption className="absolute right-6 bottom-6 border bg-white/90 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          Programs are better planned in the open
        </figcaption>
      </figure>
    </Breakout>
  );
}

/** Dotted spacer band inside the frame, Vercel/Cloudflare style. */
export function DotBand({ className }: { readonly className?: string }) {
  return <div aria-hidden="true" className={cn("dot-band h-12 border-b", className)} />;
}

/* ------------------------------------------------------------------ compare */

const compareRows: ReadonlyArray<{
  readonly capability: string;
  readonly opensesh: boolean;
  readonly sessionboard: boolean;
}> = [
  { capability: "Custom CFP forms with conditional logic", opensesh: true, sessionboard: true },
  { capability: "Track-routed review and scoring", opensesh: true, sessionboard: true },
  { capability: "Speaker portal and onboarding tasks", opensesh: true, sessionboard: true },
  {
    capability: "Drag-and-drop agenda with conflict detection",
    opensesh: true,
    sessionboard: true,
  },
  { capability: "Embeddable schedule and speaker gallery", opensesh: true, sessionboard: true },
  { capability: "Automated speaker communications", opensesh: true, sessionboard: true },
  { capability: "Full source code, MIT-licensed", opensesh: true, sessionboard: false },
  { capability: "Self-hosted on your own infrastructure", opensesh: true, sessionboard: false },
  { capability: "Your data in your own Postgres database", opensesh: true, sessionboard: false },
];

export function Compare() {
  return (
    <section id="compare" className="relative border-y bg-paper">
      <div className="px-6 py-20 md:px-10 md:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <Overline>The comparison</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Feature for feature. Minus the invoice.
          </h2>
        </Reveal>
        <Reveal
          delay={80}
          className="mx-auto mt-10 max-w-3xl overflow-x-auto rounded-lg border bg-background"
        >
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b bg-paper text-left">
                <th className="px-5 py-3 font-medium">Capability</th>
                <th className="w-28 px-3 py-3 text-center font-semibold">opensesh</th>
                <th className="w-28 px-3 py-3 text-center font-medium text-muted-foreground">
                  Sessionboard
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {compareRows.map((row) => (
                <tr key={row.capability}>
                  <td className="px-5 py-3">{row.capability}</td>
                  <td className="px-3 py-3 text-center">
                    <CheckIcon className="mx-auto size-4 text-primary" aria-label="Included" />
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.sessionboard ? (
                      <CheckIcon
                        className="mx-auto size-4 text-muted-foreground"
                        aria-label="Included"
                      />
                    ) : (
                      <MinusIcon
                        className="mx-auto size-4 text-muted-foreground/50"
                        aria-label="Not included"
                      />
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-paper">
                <td className="px-5 py-3.5 font-semibold">Price per year</td>
                <td className="px-3 py-3.5 text-center font-semibold text-primary tabular-nums">
                  $0
                </td>
                <td className="px-3 py-3.5 text-center font-medium text-muted-foreground tabular-nums">
                  ~$40,000
                </td>
              </tr>
            </tbody>
          </table>
        </Reveal>
        <p className="mt-3 text-center font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          Per Sessionboard's public product pages and help center, Aug 2026
        </p>
      </div>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ open source */

const stack = ["Cloudflare Workers", "Postgres", "Drizzle", "TanStack Start", "Better Auth"];

export function OpenSource() {
  return (
    <section id="open-source" className="relative border-b bg-ink text-ink-foreground">
      <div className="grid items-center gap-12 px-6 py-20 md:grid-cols-2 md:gap-16 md:px-10 md:py-24">
        <Reveal>
          <Overline className="text-[#6bc796]">Open source</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Own the whole stack.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            opensesh is MIT-licensed, end to end. Deploy it to your own Cloudflare account with your
            own Postgres database. Your speakers, submissions, and schedules stay on infrastructure
            you control, under your domain. Fork it, rebrand it, keep it after the conference. There
            is no contract to renew.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {stack.map((item) => (
              <li
                key={item}
                className="rounded-full border border-ink-border px-3 py-1 text-[13px] text-ink-muted"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-ink-muted">
            Built in public for swyx's <span className="text-ink-foreground">Kill My SaaS</span>{" "}
            challenge, August 2026.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-lg border border-ink-border">
            <div className="flex h-9 items-center gap-1.5 border-b border-ink-border px-3.5">
              <span className="size-2.5 rounded-full bg-ink-border" />
              <span className="size-2.5 rounded-full bg-ink-border" />
              <span className="size-2.5 rounded-full bg-ink-border" />
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7 text-ink-foreground">
              <code>
                <span className="text-ink-muted">$</span> git clone{" "}
                {GITHUB_URL.replace("https://", "")}
                {"\n"}
                <span className="text-ink-muted">$</span> pnpm install
                {"\n"}
                <span className="text-ink-muted">$</span> pnpm deploy
                {"\n\n"}
                <span className="text-[#6bc796]">✓</span> Deployed to your Cloudflare account
              </code>
            </pre>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            One command builds the app and runs the database migrations.
          </p>
        </Reveal>
      </div>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ final CTA + footer */

export function FinalCta() {
  return (
    <Breakout>
      <section className="relative overflow-hidden">
        <img
          src="/art/renaissance-salon-full-green-haze.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1] object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-white/45" />
        <div className="dither-down pointer-events-none absolute inset-x-0 top-0 h-40" />
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-24 text-center md:py-28">
          <h2 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Run your next CFP in the open.
          </h2>
          <p className="mt-4 max-w-xl text-balance text-base text-muted-foreground">
            The demo is seeded with a full conference: 32 submissions, 3 tracks, and a half-built
            agenda with one conflict left for you to find.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={demoHref("organizer")} size="lg">
              Explore the live demo
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} variant="outline" size="lg" external>
              <GithubIcon className="size-4" />
              Star on GitHub
            </ButtonLink>
          </div>
        </div>
      </section>
    </Breakout>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:px-10">
        <div className="flex items-center gap-2">
          <BrandMark className="size-4" />
          <span>opensesh, built for the AI Engineer Kill My SaaS challenge, 2026</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a href={demoHref("organizer")} className="transition-colors hover:text-foreground">
            Live demo
          </a>
          <span>MIT license</span>
        </div>
      </div>
    </footer>
  );
}
