import { describe, expect, it } from "vitest";

import { validateEmbedUrl } from "./resources";

describe("validateEmbedUrl", () => {
  it.each([
    "https://youtube.com/embed/abc",
    "https://www.youtube-nocookie.com/embed/abc",
    "https://vimeo.com/video/123",
    "https://www.loom.com/embed/abc",
    "https://docs.google.com/presentation/d/abc/embed",
    "https://drive.google.com/file/d/abc/preview",
    "https://www.figma.com/embed?url=https://figma.com/file/abc",
  ])("accepts %s", (url) => expect(validateEmbedUrl(url)).toBeUndefined());

  it.each([
    ["http://youtube.com/embed/abc", "HTTPS"],
    ["https://youtube.com.evil.example/embed/abc", "not allowed"],
    ["https://evil.example/embed/abc", "not allowed"],
    ["not a url", "valid HTTPS"],
  ])("rejects %s", (url, message) => expect(validateEmbedUrl(url)).toContain(message));
});
