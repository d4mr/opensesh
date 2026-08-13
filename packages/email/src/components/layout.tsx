// @jsxRuntime automatic
// @jsxImportSource react
import { Body, Button, Container, Head, Hr, Html, Img, Preview, Section, Text } from "react-email";
import type { CSSProperties, ReactNode } from "react";

export const palette = {
  page: "#f6f7f4",
  card: "#ffffff",
  border: "#dfe3dd",
  divider: "#e5e7e2",
  ink: "#1b211d",
  muted: "#68706a",
  brand: "#176b4d",
} as const;

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const paragraph: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "14px",
  lineHeight: "1.6",
  color: palette.ink,
};

const button: CSSProperties = {
  display: "inline-block",
  backgroundColor: palette.brand,
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: "1",
  padding: "11px 18px",
  textDecoration: "none",
};

export function Cta({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <Section style={{ margin: "4px 0 20px" }}>
      <Button href={href} style={button}>
        {children}
      </Button>
    </Section>
  );
}

const note: CSSProperties = {
  margin: "4px 0 20px",
  border: `1px solid ${palette.border}`,
  borderRadius: "8px",
  padding: "14px",
};

export function NoteCard({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Section style={note}>
      <Text style={{ margin: "0", fontSize: "13px", fontWeight: 700, color: palette.ink }}>
        {title}
      </Text>
      <Text
        style={{
          margin: "8px 0 0",
          fontSize: "14px",
          lineHeight: "1.6",
          color: palette.ink,
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export function EmailLayout({
  brandName,
  logoUrl = null,
  preview,
  children,
}: {
  /** Event name for event mail, "opensesh" for account mail. */
  readonly brandName: string;
  readonly logoUrl?: string | null;
  readonly preview: string;
  readonly children: ReactNode;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: "0", backgroundColor: palette.page, fontFamily }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "32px 16px",
          }}
        >
          <Container
            style={{
              backgroundColor: palette.card,
              border: `1px solid ${palette.border}`,
              borderTop: `3px solid ${palette.brand}`,
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <Section style={{ padding: "20px 24px 4px" }}>
              {logoUrl === null ? null : (
                <Img
                  src={logoUrl}
                  alt=""
                  width="48"
                  height="48"
                  style={{
                    display: "block",
                    width: "48px",
                    height: "48px",
                    margin: "0 0 12px",
                    borderRadius: "8px",
                    objectFit: "cover",
                  }}
                />
              )}
              <Text
                style={{
                  margin: "0",
                  fontSize: "16px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: palette.ink,
                }}
              >
                {brandName}
              </Text>
            </Section>
            <Section style={{ padding: "12px 24px 24px" }}>{children}</Section>
            <Hr style={{ margin: "0", borderTop: `1px solid ${palette.divider}` }} />
            <Section style={{ padding: "14px 24px" }}>
              <Text style={{ margin: "0", fontSize: "12px", color: palette.muted }}>
                opensesh — {brandName}
              </Text>
            </Section>
          </Container>
        </Container>
      </Body>
    </Html>
  );
}
