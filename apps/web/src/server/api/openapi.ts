import { SchemaRepresentation, type Schema } from "effect";

import type { ApiEndpoint } from "./types";

// JSON Schema (draft 2020-12) straight from the endpoint's Effect Schema —
// OpenAPI 3.1 shares the dialect, so no conversion pass is needed. The same
// schema object validates the live request, which is what keeps this spec
// honest.
const schemaToJson = (schema: Schema.ConstraintDecoder<unknown>): Record<string, unknown> => {
  try {
    const document = SchemaRepresentation.toJsonSchemaDocument(
      SchemaRepresentation.toRepresentation(schema.ast),
    );
    const definitions = document.definitions ?? {};
    return {
      ...(document.schema as Record<string, unknown>),
      ...(Object.keys(definitions).length > 0 ? { $defs: definitions } : {}),
    };
  } catch {
    return { type: "object" };
  }
};

const pathParams = (path: string) =>
  Array.from(path.matchAll(/\{([^}]+)\}/g), (match) => match[1] ?? "");

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
              content: { "application/json": { schema: schemaToJson(endpoint.bodySchema) } },
            },
          }),
      responses: {
        [String(endpoint.successStatus ?? 200)]: {
          description: "Success",
          ...(endpoint.successStatus === 204
            ? {}
            : { content: { "application/json": { schema: {} } } }),
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
    },
    tags: Array.from(new Set(endpoints.map((endpoint) => endpoint.tag)), (tag) => ({ name: tag })),
    paths,
  };
};
