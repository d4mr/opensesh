// Branded OG card rendered by the /og/[...slugs]/image.webp route via takumi.
// Palette mirrors the landing tokens (apps/landing/src/styles.css) so link
// previews match the landing card: paper ground, ink type, opensesh green.
const paper = "#fafaf7";
const ink = "#1b211d";
const muted = "#5f665f";
const green = "#1d6b4c";
const markGreen = "#183f2b";
const washGreen = "#d9f0e2";

// One quarter of the opensesh mark (public/brand/opensesh-mark.svg), mirrored
// into place — takumi renders inline SVG but not <use> references.
const quarter =
  "M27 4H16.5C9.596 4 4 9.596 4 16.5V27C4 28.105 4.895 29 6 29H17V25H21V21H25V17H29V6C29 4.895 28.105 4 27 4Z";

function Mark({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <g fill={color}>
        <path d={quarter} />
        <path transform="translate(64 0) scale(-1 1)" d={quarter} />
        <path transform="translate(0 64) scale(1 -1)" d={quarter} />
        <path transform="translate(64 64) scale(-1 -1)" d={quarter} />
      </g>
    </svg>
  );
}

export function OgImage({ title, description }: { title: string; description?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        backgroundColor: paper,
        borderBottom: `12px solid ${green}`,
        fontFamily: "Manrope",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", right: 64, top: 161, display: "flex" }}>
        <Mark size={308} color={washGreen} />
      </div>
      <p
        style={{
          fontSize: "26px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: green,
          margin: 0,
        }}
      >
        OPENSESH DOCS
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flexGrow: 1,
          paddingBottom: "16px",
        }}
      >
        <p
          style={{
            fontSize: "76px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.08,
            color: ink,
            margin: 0,
            maxWidth: "1000px",
          }}
        >
          {title}
        </p>
        {description ? (
          <p
            style={{
              fontSize: "34px",
              fontWeight: 500,
              lineHeight: 1.4,
              color: muted,
              margin: 0,
              marginTop: "28px",
              maxWidth: "880px",
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <Mark size={44} color={markGreen} />
        <p
          style={{
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: ink,
            margin: 0,
          }}
        >
          opensesh
        </p>
        <p style={{ fontSize: "32px", fontWeight: 500, color: muted, margin: 0 }}>
          docs.opensesh.io
        </p>
      </div>
    </div>
  );
}
