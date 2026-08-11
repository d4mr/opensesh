// Generates the API reference MDX pages from the live OpenAPI document.
// Usage: node scripts/generate-api-reference.mjs [spec-url]
// Rerun whenever endpoints change; pages land in docs/pages/api/.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const specUrl = process.argv[2] ?? "http://localhost:3000/api/v1/openapi.json";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const spec = await (await fetch(specUrl)).json();

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const escapeCell = (value) =>
  String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("<", "&lt;")
    .replaceAll(/\s+/g, " ")
    .trim();

// Compact type expression from a JSON Schema node, e.g.
// string | null, "accept" | "decline", string[], object.
const typeExpr = (schema, defs, depth = 0) => {
  if (schema === undefined || schema === null) return "unknown";
  if (schema.$ref !== undefined) {
    const name = schema.$ref.split("/").at(-1);
    const resolved = defs?.[name];
    return depth > 3 || resolved === undefined ? name : typeExpr(resolved, defs, depth + 1);
  }
  if (Array.isArray(schema.anyOf)) {
    // Effect's number codec adds "NaN"/"Infinity" string encodings — noise here.
    const branches = schema.anyOf.filter(
      (s) => !(Array.isArray(s.enum) && s.enum.every((v) => ["NaN", "Infinity", "-Infinity"].includes(v))),
    );
    return [...new Set(branches.map((s) => typeExpr(s, defs, depth + 1)))].join(" | ");
  }
  if (Array.isArray(schema.enum)) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  if (schema.type === "array") return `${typeExpr(schema.items, defs, depth + 1)}[]`;
  if (schema.type === "object" || schema.properties !== undefined) return "object";
  if (Array.isArray(schema.type)) return schema.type.join(" | ");
  return schema.type ?? "unknown";
};

const bodyTable = (schema, defs) => {
  if (schema === undefined) return "";
  const resolved =
    schema.$ref !== undefined ? (defs?.[schema.$ref.split("/").at(-1)] ?? schema) : schema;
  const properties = resolved.properties;
  if (properties === undefined) {
    return `Body: \`${typeExpr(resolved, defs)}\`\n\n`;
  }
  const required = new Set(resolved.required ?? []);
  const rows = Object.entries(properties).map(([name, prop]) => {
    const requiredMark = required.has(name) ? "yes" : "no";
    return `| \`${name}\` | \`${escapeCell(typeExpr(prop, defs))}\` | ${requiredMark} | ${escapeCell(prop.description ?? "")} |`;
  });
  return [
    "#### Request body",
    "",
    "| Field | Type | Required | Notes |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
};

const paramsTable = (parameters, kind) => {
  const rows = (parameters ?? []).filter((param) => param.in === kind);
  if (rows.length === 0) return "";
  const title = kind === "path" ? "Path parameters" : "Query parameters";
  return [
    `#### ${title}`,
    "",
    "| Name | Required | Notes |",
    "| --- | --- | --- |",
    ...rows.map(
      (param) =>
        `| \`${param.name}\` | ${param.required === true ? "yes" : "no"} | ${escapeCell(param.description ?? "")} |`,
    ),
    "",
  ].join("\n");
};

const curlExample = (method, path, bodySchema, defs) => {
  const url = `https://app.opensesh.io/api/v1${path.replaceAll(/\{([^}]+)\}/g, "$1")}`;
  const lines = [`curl ${method === "GET" ? "" : `-X ${method} `}${url} \\`];
  lines.push(`  -H "Authorization: Bearer osk_..."${bodySchema === undefined ? "" : " \\"}`);
  if (bodySchema !== undefined) {
    lines.push('  -H "Content-Type: application/json" \\');
    const resolved =
      bodySchema.$ref !== undefined
        ? (defs?.[bodySchema.$ref.split("/").at(-1)] ?? bodySchema)
        : bodySchema;
    const sampleValue = (prop) => {
      if (Array.isArray(prop?.enum)) return prop.enum[0];
      if (prop?.type === "array") return [];
      if (prop?.type === "number" || prop?.type === "integer") return 1;
      if (prop?.type === "boolean") return true;
      if (Array.isArray(prop?.anyOf)) return sampleValue(prop.anyOf[0]);
      if (prop?.type === "object" || prop?.properties !== undefined) return {};
      if (prop?.type === "null") return null;
      return "...";
    };
    const sample = Object.fromEntries(
      Object.entries(resolved.properties ?? {})
        .filter(([name]) => (resolved.required ?? []).includes(name))
        .map(([name, prop]) => [name, sampleValue(prop)]),
    );
    lines.push(`  -d '${JSON.stringify(sample)}'`);
  }
  return ["```bash", ...lines, "```"].join("\n").replace(/ \\\n```/, "\n```");
};

const defs = {};
const tags = spec.tags.map((tag) => tag.name);
const byTag = new Map(tags.map((tag) => [tag, []]));
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    const tag = operation.tags?.[0] ?? "Other";
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push({ method: method.toUpperCase(), path, operation });
  }
}

const methodOrder = { GET: 0, POST: 1, PATCH: 2, PUT: 3, DELETE: 4 };
const pagesDir = join(root, "docs", "pages", "api");
await mkdir(pagesDir, { recursive: true });

const sidebarEntries = [{ text: "Overview", link: "/api" }];
let total = 0;

for (const tag of byTag.keys()) {
  const operations = byTag
    .get(tag)
    .sort((a, b) => a.path.localeCompare(b.path) || methodOrder[a.method] - methodOrder[b.method]);
  if (operations.length === 0) continue;
  total += operations.length;
  const slug = slugify(tag);
  const sections = operations.map(({ method, path, operation }) => {
    const bodySchema = operation.requestBody?.content?.["application/json"]?.schema;
    const bodyDefs = bodySchema?.$defs ?? defs;
    return [
      `## ${operation.summary}`,
      "",
      `\`${method} ${path.replaceAll("{", "\\{").replaceAll("}", "\\}")}\``,
      "",
      ...(operation.description === undefined ? [] : [operation.description, ""]),
      paramsTable(operation.parameters, "path"),
      paramsTable(operation.parameters, "query"),
      bodyTable(bodySchema, bodyDefs),
      curlExample(method, path, bodySchema, bodyDefs),
      "",
    ]
      .filter((part) => part !== "")
      .join("\n");
  });
  const page = [
    `# ${tag}`,
    "",
    `${operations.length} operation${operations.length === 1 ? "" : "s"}. All requests need an \`Authorization: Bearer osk_...\` header — see the [API overview](/api) for authentication and conventions.`,
    "",
    sections.join("\n---\n\n"),
  ].join("\n");
  await writeFile(join(pagesDir, `${slug}.mdx`), page);
  sidebarEntries.push({ text: tag, link: `/api/${slug}` });
}

console.log(
  `Wrote ${sidebarEntries.length - 1} tag pages (${total} operations) to docs/pages/api/.`,
);
console.log("Sidebar entries:");
console.log(JSON.stringify(sidebarEntries, null, 2));
