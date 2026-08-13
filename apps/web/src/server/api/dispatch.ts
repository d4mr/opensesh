import {
  apiKeys,
  events as eventsTable,
  organizations as organizationsTable,
} from "@opensesh/domain/db/schema";
import {
  type CurrentUserValue,
  makeCurrentUserFromValueLive,
} from "@opensesh/domain/server/current-user";
import { Db, makeDatabase } from "@opensesh/domain/server/db";
import { makeRepositoriesLiveWith } from "@opensesh/domain/server/repos";
import type { AppError } from "@opensesh/domain/server/runtime";
import { asc, eq, isNull, and } from "drizzle-orm";
import { ConfigProvider, Effect, Layer, ManagedRuntime, Result, Schema } from "effect";

import { mailLayerFromEnv } from "../mail-layer";
import { makeMailQueueLive } from "../mail-queue";
import { hashApiKey } from "./keys";
import {
  actorForPrincipal,
  type ApiEndpoint,
  type ApiPrincipal,
  type ApiRequestContext,
} from "./types";

// ---------------------------------------------------------------------------
// Error envelope. Success responses return the resource JSON directly; every
// failure is { error: { code, message } } with the matching HTTP status.
// ---------------------------------------------------------------------------

const STATUS_BY_TAG: Record<string, number> = {
  AgendaGenerationError: 502,
  AlreadyDecided: 409,
  AlreadyRecused: 409,
  AssignmentCapExceeded: 409,
  BlindDataAccess: 403,
  DbError: 500,
  DropdownValueNotInOptions: 400,
  DuplicateMerge: 409,
  NotFound: 404,
  FormClosed: 409,
  IntegrationError: 502,
  InvalidInput: 400,
  InvalidPipelineMove: 409,
  NumericOutOfBounds: 400,
  OrganizationLastOwner: 409,
  OrganizationMemberNotFound: 404,
  OrganizationSelfDemotion: 409,
  ReviewGenerationError: 502,
  RoundClosed: 409,
  SubmissionLimitReached: 409,
  ScheduleConflict: 409,
  ResourceInUse: 409,
  Unauthenticated: 401,
  Forbidden: 403,
  MailError: 502,
  NeedsFirstEvent: 409,
  NeedsOrganization: 428,
};

export const errorCode = (tag: string) =>
  tag.replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

export const jsonResponse = (body: unknown, status = 200, headers?: Record<string, string>) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const errorResponse = (status: number, code: string, message: string) =>
  jsonResponse({ error: { code, message } }, status);

const appErrorResponse = (error: AppError) =>
  errorResponse(STATUS_BY_TAG[error._tag] ?? 500, errorCode(error._tag), error.message);

// ---------------------------------------------------------------------------
// Authentication: Authorization: Bearer osk_… → org principal. The key's
// organization becomes the tenant; the synthesized CurrentUserValue makes the
// principal an org admin, and requireEventAccess still gates per event.
// ---------------------------------------------------------------------------

interface ResolvedPrincipal {
  readonly principal: ApiPrincipal;
  readonly user: CurrentUserValue;
}

const resolvePrincipal = async (
  database: ReturnType<typeof makeDatabase>,
  request: Request,
): Promise<ResolvedPrincipal | Response> => {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (token === "") {
    return errorResponse(
      401,
      "missing_api_key",
      "Provide an API key: Authorization: Bearer osk_… (create one in Organization settings → API keys)",
    );
  }
  const keyHash = await hashApiKey(token);
  const [key] = await database
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1)
    .execute();
  if (key === undefined) {
    return errorResponse(401, "invalid_api_key", "This API key is unknown or has been revoked");
  }
  const [organization] = await database
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, key.organizationId))
    .limit(1)
    .execute();
  if (organization === undefined) {
    return errorResponse(401, "invalid_api_key", "The key's organization no longer exists");
  }
  const orgEvents = await database
    .select({ id: eventsTable.id, slug: eventsTable.slug })
    .from(eventsTable)
    .where(eq(eventsTable.organizationId, key.organizationId))
    .orderBy(asc(eventsTable.startsAt))
    .execute();
  // Best effort; a failed touch must not fail the request.
  void database
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .execute()
    .catch(() => undefined);
  return {
    principal: {
      kind: "api_key",
      organizationId: key.organizationId,
      keyId: key.id,
      keyName: key.name,
    },
    user: {
      userId: key.createdByUserId,
      email: "",
      name: `API key: ${key.name}`,
      orgId: key.organizationId,
      organizationName: organization.name,
      organizationLogo: null,
      eventSlug: orgEvents[0]?.slug ?? null,
      orgRole: "admin",
      events: orgEvents.map((event) => ({ id: event.id, slug: event.slug, memberRole: null })),
      roles: { admin: true, reviewer: false, member: true },
    },
  };
};

// ---------------------------------------------------------------------------
// Path matching: /events/{eventId}/submissions ↔ /events/evt_1/submissions.
// ---------------------------------------------------------------------------

const matchPath = (template: string, actual: string): Record<string, string> | null => {
  const templateParts = template.split("/").filter((part) => part !== "");
  const actualParts = actual.split("/").filter((part) => part !== "");
  if (templateParts.length !== actualParts.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < templateParts.length; index += 1) {
    const templatePart = templateParts[index];
    const actualPart = actualParts[index];
    if (templatePart === undefined || actualPart === undefined) return null;
    if (templatePart.startsWith("{") && templatePart.endsWith("}")) {
      params[templatePart.slice(1, -1)] = decodeURIComponent(actualPart);
    } else if (templatePart !== actualPart) {
      return null;
    }
  }
  return params;
};

// ---------------------------------------------------------------------------
// Dispatcher. One runtime per API request: Db + repos + synthesized
// CurrentUser + mail + config, mirroring the session runtime's layers.
// ---------------------------------------------------------------------------

export const dispatchApiRequest = async (
  endpoints: ReadonlyArray<ApiEndpoint>,
  request: Request,
  subPath: string,
): Promise<Response> => {
  const method = request.method.toUpperCase();
  const candidates = endpoints.filter((endpoint) => {
    return matchPath(endpoint.path, subPath) !== null;
  });
  if (candidates.length === 0) {
    return errorResponse(
      404,
      "unknown_endpoint",
      `No endpoint matches ${method} /api/v1${subPath}`,
    );
  }
  const endpoint = candidates.find((candidate) => candidate.method === method);
  if (endpoint === undefined) {
    const allowed = candidates.map((candidate) => candidate.method).join(", ");
    return jsonResponse(
      { error: { code: "method_not_allowed", message: `Use ${allowed} for this endpoint` } },
      405,
      { allow: allowed },
    );
  }
  const params = matchPath(endpoint.path, subPath) ?? {};

  const { env } = await import("cloudflare:workers");
  const database = makeDatabase(env.HYPERDRIVE.connectionString);
  const resolved = await resolvePrincipal(database, request);
  if (resolved instanceof Response) return resolved;

  let body: unknown;
  if (endpoint.bodySchema !== undefined) {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return errorResponse(400, "invalid_json", "The request body is not valid JSON");
    }
    const decoded = Schema.decodeUnknownResult(endpoint.bodySchema)(raw);
    if (Result.isFailure(decoded)) {
      return errorResponse(400, "invalid_body", decoded.failure.message);
    }
    body = decoded.success;
  }

  const context: ApiRequestContext = {
    principal: resolved.principal,
    actor: actorForPrincipal(resolved.principal),
    params,
    query: new URL(request.url).searchParams,
    body,
  };

  const dbLive = Layer.succeed(Db, { database });
  const services = Layer.mergeAll(
    makeRepositoriesLiveWith(dbLive),
    makeCurrentUserFromValueLive(resolved.user),
    mailLayerFromEnv(env),
    makeMailQueueLive(env.MAIL_QUEUE),
    ConfigProvider.layer(
      ConfigProvider.fromEnvRecord({ ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY }),
    ),
  );
  const runtime = ManagedRuntime.make(services);
  try {
    const outcome = await runtime.runPromise(Effect.result(endpoint.handler(context)));
    if (Result.isFailure(outcome)) return appErrorResponse(outcome.failure);
    if (outcome.success instanceof Response) return outcome.success;
    // A 204 must not carry a body — Response throws on one, even "null".
    if (endpoint.successStatus === 204) return new Response(null, { status: 204 });
    return jsonResponse(outcome.success, endpoint.successStatus ?? 200);
  } catch (cause) {
    console.error("api: unhandled failure", cause);
    return errorResponse(500, "internal_error", "Something went wrong handling this request");
  } finally {
    await runtime.dispose();
  }
};
