import type { DemoPersonaEmail } from "@opensesh/domain/server/schema/auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  CodeIcon,
  ListChecksIcon,
  MailIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Button } from "@/components/ui/button";
import { getDemoMode, switchDemoPersona } from "@/server-fns/auth";

// Update once the contest repo is public.
const GITHUB_URL = "https://github.com/deformercr/opensesh";

function GithubIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className ?? "size-4"}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.54-.01 2.77-.01 3.15 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

const loopSteps = [
  {
    step: "01",
    name: "Collect",
    detail: "Custom CFP forms with conditional questions and per-track routing.",
  },
  {
    step: "02",
    name: "Review",
    detail: "Track-scoped reviewer queues with scores, comments, and decisions.",
  },
  {
    step: "03",
    name: "Onboard",
    detail: "Accepted speakers land in a portal with bios, files, and tasks.",
  },
  {
    step: "04",
    name: "Schedule",
    detail: "Drag sessions across rooms and tracks with live conflict detection.",
  },
  {
    step: "05",
    name: "Publish",
    detail: "Embeddable schedule and speaker gallery for your conference site.",
  },
];

const features = [
  {
    icon: ListChecksIcon,
    title: "Custom CFP forms",
    detail:
      "Conditional logic, per-track routing, autosaved drafts, and a public review step before anything is submitted.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Review & scoring",
    detail:
      "Reviewers see only their tracks. Score, comment, and decide — acceptance kicks off speaker onboarding automatically.",
  },
  {
    icon: UsersIcon,
    title: "Speaker portal",
    detail:
      "Magic-link sign-in for bios, headshots, slides, and onboarding tasks. Speakers never create an account.",
  },
  {
    icon: CalendarDaysIcon,
    title: "Agenda builder",
    detail:
      "Day, room, and list views. Conflicts across rooms, tracks, and speakers are flagged the moment they happen.",
  },
  {
    icon: MailIcon,
    title: "Automated comms",
    detail:
      "Confirmations, reminders, and calendar invites that work with Gmail, Outlook, and iCal.",
  },
  {
    icon: CodeIcon,
    title: "Embeddable widgets",
    detail:
      "Mobile-friendly schedule and speaker gallery you can drop into any site with one embed snippet.",
  },
];

const personas = [
  { email: "demo@opensesh.io", label: "organizer" },
  { email: "reviewer@opensesh.io", label: "reviewer" },
  { email: "maya.chen@retrievallabs.ai", label: "speaker" },
] satisfies ReadonlyArray<{ readonly email: DemoPersonaEmail; readonly label: string }>;

function useDemoEntry() {
  const demoMode = useQuery({ queryKey: ["demo-mode"], queryFn: () => getDemoMode() });
  const [entering, setEntering] = useState(false);
  // The demo-mode query streams into the cache during SSR, so gating on it
  // directly would make the first client render diverge from the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const enter = async (email: DemoPersonaEmail) => {
    setEntering(true);
    const result = await switchDemoPersona({ data: { email } });
    if (result.ok) {
      window.location.assign(result.data.target);
      return;
    }
    setEntering(false);
  };

  return { demoOn: mounted && demoMode.data === true, entering, enter };
}

export function LandingPage() {
  const { demoOn, entering, enter } = useDemoEntry();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <section className="relative overflow-hidden">
        <img
          src="/art/renaissance-salon-full-green-haze.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top opacity-70 dark:opacity-10"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/55 to-background" />

        <header className="relative mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <BrandMark className="size-6" />
            <span className="text-sm font-semibold tracking-tight">opensesh</span>
          </div>
          <nav className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <GithubIcon />
                GitHub
              </a>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </nav>
        </header>

        <div className="wizard-fields relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-16 text-center md:pt-24">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Open-source conference program management
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
            The <em className="font-display font-normal italic">open</em> program OS for
            conferences.
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            Call for papers, structured review, speaker onboarding, agenda building, and embeddable
            schedules — the complete Sessionboard workflow, open source and yours to run.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {demoOn ? (
              <Button
                size="lg"
                className="pressable"
                disabled={entering}
                onClick={() => void enter("demo@opensesh.io")}
              >
                {entering ? "Opening the demo…" : "Explore the live demo"}
                <ArrowRightIcon />
              </Button>
            ) : (
              <Button size="lg" className="pressable" asChild>
                <Link to="/login">
                  Explore the live demo
                  <ArrowRightIcon />
                </Link>
              </Button>
            )}
            <Button size="lg" variant="outline" className="pressable" asChild>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <GithubIcon />
                View source
              </a>
            </Button>
          </div>
          {demoOn ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Or jump straight in as{" "}
              {personas.map((persona, index) => (
                <span key={persona.email}>
                  {index > 0 ? (index === personas.length - 1 ? ", or " : ", ") : null}
                  <button
                    type="button"
                    className="pressable underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
                    disabled={entering}
                    onClick={() => void enter(persona.email)}
                  >
                    {persona.label}
                  </button>
                </span>
              ))}
              .
            </p>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              MIT licensed · Runs on Cloudflare · No $40,000-a-year contract
            </p>
          )}
        </div>

        <figure className="wizard-step relative mx-auto mt-12 w-full max-w-5xl px-6 md:mt-16">
          <div className="overflow-hidden rounded-xl border bg-card p-1.5">
            <img
              src="/art/ancient-agora-conference.png"
              alt="Engraving of a speaker addressing a seated audience in an ancient Greek agora"
              className="w-full rounded-lg"
            />
          </div>
          <figcaption className="mt-3 text-center font-display text-sm italic text-muted-foreground">
            The call for speakers, as practiced since 400 BC.
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          The connected loop
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          One workflow from proposal to published agenda.
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Every stage feeds the next — no exports, no re-keying, no spreadsheet in the middle.
        </p>
        <div className="mt-8 grid overflow-hidden rounded-lg border sm:grid-cols-2 md:grid-cols-5">
          {loopSteps.map((item) => (
            <div key={item.step} className="border-b p-4 last:border-b-0 sm:border-r md:border-b-0">
              <p className="font-mono text-xs text-muted-foreground tabular-nums">{item.step}</p>
              <p className="mt-2 text-sm font-medium">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            What's inside
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Everything the $40k tool does. Nothing it locks away.
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="bg-background p-5">
                <feature.icon className="size-4 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium">{feature.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Open by default
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Own your program.</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              opensesh is MIT-licensed and deploys to your own Cloudflare account in one command.
              Your speakers, submissions, and schedules live in your database — not behind an annual
              contract.
            </p>
            <dl className="mt-6 divide-y rounded-lg border">
              <div className="grid gap-0.5 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-0">
                <dt className="text-xs text-muted-foreground">Deploy</dt>
                <dd className="text-sm">One command to Cloudflare Workers + D1</dd>
              </div>
              <div className="grid gap-0.5 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-0">
                <dt className="text-xs text-muted-foreground">License</dt>
                <dd className="text-sm">MIT — fork it, rebrand it, keep it forever</dd>
              </div>
              <div className="grid gap-0.5 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-0">
                <dt className="text-xs text-muted-foreground">Origin</dt>
                <dd className="text-sm">Built in public for swyx's Kill My SaaS challenge</dd>
              </div>
            </dl>
          </div>
          <figure>
            <div className="overflow-hidden rounded-xl border bg-card p-1.5">
              <img
                src="/art/garden-congress.png"
                alt="Engraving of a large open-air congress in a classical garden"
                className="w-full rounded-lg"
              />
            </div>
            <figcaption className="mt-3 text-center font-display text-sm italic text-muted-foreground">
              Programs are better planned in the open.
            </figcaption>
          </figure>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BrandMark className="size-4" />
            <span>opensesh — built for the AI Engineer Kill My SaaS challenge</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
