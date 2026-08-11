import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural guard: stored rich text is markdown and must only become DOM
// through <RichText> (components/forms/rich-text.tsx). A new call site that
// reaches for dangerouslySetInnerHTML either renders escaped markdown (a
// visible bug) or bypasses the renderer (a security hole) — both are caught
// here before review.
const allowed = new Set([
  // The one sanctioned rich-text seam.
  "components/forms/rich-text.tsx",
  // shadcn chart injects its own generated CSS, not user content.
  "components/ui/chart.tsx",
  // Widget custom CSS in a <style> tag, scoped to the embed iframe and
  // neutralized against </style> breakout at the call site.
  "routes/embed.$embedId.tsx",
  // shiki-generated syntax highlighting of app-produced embed code.
  "components/admin/widget-builder.tsx",
]);

const sourceFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") || entry.name.endsWith(".ts") ? [path] : [];
  });

describe("rich text rendering boundary", () => {
  it("keeps dangerouslySetInnerHTML inside sanctioned files", () => {
    const root = join(import.meta.dirname);
    const offenders = sourceFiles(root)
      .filter((path) => readFileSync(path, "utf8").includes("dangerouslySetInnerHTML"))
      .map((path) => relative(root, path))
      .filter((path) => !allowed.has(path) && !path.endsWith(".test.ts"));
    expect(offenders).toEqual([]);
  });
});
