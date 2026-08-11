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
const md = new MarkdownIt("default", { html: false, linkify: false });
md.disable("image");

const defaultLinkOpen: NonNullable<(typeof md.renderer.rules)["link_open"]> = (
  tokens,
  index,
  options,
  _environment,
  self,
) => self.renderToken(tokens, index, options);

const linkOpen = md.renderer.rules["link_open"] ?? defaultLinkOpen;
md.renderer.rules["link_open"] = (tokens, index, options, environment, self) => {
  tokens[index]?.attrSet("target", "_blank");
  tokens[index]?.attrSet("rel", "noopener noreferrer nofollow");
  return linkOpen(tokens, index, options, environment, self);
};

export const markdownToHtml = (value: string): string => md.render(value);

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
