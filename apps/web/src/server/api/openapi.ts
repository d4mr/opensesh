import { Schema } from "effect";

import type { ApiEndpoint } from "./types";

// JSON Schema (draft 2020-12) straight from the endpoint's Effect Schema —
// OpenAPI 3.1 shares the dialect, so no conversion pass is needed. The same
// schema objects validate the live request and type the handler's return
// value, which is what keeps this spec honest.
//
// Effect emits self-contained documents whose internal refs point at
// `#/$defs/<name>` under machine-generated names ("Union_", "Objects_1").
// Those names would leak into the docs as component schemas, so every
// non-recursive definition is inlined at its use sites instead; only
// genuinely cyclic definitions (which cannot be inlined) are hoisted into
// `components.schemas` under an operation-scoped name.
const DEFS_PREFIX = "#/$defs/";

const collectRefNames = (value: unknown, out: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectRefNames(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "$ref" && typeof entry === "string" && entry.startsWith(DEFS_PREFIX)) {
      out.add(entry.slice(DEFS_PREFIX.length));
    } else {
      collectRefNames(entry, out);
    }
  }
};

// A definition is cyclic when it can reach itself through other definitions.
const cyclicDefinitions = (definitions: Record<string, unknown>): Set<string> => {
  const edges = new Map<string, Set<string>>();
  for (const [name, definition] of Object.entries(definitions)) {
    const out = new Set<string>();
    collectRefNames(definition, out);
    edges.set(name, out);
  }
  const cyclic = new Set<string>();
  for (const start of edges.keys()) {
    const stack = [...(edges.get(start) ?? [])];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const next = stack.pop();
      if (next === undefined || seen.has(next)) continue;
      seen.add(next);
      if (next === start) {
        cyclic.add(start);
        break;
      }
      stack.push(...(edges.get(next) ?? []));
    }
  }
  return cyclic;
};

const resolveRefs = (
  value: unknown,
  definitions: Record<string, unknown>,
  cyclic: ReadonlySet<string>,
  rename: (name: string) => string,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => resolveRefs(item, definitions, cyclic, rename));
  }
  if (typeof value !== "object" || value === null) return value;
  const ref = (value as { $ref?: unknown }).$ref;
  if (typeof ref === "string" && ref.startsWith(DEFS_PREFIX)) {
    const name = ref.slice(DEFS_PREFIX.length);
    if (!cyclic.has(name) && definitions[name] !== undefined) {
      return resolveRefs(definitions[name], definitions, cyclic, rename);
    }
    return { $ref: `#/components/schemas/${rename(name)}` };
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      resolveRefs(entry, definitions, cyclic, rename),
    ]),
  );
};

// Effect's JSON serializer documents numbers as `number | "NaN" | "Infinity" |
// "-Infinity"`, but responses go through plain JSON.stringify, which can never
// emit those strings — so the union is noise. Collapse it back to `number`.
const NON_FINITE = new Set(["NaN", "Infinity", "-Infinity"]);
const isNonFiniteBranch = (branch: unknown): boolean =>
  typeof branch === "object" &&
  branch !== null &&
  (branch as { type?: unknown }).type === "string" &&
  Array.isArray((branch as { enum?: unknown }).enum) &&
  (branch as { enum: ReadonlyArray<unknown> }).enum.every(
    (value) => typeof value === "string" && NON_FINITE.has(value),
  );
const collapseNonFiniteNumbers = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(collapseNonFiniteNumbers);
  if (typeof value !== "object" || value === null) return value;
  const record: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, collapseNonFiniteNumbers(entry)]),
  );
  if (Array.isArray(record.anyOf)) {
    const finite = record.anyOf.filter((branch) => !isNonFiniteBranch(branch));
    if (finite.length > 0 && finite.length < record.anyOf.length) {
      if (finite.length === 1) {
        const { anyOf: _dropped, ...rest } = record;
        return { ...rest, ...(finite[0] as Record<string, unknown>) };
      }
      record.anyOf = finite;
    }
  }
  return record;
};

// Effect emits refinement checks as `allOf: [{ minItems: 1 }]`. That is valid
// JSON Schema, but example generators trip over it and readers have to look
// twice — fold pure constraint members into the parent so it reads as plain
// `minItems: 1`. Members that compose schemas (or would collide with a parent
// key) stay inside allOf untouched.
const COMPOSITION_KEYS = new Set(["$ref", "allOf", "anyOf", "oneOf", "not", "type"]);
const flattenConstraintAllOf = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(flattenConstraintAllOf);
  if (typeof value !== "object" || value === null) return value;
  const record: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, flattenConstraintAllOf(entry)]),
  );
  if (Array.isArray(record.allOf)) {
    const kept: unknown[] = [];
    for (const member of record.allOf) {
      const isPureConstraint =
        typeof member === "object" &&
        member !== null &&
        !Array.isArray(member) &&
        Object.keys(member).every((key) => !COMPOSITION_KEYS.has(key) && !(key in record));
      if (isPureConstraint) {
        Object.assign(record, member);
      } else {
        kept.push(member);
      }
    }
    if (kept.length === 0) {
      const { allOf: _dropped, ...rest } = record;
      return rest;
    }
    record.allOf = kept;
  }
  return record;
};

const cleanup = (value: unknown): unknown =>
  flattenConstraintAllOf(collapseNonFiniteNumbers(value));

const schemaToJson = (
  schema: Schema.ConstraintDecoder<unknown>,
  operationId: string,
  componentSchemas: Record<string, unknown>,
): Record<string, unknown> => {
  try {
    const document = Schema.toJsonSchemaDocument(schema);
    const definitions: Record<string, unknown> = document.definitions ?? {};
    const cyclic = cyclicDefinitions(definitions);
    const rename = (name: string) => `${operationId}_${name}`;
    for (const name of cyclic) {
      componentSchemas[rename(name)] = cleanup(
        resolveRefs(definitions[name], definitions, cyclic, rename),
      );
    }
    return cleanup(resolveRefs(document.schema, definitions, cyclic, rename)) as Record<
      string,
      unknown
    >;
  } catch {
    return { type: "object" };
  }
};

const pathParams = (path: string) =>
  Array.from(path.matchAll(/\{([^}]+)\}/g), (match) => match[1] ?? "");

// Shown as the subtitle of each generated API reference page and carried in
// the machine-readable document for API consumers.
const TAG_DESCRIPTIONS: Record<string, string> = {
  Organization: "The workspace profile, members, and pending invitations.",
  Events: "Events and the shared event library: tracks, formats, rooms, tags, levels.",
  Submissions: "The review desk: list, inspect, and decide CFP submissions.",
  Sessions:
    "The program lens over accepted submissions: readiness, cancellation with a recorded cause, reinstatement, and manual sessions.",
  Speakers: "The event speaker directory, workflow status, imports, and portal invites.",
  Reviews: "Review rounds, reviewer assignment, reminders, and AI reviews.",
  Agenda: "The schedule, publishing, and AI-generated agenda drafts.",
  CRM: "Organization-level contacts: tags, notes, merge, and CSV import.",
  Pipeline: "Speaker-sourcing pipeline stages, cards, and segments.",
  Widgets: "Embeddable views and the public program feed.",
  Mail: "The communication center, campaigns, and the event email log.",
  Integrations: "The Accelevents connection and sync.",
};

const ERROR_SCHEMA = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string", description: "Stable machine-readable error code" },
        message: { type: "string" },
      },
      required: ["code", "message"],
    },
  },
  required: ["error"],
};

export const buildOpenApiDocument = (endpoints: ReadonlyArray<ApiEndpoint>, origin: string) => {
  const paths: Record<string, Record<string, unknown>> = {};
  const componentSchemas: Record<string, unknown> = {};
  for (const endpoint of endpoints) {
    const operation: Record<string, unknown> = {
      operationId: endpoint.operationId,
      summary: endpoint.summary,
      ...(endpoint.description === undefined ? {} : { description: endpoint.description }),
      tags: [endpoint.tag],
      parameters: [
        ...pathParams(endpoint.path).map((name) => ({
          name,
          in: "path",
          required: true,
          schema: { type: "string" },
        })),
        ...(endpoint.queryParams ?? []).map((param) => ({
          name: param.name,
          in: "query",
          required: param.required ?? false,
          description: param.description,
          schema: { type: "string" },
        })),
      ],
      ...(endpoint.bodySchema === undefined
        ? {}
        : {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: schemaToJson(endpoint.bodySchema, endpoint.operationId, componentSchemas),
                },
              },
            },
          }),
      responses: {
        [String(endpoint.successStatus ?? 200)]: {
          description: "Success",
          ...(endpoint.successStatus === 204
            ? {}
            : {
                content: {
                  "application/json": {
                    schema: schemaToJson(
                      endpoint.successSchema,
                      `${endpoint.operationId}_response`,
                      componentSchemas,
                    ),
                  },
                },
              }),
        },
        "400": {
          description: "Invalid request",
          content: { "application/json": { schema: ERROR_SCHEMA } },
        },
        "401": {
          description: "Missing or invalid API key",
          content: { "application/json": { schema: ERROR_SCHEMA } },
        },
        "403": {
          description: "The key's organization cannot access this resource",
          content: { "application/json": { schema: ERROR_SCHEMA } },
        },
        "404": {
          description: "Not found",
          content: { "application/json": { schema: ERROR_SCHEMA } },
        },
      },
    };
    const pathEntry = paths[endpoint.path] ?? {};
    pathEntry[endpoint.method.toLowerCase()] = operation;
    paths[endpoint.path] = pathEntry;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "opensesh API",
      version: "1.0.0",
      description:
        'The complete opensesh surface over REST: events, call for papers, submissions, evaluation, agenda, speakers, CRM, widgets, mail, and integrations. Authenticate with an organization API key (`Authorization: Bearer osk_…`) created in Organization settings → API keys. Success responses return the resource directly; every error is `{ "error": { "code", "message" } }` with a matching HTTP status.',
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "An organization API key (osk_…)",
        },
      },
      ...(Object.keys(componentSchemas).length > 0 ? { schemas: componentSchemas } : {}),
    },
    tags: Array.from(new Set(endpoints.map((endpoint) => endpoint.tag)), (tag) => ({
      name: tag,
      ...(TAG_DESCRIPTIONS[tag] === undefined ? {} : { description: TAG_DESCRIPTIONS[tag] }),
    })),
    paths,
  };
};
