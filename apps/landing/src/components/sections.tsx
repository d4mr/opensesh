import { ArrowRightIcon, CheckIcon, MinusIcon } from "lucide-react";

import { demoHref, GITHUB_URL } from "../config";
import { AgendaDemo } from "./demos/agenda-demo";
import { EmbedDemo } from "./demos/embed-demo";
import { FormDemo } from "./demos/form-demo";
import { PortalDemo } from "./demos/portal-demo";
import { ReviewDemo } from "./demos/review-demo";
import { BrandMark, ButtonLink, cn, Crosses, GithubIcon, Overline, Reveal } from "./ui";

/* ------------------------------------------------------------------ stats */

const stats = [
  { value: "$40,000/yr", label: "what the tool this replaces charges" },
  { value: "$0", label: "what opensesh costs — MIT, forever" },
  { value: "1 command", label: "to deploy on your own Cloudflare" },
];

export function Stats() {
  return (
    <section className="relative border-b bg-paper">
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
  { step: "01", name: "Collect", detail: "A CFP form speakers actually finish." },
  { step: "02", name: "Review", detail: "Scores and decisions, not spreadsheets." },
  { step: "03", name: "Onboard", detail: "Speakers complete their own profiles." },
  { step: "04", name: "Schedule", detail: "Drag until it fits; conflicts get caught." },
  { step: "05", name: "Publish", detail: "One tag embeds it on your site." },
];

export function Loop() {
  return (
    <section id="workflow" className="border-b">
      <div className="px-6 py-20 md:px-10 md:py-24">
        <Reveal className="max-w-2xl">
          <Overline>The workflow</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Five stages. One system. Zero re-keying.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Everything downstream is created by the stage before it: acceptance opens the speaker
            portal, completed profiles feed the agenda, the agenda feeds your public site. No
            exports, no copy-paste, no spreadsheet glue.
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
    </section>
  );
}

/* ------------------------------------------------------------------ features */

const features = [
  {
    id: "collect",
    overline: "Collect",
    title: "Forms that ask the right follow-up.",
    body: "Build your call for speakers with conditional questions — workshops get asked about capacity, panels about panelists, talks about neither. Every submission routes to the right track's reviewers the moment it lands.",
    bullets: [
      "Conditional logic per answer, not per form",
      "Per-track routing to reviewer queues",
      "Autosaved drafts with magic-link return",
      "A public review step before anything submits",
    ],
    demo: <FormDemo />,
  },
  {
    id: "review",
    overline: "Review",
    title: "Decisions, not spreadsheet debates.",
    body: "Reviewers see only their tracks. They score one to five, comment, and decide — and acceptance isn't a status change, it's a trigger: the speaker portal opens, onboarding tasks are assigned, and the session enters the agenda pool.",
    bullets: [
      "Track-scoped queues with team averages",
      "Scores, comments, and one-click decisions",
      "Acceptance auto-creates the session and its tasks",
    ],
    demo: <ReviewDemo />,
  },
  {
    id: "onboard",
    overline: "Onboard",
    title: "Speakers onboard themselves.",
    body: "Accepted speakers get a magic link — no account creation, no password reset tickets. They confirm details, upload bios, headshots, and slides, and their progress shows up on your dashboard without a single chase email.",
    bullets: [
      "Magic-link sign-in, zero accounts to manage",
      "Bios, headshots, slides, and custom file requests",
      "Task progress visible to organizers in real time",
    ],
    demo: <PortalDemo />,
  },
  {
    id: "schedule",
    overline: "Schedule",
    title: "Drag until it fits. We catch what doesn't.",
    body: "Lay out days, rooms, and tracks on a grid. Move a session and conflicts surface the moment they happen — a speaker in two rooms, a track colliding with itself — before your attendees find out at the venue.",
    bullets: [
      "Day, room, and list views over the same data",
      "Speaker, room, and track conflicts flagged live",
      "Unscheduled accepted sessions kept in a tray",
    ],
    demo: <AgendaDemo />,
  },
  {
    id: "publish",
    overline: "Publish",
    title: "Your agenda, on your site, in one tag.",
    body: "Drop a script tag into your conference site and get a mobile-friendly schedule and speaker gallery that restyle to your page. Change the agenda in opensesh and the embed updates — no redeploys, no stale PDFs.",
    bullets: [
      "Schedule and speaker-gallery widgets",
      "Mobile-friendly, styled to inherit your site",
      "Always current — the agenda is the source of truth",
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
            Every screen your program team touches, rebuilt properly.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            These aren't screenshots — each panel below is a working miniature of the real thing.
            Click around.
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
    <figure className="relative border-b">
      <img
        src="/art/garden-congress.png"
        alt="Engraving of a large open-air congress in a classical garden"
        className="h-[38svh] w-full object-cover object-center md:h-[52svh]"
      />
      <div className="dither-down pointer-events-none absolute inset-x-0 top-0 h-40" />
      <div className="dither-down pointer-events-none absolute inset-x-0 bottom-0 h-40 -scale-y-100" />
      <figcaption className="absolute right-4 bottom-4 border bg-white/90 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
        Programs are better planned in the open
      </figcaption>
    </figure>
  );
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
  { capability: "Your data in your own database", opensesh: true, sessionboard: false },
];

export function Compare() {
  return (
    <section id="compare" className="relative border-b bg-paper">
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

const stack = ["Cloudflare Workers", "D1", "TanStack Start", "Drizzle", "Better Auth"];

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
            opensesh is MIT-licensed, end to end. Clone it, deploy it to your own Cloudflare
            account, and your speakers, submissions, and schedules live in your database under your
            domain. Fork it, rebrand it, keep it after the conference — there is no contract to
            renew.
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
            One command builds and ships the app, database migrations included.
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
          The demo is seeded with a full conference — 32 submissions, 3 tracks, a half-built agenda
          with one conflict left for you to find.
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
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:px-10">
        <div className="flex items-center gap-2">
          <BrandMark className="size-4" />
          <span>opensesh — built for the AI Engineer Kill My SaaS challenge, 2026</span>
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
