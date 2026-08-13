// @jsxRuntime automatic
// @jsxImportSource react
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";
import type { CSSProperties, ReactNode } from "react";

export const palette = {
  ink: "#16211b",
  body: "#3d463f",
  muted: "#6b736c",
  fill: "#f4f5f2",
  divider: "#e7eae5",
  brand: "#176b4d",
} as const;

// Raster mark: Gmail strips SVG images, so account mail points at the
// pre-rendered PNG of the brand mark.
const OPENSESH_MARK = "https://app.opensesh.io/brand/email-logo.png";

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const paragraph: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "14px",
  lineHeight: "24px",
  color: palette.body,
};

const button: CSSProperties = {
  display: "inline-block",
  backgroundColor: palette.brand,
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "1",
  padding: "11px 16px",
  textDecoration: "none",
};

export function Cta({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button href={href} style={button}>
        {children}
      </Button>
    </Section>
  );
}

const fill: CSSProperties = {
  margin: "8px 0 24px",
  backgroundColor: palette.fill,
  borderRadius: "8px",
  padding: "16px",
};

export function NoteCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Section style={fill}>
      <Text style={{ margin: "0", fontSize: "13px", fontWeight: 600, color: palette.ink }}>
        {title}
      </Text>
      <Text
        style={{
          margin: "6px 0 0",
          fontSize: "14px",
          lineHeight: "22px",
          color: palette.body,
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export function DetailCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Section style={fill}>
      <Text style={{ margin: "0", fontSize: "14px", fontWeight: 600, color: palette.ink }}>
        {title}
      </Text>
      <Text
        style={{ margin: "6px 0 0", fontSize: "14px", lineHeight: "22px", color: palette.muted }}
      >
        {children}
      </Text>
    </Section>
  );
}

/**
 * Organizer-authored markdown, pre-rendered to HTML by the caller through
 * domain's hardened renderer — safe to inline unescaped.
 */
export function Freeform({ html }: { readonly html: string }) {
  return (
    <div
      className="freeform"
      style={{ fontSize: "14px", lineHeight: "24px", color: palette.body }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function EmailLayout({
  brandName,
  logoUrl = null,
  heading,
  preview,
  children,
}: {
  /** Event name for event mail, organization name or "opensesh" for account mail. */
  readonly brandName: string;
  /**
   * Event comms carry the event's logo; account mail (sign-in, workspace
   * invitations) omits it and gets the opensesh mark instead.
   */
  readonly logoUrl?: string | null;
  readonly heading: string;
  readonly preview: string;
  readonly children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head>
        {/* Typography for organizer-authored markdown fragments (.freeform).
            Inline styles can't reach rendered child tags; Gmail and every
            major client honor head styles, and clients that strip them still
            show readable default margins. */}
        <style>{`
          .freeform p { margin: 0 0 16px; }
          .freeform p:last-child { margin-bottom: 0; }
          .freeform ul, .freeform ol { margin: 0 0 16px; padding-left: 20px; }
          .freeform li { margin: 0 0 6px; }
          .freeform a { color: ${palette.brand}; }
          .freeform h1, .freeform h2, .freeform h3, .freeform h4 { font-size: 15px; font-weight: 600; margin: 20px 0 8px; color: ${palette.ink}; }
          .freeform blockquote { margin: 0 0 16px; padding: 2px 0 2px 12px; border-left: 2px solid ${palette.divider}; color: ${palette.muted}; }
          .freeform code { font-size: 13px; background: ${palette.fill}; padding: 1px 4px; border-radius: 4px; }
          .freeform hr { margin: 20px 0; border: none; border-top: 1px solid ${palette.divider}; }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: "0", backgroundColor: "#ffffff", fontFamily }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "48px 24px 40px" }}>
          <Img
            src={logoUrl ?? OPENSESH_MARK}
            alt={brandName}
            width="40"
            height="40"
            style={{
              display: "block",
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              objectFit: "cover",
            }}
          />
          <Heading
            as="h1"
            style={{
              margin: "28px 0 12px",
              fontSize: "20px",
              lineHeight: "28px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: palette.ink,
            }}
          >
            {heading}
          </Heading>
          {children}
          <Hr
            style={{
              margin: "32px 0 0",
              border: "none",
              borderTop: `1px solid ${palette.divider}`,
            }}
          />
          <Text
            style={{
              margin: "16px 0 0",
              fontSize: "12px",
              lineHeight: "20px",
              color: palette.muted,
            }}
          >
            {/* Provenance, not platform branding: the sender's name leads,
                opensesh is a quiet "sent via" credit on their mail. */}
            {brandName === "opensesh" ? "opensesh" : `${brandName} · sent via opensesh`}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
