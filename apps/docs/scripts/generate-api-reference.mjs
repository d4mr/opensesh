// Regenerates the API reference pages from the OpenAPI snapshot.
// Usage: node scripts/generate-api-reference.mjs [spec-url]
//   With a spec-url (e.g. http://localhost:3000/api/v1/openapi.json), the
//   snapshot at openapi.json is refreshed first.
// One MDX page per tag — matching the /api/<tag> URLs the docs have
// always used — plus a meta.json keeping the spec's tag order.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateFiles } from "fumadocs-openapi";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const specPath = join(root, "openapi.json");

const specUrl = process.argv[2];
if (specUrl !== undefined) {
  const spec = await (await fetch(specUrl)).json();
  // The live document reports the origin it was served from; the committed
  // snapshot must always point at production.
  spec.servers = [{ url: "https://app.opensesh.io/api/v1" }];
  await writeFile(specPath, `${JSON.stringify(spec, null, 1)}\n`);
  console.log(`refreshed openapi.json from ${specUrl}`);
}

/** @type {{ tags: Array<{ name: string }> }} */
const specForTags = JSON.parse(await readFile(specPath, "utf8"));
const tagTitles = new Map(specForTags.tags.map((tag) => [tag.name, tag.name]));

await generateFiles({
  cwd: root,
  input: ["./openapi.json"],
  output: "content/docs/api",
  per: "tag",
  beforeWrite(files) {
    // Fumadocs title-cases tag names by splitting capital runs ("CRM" →
    // "C R M"); restore the spec's own tag names verbatim.
    for (const file of files) {
      const name = file.path
        .split("/")
        .at(-1)
        ?.replace(/\.mdx$/, "");
      const tag = [...tagTitles.keys()].find((key) => key.toLowerCase() === name);
      if (tag !== undefined) {
        file.content = file.content.replace(/^title: .*$/m, `title: ${tag}`);
      }
    }
  },
});

// Sidebar order: curated overview first, then tags in spec order.
/** @type {{ tags: Array<{ name: string }> }} */
const spec = JSON.parse(await readFile(specPath, "utf8"));
/** @param {string} value */
const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
await writeFile(
  join(root, "content/docs/api/meta.json"),
  `${JSON.stringify({ pages: ["index", ...spec.tags.map((tag) => slugify(tag.name))] }, null, 2)}\n`,
);
console.log(`generated ${spec.tags.length} tag pages + meta.json`);
