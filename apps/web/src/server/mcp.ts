import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { users } from "@opensesh/domain/db/auth";
import {
  type CurrentUserValue,
  getCurrentUser,
  makeCurrentUserLiveWith,
} from "@opensesh/domain/server/current-user";
import { Db, makeDatabase } from "@opensesh/domain/server/db";
import { makeRepositoriesLiveWith } from "@opensesh/domain/server/repos";
import { withMcpAuth } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { ConfigProvider, Effect, Layer, ManagedRuntime, Result, Schema } from "effect";

import { makeAuth } from "@/lib/auth";
import { mailLayerFromEnv } from "@/server/mail-layer";
import { apiEndpoints } from "@/server/api";
import { errorCode } from "@/server/api/dispatch";
import { PATH_PARAM_DESCRIPTIONS, pathParams, schemaToJson } from "@/server/api/openapi";
import { actorForPrincipal, type ApiEndpoint, type ApiRequestContext } from "@/server/api/types";

const INSTRUCTIONS = `opensesh is a conference program platform: call for papers, review, decisions, scheduling, and speaker operations.

A submission is a CFP entry moving through review; accepting it makes it a session — the same record seen through the program lens, so sessions and submissions share one id space. A session's id is its submission's id and works in either family of tools, including everywhere a submissionId is asked for. Manually created sessions are submissions born accepted, with no CFP history behind them.

Call whoami first: it returns who you are, your role, and the events (with ids) your other tools operate on. Admins see the full program surface; reviewers see their own queue — getMyReviews lists rounds and assignments (blind rounds arrive with speaker identities already redacted), submitReviewAnswers and recuseReview act on one assignment, and saveMyReview scores a pending submission in your assigned tracks.`;

// ---------------------------------------------------------------------------
// Tool generation. Each ApiEndpoint becomes one MCP tool: path and query
// parameters merge with the body's top-level properties into a single flat
// input object (the same JSON Schema machinery as the OpenAPI document). A
// body whose schema is not a plain object — or whose properties collide with
// a parameter name — nests under a "body" property instead.
// ---------------------------------------------------------------------------

interface GeneratedTool {
  readonly endpoint: ApiEndpoint;
  readonly inputSchema: Record<string, unknown>;
  readonly nestedBody: boolean;
  readonly queryNames: ReadonlySet<string>;
  readonly paramNames: ReadonlySet<string>;
}

const isPlainObjectSchema = (
  json: Record<string, unknown>,
): json is { properties: Record<string, unknown>; required?: ReadonlyArray<string> } & Record<
  string,
  unknown
> => json.type === "object" && typeof json.properties === "object" && json.properties !== null;

const generateTool = (endpoint: ApiEndpoint): GeneratedTool => {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const paramNames = new Set<string>();
  const queryNames = new Set<string>();
  for (const name of pathParams(endpoint.path)) {
    paramNames.add(name);
    const description =
      endpoint.pathParams?.find((param) => param.name === name)?.description ??
      PATH_PARAM_DESCRIPTIONS[name];
    properties[name] = { type: "string", ...(description === undefined ? {} : { description }) };
    required.push(name);
  }
  for (const query of endpoint.queryParams ?? []) {
    queryNames.add(query.name);
    properties[query.name] = { type: "string", description: query.description };
    if (query.required === true) required.push(query.name);
  }
  let nestedBody = false;
  if (endpoint.bodySchema !== undefined) {
    const json = schemaToJson(endpoint.bodySchema, endpoint.operationId, {});
    const flat =
      isPlainObjectSchema(json) &&
      Object.keys(json.properties).every((key) => !(key in properties));
    if (flat && isPlainObjectSchema(json)) {
      Object.assign(properties, json.properties);
      for (const key of json.required ?? []) required.push(key);
    } else {
      nestedBody = true;
      properties.body = { ...json, description: "Request body" };
      required.push("body");
    }
  }
  return {
    endpoint,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    nestedBody,
    queryNames,
    paramNames,
  };
};

const generatedTools = new Map(
  apiEndpoints.map((endpoint) => [endpoint.operationId, generateTool(endpoint)]),
);

// Tool exposure mirrors the web app's role split: admins get the program
// surface (the Reviewer tag rejects them anyway, matching the web reviewer
// workspace), reviewers get their own queue, and everyone gets whoami.
const endpointsForUser = (user: CurrentUserValue): ReadonlyArray<GeneratedTool> => {
  const all = Array.from(generatedTools.values());
  if (user.roles.admin) return all.filter((tool) => tool.endpoint.tag !== "Reviewer");
  const isReviewer =
    user.roles.reviewer || user.events.some((event) => event.memberRole === "reviewer");
  return isReviewer ? all.filter((tool) => tool.endpoint.tag === "Reviewer") : [];
};

const WHOAMI = {
  name: "whoami",
  description:
    "Who the connected user is: name, email, organization, role, and the events (with ids and per-event roles) that every other tool's eventId refers to. Call this first.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
} as const;

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  ...(isError ? { isError: true } : {}),
});

// ---------------------------------------------------------------------------
// Request handling. Stateless streamable HTTP: every POST carries the OAuth
// bearer token, so each request authenticates, derives the user's real
// membership-based CurrentUser (unlike API keys' synthesized org-admin), and
// builds a fresh server whose tool list matches the user's role.
// ---------------------------------------------------------------------------

const runtimeForUser = (env: Cloudflare.Env, userId: string) => {
  const database = makeDatabase(env.HYPERDRIVE.connectionString);
  const dbLive = Layer.succeed(Db, { database });
  const loadSession = Effect.tryPromise({
    try: async () => {
      const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
      return user === undefined
        ? null
        : { userId: user.id, email: user.email, name: user.name ?? user.email };
    },
    catch: () => null,
  }).pipe(Effect.orElseSucceed(() => null));
  return ManagedRuntime.make(
    Layer.mergeAll(
      makeRepositoriesLiveWith(dbLive),
      makeCurrentUserLiveWith(dbLive, loadSession),
      mailLayerFromEnv(env),
      ConfigProvider.layer(
        ConfigProvider.fromEnvRecord({ ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }),
      ),
    ),
  );
};

export const handleMcpRequest = async (request: Request): Promise<Response> => {
  const { env } = await import("cloudflare:workers");
  const auth = makeAuth(env, new URL(request.url).origin);
  const gated = withMcpAuth(auth, async (innerRequest, token) => {
    const runtime = runtimeForUser(env, token.userId);
    try {
      const outcome = await runtime.runPromise(Effect.result(getCurrentUser));
      if (Result.isFailure(outcome)) {
        return Response.json(
          { error: { code: errorCode(outcome.failure._tag), message: outcome.failure.message } },
          { status: 403 },
        );
      }
      const user = outcome.success;
      const principal = {
        kind: "user",
        organizationId: user.orgId,
        userId: user.userId,
        name: user.name,
      } as const;
      const tools = endpointsForUser(user);

      const server = new Server(
        { name: "opensesh", version: "1.0.0" },
        { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
      );
      server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: [
          WHOAMI,
          ...tools.map((tool) => ({
            name: tool.endpoint.operationId,
            description:
              tool.endpoint.description === undefined
                ? tool.endpoint.summary
                : `${tool.endpoint.summary}. ${tool.endpoint.description}`,
            inputSchema: tool.inputSchema,
          })),
        ],
      }));
      server.setRequestHandler(CallToolRequestSchema, async (call) => {
        if (call.params.name === WHOAMI.name) {
          return textResult({
            name: user.name,
            email: user.email,
            organization: user.organizationName,
            role: user.roles.admin ? "admin" : "reviewer",
            events: user.events.map((event) => ({
              id: event.id,
              slug: event.slug,
              role: user.roles.admin ? "admin" : (event.memberRole ?? "none"),
            })),
          });
        }
        const tool = tools.find((candidate) => candidate.endpoint.operationId === call.params.name);
        if (tool === undefined) {
          return textResult(
            { error: { code: "unknown_tool", message: `No tool named ${call.params.name}` } },
            true,
          );
        }
        const args = (call.params.arguments ?? {}) as Record<string, unknown>;
        const params: Record<string, string> = {};
        for (const name of tool.paramNames) params[name] = String(args[name] ?? "");
        const query = new URLSearchParams();
        for (const name of tool.queryNames) {
          const value = args[name];
          if (value !== undefined && value !== null) query.set(name, String(value));
        }
        let body: unknown;
        if (tool.endpoint.bodySchema !== undefined) {
          const raw = tool.nestedBody
            ? args.body
            : Object.fromEntries(
                Object.entries(args).filter(
                  ([key]) => !tool.paramNames.has(key) && !tool.queryNames.has(key),
                ),
              );
          const decoded = Schema.decodeUnknownResult(tool.endpoint.bodySchema)(raw);
          if (Result.isFailure(decoded)) {
            return textResult(
              { error: { code: "invalid_body", message: decoded.failure.message } },
              true,
            );
          }
          body = decoded.success;
        }
        const context: ApiRequestContext = {
          principal,
          actor: actorForPrincipal(principal),
          params,
          query,
          body,
        };
        const result = await runtime.runPromise(Effect.result(tool.endpoint.handler(context)));
        if (Result.isFailure(result)) {
          return textResult(
            {
              error: {
                code: errorCode(result.failure._tag),
                message: result.failure.message,
              },
            },
            true,
          );
        }
        return textResult(result.success ?? { ok: true });
      });

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      return await transport.handleRequest(innerRequest);
    } finally {
      await runtime.dispose();
    }
  });
  return await gated(request);
};
