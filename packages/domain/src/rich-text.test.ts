import { describe, expect, it } from "vitest";

import { hasRichText, markdownToHtml, plainTextFromRichText } from "./rich-text";

describe("markdownToHtml", () => {
  it("renders the full editor vocabulary", () => {
    expect(markdownToHtml("**bold** and *italic* and ~~struck~~ and `code`")).toBe(
      "<p><strong>bold</strong> and <em>italic</em> and <s>struck</s> and <code>code</code></p>\n",
    );
    expect(markdownToHtml("## Heading 2\n\n### Heading 3")).toBe(
      "<h2>Heading 2</h2>\n<h3>Heading 3</h3>\n",
    );
    expect(markdownToHtml("- one\n- two")).toContain("<ul>");
    expect(markdownToHtml("1. one\n2. two")).toContain("<ol>");
    expect(markdownToHtml("> quoted")).toContain("<blockquote>");
  });

  it("adds safe link attributes", () => {
    expect(markdownToHtml("[site](https://example.com)")).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a></p>\n',
    );
  });

  it("escapes author-typed HTML to literal text", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).not.toContain("<script>");
    expect(markdownToHtml('<img src=x onerror="alert(1)">')).not.toContain("<img");
    expect(markdownToHtml("before <b>bold</b> after")).toBe(
      "<p>before &lt;b&gt;bold&lt;/b&gt; after</p>\n",
    );
  });

  it("refuses javascript: links", () => {
    expect(markdownToHtml("[x](javascript:alert(1))")).not.toContain("<a");
  });

  it("keeps image syntax inert", () => {
    const rendered = markdownToHtml("![tracker](https://evil.example/pixel.png)");
    expect(rendered).not.toContain("<img");
  });

  it("renders empty input to nothing", () => {
    expect(markdownToHtml("")).toBe("");
    expect(markdownToHtml("   \n")).toBe("");
  });
});

describe("plainTextFromRichText", () => {
  it("projects markdown to its visible text", () => {
    expect(plainTextFromRichText("**Ada** _Lovelace_")).toBe("Ada Lovelace");
    expect(plainTextFromRichText("## Title\n\n- a\n- b")).toBe("Title a b");
  });

  it("decodes entities the renderer escaped", () => {
    expect(plainTextFromRichText("AT&T <3")).toBe("AT&T <3");
  });
});

describe("hasRichText", () => {
  it("is false for empty, whitespace, and null values", () => {
    expect(hasRichText(null)).toBe(false);
    expect(hasRichText(undefined)).toBe(false);
    expect(hasRichText("")).toBe(false);
    expect(hasRichText("   ")).toBe(false);
  });

  it("is true when visible text exists", () => {
    expect(hasRichText("hi")).toBe(true);
    expect(hasRichText("**hi**")).toBe(true);
  });
});
