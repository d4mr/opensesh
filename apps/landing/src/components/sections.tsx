import {
  ArrowRightIcon,
  CheckIcon,
  LinkIcon,
  MapPinIcon,
  MinusIcon,
  ReplyIcon,
  SparklesIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { demoHref, DOCS_URL, GITHUB_URL } from "../config";
import { AgendaDemo } from "./demos/agenda-demo";
import { EmbedDemo } from "./demos/embed-demo";
import { FormDemo } from "./demos/form-demo";
import { PortalDemo } from "./demos/portal-demo";
import { ReviewDemo } from "./demos/review-demo";
import { BrandMark, Breakout, ButtonLink, cn, Crosses, GithubIcon, Overline, Reveal } from "./ui";

/* --------------------------------------------------------------- primitives */

/** Cloudflare-style narrow row: a text column with dotted filler gutters
    reaching out to the wide frame rails. */
function Narrow({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[1fr_minmax(0,52rem)_1fr]">
      <div aria-hidden="true" className="dot-band hidden border-r md:block" />
      <div className="min-w-0">{children}</div>
      <div aria-hidden="true" className="dot-band hidden border-l md:block" />
    </div>
  );
}

/** Diagonal-hatch buffer between strongly colored sections. */
export function StripeBand() {
  return <div aria-hidden="true" className="stripe-band h-12 border-b" />;
}

/* ------------------------------------------------------------------ stats */

const stats = [
  { value: "$40,000/yr", label: "what Sessionboard charges for this workflow" },
  { value: "$0", label: "what opensesh costs. MIT-licensed, forever" },
  { value: "1 command", label: "deploys it to your own Cloudflare account" },
];

export function Stats() {
  return (
    <section className="border-b">
      <Narrow>
        <div className="grid divide-y bg-background sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map((stat) => (
            <div key={stat.value} className="px-6 py-8 text-center">
              <p className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </Narrow>
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
      <Narrow>
        <Reveal className="bg-background px-6 py-16 md:py-20">
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
      </Narrow>
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

/* ------------------------------------------------------------------ art band */

export function AgoraBand() {
  return (
    <Breakout>
      <figure className="relative">
        <img
          src="/art/ancient-agora-conference.webp"
          alt="Engraving of a speaker addressing a seated crowd in an ancient Greek agora"
          className="h-[46svh] w-full object-cover object-[center_30%] md:h-[60svh]"
        />
        <div className="dither-down pointer-events-none absolute inset-x-0 top-0 h-40" />
        <div className="dither-down pointer-events-none absolute inset-x-0 bottom-0 h-40 -scale-y-100" />
        <figcaption className="absolute right-6 bottom-6 border bg-white/90 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          The call for speakers, since 400 BC
        </figcaption>
      </figure>
    </Breakout>
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
      <Narrow>
        <Reveal className="bg-background px-6 py-16 md:py-20">
          <Overline>The product</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Everything between "call for papers" and doors open.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The panels below are small working demos, not screenshots. Try them.
          </p>
        </Reveal>
      </Narrow>
      {features.map((feature, index) => (
        <div
          key={feature.id}
          className={cn(
            "grid items-center gap-10 border-t px-6 py-16 md:grid-cols-2 md:gap-16 md:px-10 md:py-20",
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

/* ------------------------------------------------------------------ spotlight */

const spotlightBullets = [
  "Stays in the list — the table collapses beside the panel instead of navigating away",
  "Keyboard-native — j and k walk to the next and previous row, Escape closes",
  "URL-addressable — every detail view is a link you can share",
  "Works on speakers, submissions, content, and files",
];

/** The real thing in motion: a continuously looping capture of the spotlight
    opening, walking rows, and closing — framed on the salon art like the
    other image bands. Muted + playsInline so autoplay is allowed everywhere. */
function SpotlightReel() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Play only while on screen: retries autoplay the browser may have
  // deferred, and stops the loop from burning cycles offscreen.
  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.2 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <Breakout>
      <figure className="relative">
        <img
          src="/art/outdoor-olive-terrace-debate.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="dither-down pointer-events-none absolute inset-x-0 top-0 h-40" />
        <div className="dither-down pointer-events-none absolute inset-x-0 bottom-0 h-40 -scale-y-100" />
        <div className="relative mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
          <Reveal>
            <video
              ref={videoRef}
              src="/spotlight-loop.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="The spotlight in motion: selecting a speaker row opens the detail panel beside the list"
              className="pointer-events-none block w-full rounded-xl border bg-background shadow-2xl select-none"
            />
          </Reveal>
        </div>
        <figcaption className="absolute right-6 bottom-6 border bg-white/90 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          The spotlight, on loop
        </figcaption>
      </figure>
    </Breakout>
  );
}

export function Spotlight() {
  return (
    <section id="spotlight" className="relative border-b">
      <Narrow>
        <Reveal className="bg-background px-6 py-16 md:py-20">
          <Overline>Spotlight</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Look closer without losing your place.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Click any row in any big table — speakers, submissions, content, files — and the list
            collapses to a compact column while a detail panel slides in beside it. Inspect, decide,
            move to the next. You never leave the list.
          </p>
        </Reveal>
      </Narrow>
      <SpotlightReel />
      <Narrow>
        <Reveal className="border-t bg-background px-6 py-16 md:py-20">
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            The selection lives in the URL, so every detail view is deep-linkable. Close the panel
            and your scroll position is exactly where you left it. And if a filter hides the row you
            had open, the panel says so instead of vanishing.
          </p>
          <ul className="mt-5 grid gap-x-10 gap-y-2 sm:grid-cols-2">
            {spotlightBullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        </Reveal>
      </Narrow>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ linear band */

export function LinearBand() {
  return (
    <section className="border-b">
      <Narrow>
        <Reveal className="mx-auto max-w-2xl bg-background px-6 py-16 text-center md:py-24">
          <Overline>The premise</Overline>
          <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            We asked: what if the Linear team decided to make conference program management
            software?
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            The answer is a tool where density is respect for your time. Where every table has a
            keyboard path, state lives in the URL, and you never wonder what just happened — every
            action answers back.
          </p>
          <p className="mt-6 text-[15px] font-semibold text-primary">So we built it.</p>
        </Reveal>
      </Narrow>
    </section>
  );
}

/* ------------------------------------------------------- click with confidence */

const confidenceCards = [
  {
    icon: MapPinIcon,
    title: "Never lose your place",
    body: "Spotlight keeps you in the list, your scroll position survives the trip, and back-navigation restores exactly the view you left.",
  },
  {
    icon: ReplyIcon,
    title: "Every action answers back",
    body: "Saves confirm. Syncs report how many rows changed. Errors say what to do next, not just that something went wrong.",
  },
  {
    icon: LinkIcon,
    title: "The URL is the truth",
    body: "Deep-link any view, filter, or detail. Refresh and nothing is lost. Send the link and a teammate lands exactly where you are.",
  },
];

export function Confidence() {
  return (
    <section className="relative border-b">
      <Narrow>
        <Reveal className="bg-background px-6 py-16 md:py-20">
          <Overline>No dead ends</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Click with confidence.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Most conference tools are mazes: seven tabs deep, breadcrumbs gone, wondering whether
            that last edit saved. opensesh is the opposite. You can click anything, because you
            never lose yourself.
          </p>
        </Reveal>
      </Narrow>
      <div className="grid border-t sm:grid-cols-3">
        {confidenceCards.map((card, index) => (
          <Reveal
            key={card.title}
            delay={index * 60}
            className={cn(
              "border-b p-6 sm:border-r sm:border-b-0",
              index === confidenceCards.length - 1 && "border-b-0 sm:border-r-0",
            )}
          >
            <card.icon className="size-4 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">{card.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{card.body}</p>
          </Reveal>
        ))}
      </div>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------------------------------ mcp */

const mcpBullets = [
  "One URL to connect — OAuth sign-in with a real consent screen, never a pasted API key",
  "Role-scoped tools — organizers drive the whole program, reviewers get exactly their queue",
  "Acts as you, attributed to you — every change lands in the timeline under your name",
  "Blind review stays blind — speaker identities are redacted before the agent sees them",
];

const mcpTranscript: ReadonlyArray<
  | { readonly kind: "user"; readonly text: string }
  | { readonly kind: "tool"; readonly name: string; readonly result: string }
  | { readonly kind: "assistant"; readonly text: string }
> = [
  { kind: "user", text: "Who still owes slides for Thursday?" },
  { kind: "tool", name: "listSessions", result: "14 sessions · 3 missing slides" },
  {
    kind: "assistant",
    text: "Three sessions are missing slides: Taming 40-Minute CI, Docs That Answer Back, and the verification-patterns talk. Want me to nudge the speakers?",
  },
  { kind: "user", text: "Nudge them." },
  { kind: "tool", name: "sendCampaign", result: "3 reminders queued" },
  {
    kind: "assistant",
    text: "Done — three reminders sent. Each one is logged on its session's timeline.",
  },
];

/** Non-interactive transcript mock: an MCP client driving opensesh tools. */
function McpMock() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-lg border bg-background select-none">
      <div className="flex h-9 items-center gap-1.5 border-b bg-paper px-3.5">
        <span className="size-2.5 rounded-full border" />
        <span className="size-2.5 rounded-full border" />
        <span className="size-2.5 rounded-full border" />
        <span className="ml-2 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
          claude.ai
        </span>
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
          <span className="size-1.5 rounded-full bg-status-accepted" />
          connected to opensesh
        </span>
      </div>
      <div className="space-y-3 p-4 md:p-5">
        {mcpTranscript.map((entry, index) =>
          entry.kind === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg bg-paper px-3 py-2 text-[13px]">{entry.text}</p>
            </div>
          ) : entry.kind === "tool" ? (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 font-mono text-[11px]"
            >
              <BrandMark className="size-3.5" />
              <span>{entry.name}</span>
              <span className="ml-auto text-muted-foreground">{entry.result}</span>
            </div>
          ) : (
            <div key={index} className="flex items-start gap-2.5">
              <SparklesIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
              <p className="max-w-[85%] text-[13px] leading-relaxed">{entry.text}</p>
            </div>
          ),
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t bg-paper px-3.5 py-2 font-mono text-[10px] text-muted-foreground">
        <span>acting as Dana Organizer · admin</span>
        <span className="ml-auto hidden sm:inline">granted on the consent screen · revocable</span>
      </div>
    </div>
  );
}

export function Mcp() {
  return (
    <section id="mcp" className="relative border-b">
      <Narrow>
        <Reveal className="bg-background px-6 py-16 md:py-20">
          <Overline>MCP</Overline>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Talk to your program.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            opensesh ships a remote MCP server. Connect Claude — or any MCP client — and ask who
            still owes slides, nudge the stragglers, or work through your review queue in
            conversation. The agent signs in as you, and a consent screen stands between it and your
            program: nothing is granted silently, and it can never do more than your role allows.
          </p>
        </Reveal>
      </Narrow>
      <div className="grid items-center gap-10 border-t px-6 py-16 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 md:px-10 md:py-20">
        <Reveal>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Every REST operation is generated into an MCP tool from the same definitions, so agents
            get the exact surface you do — sessions, submissions, speakers, agenda, reviews. An
            organizer's Claude can run the back office; a reviewer's Claude sees five tools and
            nothing else.
          </p>
          <ul className="mt-5 space-y-2">
            {mcpBullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5 text-sm">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={100}>
          <McpMock />
        </Reveal>
      </div>
      <Crosses />
    </section>
  );
}

/* ------------------------------------------- compare, on the garden image */

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
  { capability: "Remote MCP server — talk to it from Claude", opensesh: true, sessionboard: false },
  { capability: "Full source code, MIT-licensed", opensesh: true, sessionboard: false },
  { capability: "Self-hosted on your own infrastructure", opensesh: true, sessionboard: false },
  { capability: "Your data in your own Postgres database", opensesh: true, sessionboard: false },
];

export function Compare() {
  return (
    <Breakout>
      <section id="compare" className="relative">
        <img
          src="/art/garden-congress.webp"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="dither-down pointer-events-none absolute inset-x-0 top-0 h-40" />
        <div className="dither-down pointer-events-none absolute inset-x-0 bottom-0 h-40 -scale-y-100" />

        <div className="relative mx-auto w-full max-w-3xl px-6 py-24 md:py-32">
          <Reveal className="overflow-hidden rounded-xl border bg-background/95 backdrop-blur-sm">
            <div className="px-6 pt-8 pb-6 text-center">
              <Overline>The comparison</Overline>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Feature for feature. Minus the invoice.
              </h2>
            </div>
            <div className="overflow-x-auto border-t">
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
            </div>
            <p className="border-t px-6 py-3 text-center font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              Per Sessionboard's public product pages and help center, Aug 2026
            </p>
          </Reveal>
        </div>

        <figcaption className="absolute right-6 bottom-6 hidden border bg-white/90 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase md:block">
          Programs are better planned in the open
        </figcaption>
      </section>
    </Breakout>
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
          <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
            It is API-first, too: everything the UI does is exposed over a fully documented REST
            API, from submissions and reviews to agenda publishing — and the same operations are
            served as a remote MCP server for agents. Interactive reference, code samples, and
            response schemas in{" "}
            <a
              href={`${DOCS_URL}/api`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-ink-foreground underline decoration-ink-border underline-offset-4 transition-colors hover:decoration-ink-foreground"
            >
              the docs
            </a>
            .
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
    <section className="px-4 py-14 md:px-10 md:py-16">
      <div className="relative overflow-hidden rounded-2xl bg-primary text-center">
        <div aria-hidden="true" className="dot-band-light absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 py-16 md:py-20">
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Run your next CFP in the open.
          </h2>
          <p className="mt-4 max-w-xl text-balance text-base text-white/80">
            The demo is seeded with a full conference: 32 submissions, 3 tracks, and a half-built
            agenda with one conflict left for you to find.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={demoHref("organizer")} variant="inverse" size="lg">
              Explore the live demo
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href={GITHUB_URL} variant="outline-light" size="lg" external>
              <GithubIcon className="size-4" />
              Star on GitHub
            </ButtonLink>
          </div>
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
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Docs
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
