import MarkdownIt from "markdown-it";

// Rich text is stored as CommonMark markdown (the editor serializes to it).
// This module is the only place markdown becomes HTML, for every surface:
// web UI, mail templates, and embeds.
//
// `html: false` is the security boundary — author-typed markup is escaped to
// literal text, so the renderer's own vocabulary is the only HTML that can
// reach a DOM. Image syntax is disabled because the editor cannot produce it
// and remote images would give submitters a tracking-pixel channel into
// organizer sessions. markdown-it's default validateLink already rejects
// javascript:/vbscript:/data: hrefs.
const hardened = (variant: { readonly linkify: boolean; readonly breaks: boolean }) => {
  const renderer = new MarkdownIt("default", { html: false, ...variant });
  renderer.disable("image");
  const defaultLinkOpen: NonNullable<(typeof renderer.renderer.rules)["link_open"]> = (
    tokens,
    index,
    options,
    _environment,
    self,
  ) => self.renderToken(tokens, index, options);
  const linkOpen = renderer.renderer.rules["link_open"] ?? defaultLinkOpen;
  renderer.renderer.rules["link_open"] = (tokens, index, options, environment, self) => {
    tokens[index]?.attrSet("target", "_blank");
    tokens[index]?.attrSet("rel", "noopener noreferrer nofollow");
    return linkOpen(tokens, index, options, environment, self);
  };
  return renderer;
};

const md = hardened({ linkify: false, breaks: false });

// Freeform variant for organizer-typed outreach text (campaign composer,
// portal invitations): people write plain prose there, so single newlines
// must survive as line breaks and bare URLs become links. Same security
// config as the strict renderer.
const freeform = hardened({ linkify: true, breaks: true });

export const markdownToHtml = (value: string): string => md.render(value);

export const freeformToHtml = (value: string): string => freeform.render(value);

const decodeEntities = (value: string): string =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

// Plain-text projection for previews, diffs, exports, and length limits:
// render through the same parser, then drop the markup.
export const plainTextFromRichText = (value: string): string =>
  decodeEntities(
    markdownToHtml(value)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();

export const hasRichText = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && plainTextFromRichText(value).length > 0;
