import { useEffect, useRef, useState } from "react";

export function cn(...parts: ReadonlyArray<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent",
  outline: "border bg-background text-foreground hover:bg-paper",
  "outline-dark": "border border-ink-border bg-transparent text-ink-foreground hover:bg-white/5",
  ghost: "border border-transparent text-foreground hover:bg-paper",
  inverse: "bg-white text-primary hover:bg-white/90 border border-transparent",
  "outline-light": "border border-white/40 bg-transparent text-white hover:bg-white/10",
} as const;

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  external = false,
}: {
  readonly href: string;
  readonly variant?: keyof typeof buttonVariants;
  readonly size?: "md" | "lg";
  readonly className?: string;
  readonly children: React.ReactNode;
  readonly external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "pressable inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
        size === "lg" ? "h-11 px-6" : "h-9 px-4",
        buttonVariants[variant],
        className,
      )}
    >
      {children}
    </a>
  );
}

export function Overline({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold tracking-[0.14em] uppercase",
        className ?? "text-primary",
      )}
    >
      {children}
    </p>
  );
}

/** Adds .is-visible when the element first scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // ?noreveal skips the entrance animation — used by screenshot/e2e tooling.
  const [visible, setVisible] = useState(() =>
    new URLSearchParams(window.location.search).has("noreveal"),
  );

  useEffect(() => {
    const element = ref.current;
    if (element === null || visible) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={cn("reveal", visible && "is-visible", className)}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Vercel-style plus markers centered on the rule/rail intersection. */
export function Crosses() {
  return (
    <>
      <CrossMark className="-bottom-[6px] -left-[6.5px]" />
      <CrossMark className="-right-[6.5px] -bottom-[6px]" />
    </>
  );
}

/** Full-viewport breakout inside the framed column, so image bands escape
    the rails and the dither blends straight into the page background. */
export function Breakout({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("relative left-1/2 w-screen -translate-x-1/2", className)}>{children}</div>
  );
}

function CrossMark({ className }: { readonly className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      aria-hidden="true"
      className={cn("pointer-events-none absolute z-10 text-foreground/25 select-none", className)}
    >
      <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function BrandMark({ className }: { readonly className?: string }) {
  return <img src="/brand/logo.svg" alt="" aria-hidden="true" className={className ?? "size-6"} />;
}

export function GithubIcon({ className }: { readonly className?: string }) {
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
