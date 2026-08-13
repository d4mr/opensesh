// @jsxRuntime automatic
// @jsxImportSource react
import { Cta, EmailLayout, Freeform } from "../src/components/layout";

export interface OutreachProps {
  readonly eventName: string;
  readonly logoUrl?: string | null;
  /** The resolved campaign subject doubles as the headline. */
  readonly heading: string;
  /** Organizer-authored freeform markdown, pre-rendered by the caller. */
  readonly bodyHtml: string;
  readonly cta?: { readonly label: string; readonly url: string };
}

// General outreach from the communications surface: the organizer writes the
// whole message, the template contributes only the event's brand frame.
export default function Outreach({
  eventName,
  logoUrl = null,
  heading,
  bodyHtml,
  cta,
}: OutreachProps) {
  return (
    <EmailLayout brandName={eventName} logoUrl={logoUrl} heading={heading} preview={heading}>
      <Freeform html={bodyHtml} />
      {cta === undefined ? null : <Cta href={cta.url}>{cta.label}</Cta>}
    </EmailLayout>
  );
}

Outreach.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
  heading: "Speaker dinner on Thursday",
  bodyHtml:
    '<p>Hi Maya,</p>\n<p>We are hosting a <strong>speaker dinner</strong> the night before the event — rooftop at the venue, 7 PM. Partners welcome.</p>\n<ul>\n<li>RSVP by Friday</li>\n<li>Dietary preferences via your portal profile</li>\n</ul>\n<p>Details and directions: <a href="https://app.opensesh.io/portal">app.opensesh.io/portal</a></p>',
  cta: { label: "Open your portal", url: "https://app.opensesh.io/portal" },
} satisfies OutreachProps;
