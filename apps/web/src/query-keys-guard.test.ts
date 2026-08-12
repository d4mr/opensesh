import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Structural guard: every query key is built from the canonical tree in
// lib/query-keys.ts so invalidation can scope by prefix (see
// lib/after-mutation.ts). A key literal written anywhere else re-creates the
// drift that produced the V2-008/V3-008 staleness bugs — caught here before
// review.
const allowed = new Set([
  // The canonical tree itself.
  "lib/query-keys.ts",
]);

const sourceFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") || entry.name.endsWith(".ts") ? [path] : [];
  });

// Matches `queryKey: [` followed by anything other than a spread of a qk
// builder result — i.e. an inline array literal.
const literalKey = /queryKey:\s*\[\s*["'`]/;

describe("query key boundary", () => {
  it("keeps query-key literals inside lib/query-keys.ts", () => {
    const root = join(import.meta.dirname);
    const offenders = sourceFiles(root)
      .filter((path) => literalKey.test(readFileSync(path, "utf8")))
      .map((path) => relative(root, path))
      .filter((path) => !allowed.has(path) && !path.endsWith(".test.ts"));
    expect(offenders).toEqual([]);
  });
});
