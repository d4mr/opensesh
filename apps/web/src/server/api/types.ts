import type { CurrentUser } from "@opensesh/domain/server/current-user";
import type { Mail } from "@opensesh/domain/server/mail";
import type { RepositoryServices } from "@opensesh/domain/server/repos";
import type { AppError } from "@opensesh/domain/server/runtime";
import type { AuditActor } from "@opensesh/domain/server/schema/common";
import type { Effect, Schema } from "effect";

// The identity behind the request. API keys are org-scoped machine
// identities that run as an admin of the key's organization; user principals
// (MCP sessions) carry the signed-in user, whose real memberships decide
// access. Either way event-level checks go through requireEventAccess, so no
// principal crosses tenants.
export type ApiPrincipal =
  | {
      readonly kind: "api_key";
      readonly organizationId: string;
      readonly keyId: string;
      readonly keyName: string;
    }
  | {
      readonly kind: "user";
      readonly organizationId: string;
      readonly userId: string;
      readonly name: string;
    };

export const actorForPrincipal = (principal: ApiPrincipal): AuditActor =>
  principal.kind === "api_key"
    ? { kind: "api_key", apiKeyId: principal.keyId, name: `API key: ${principal.keyName}` }
    : { kind: "user", userId: principal.userId, name: principal.name };

export interface ApiRequestContext {
  readonly principal: ApiPrincipal;
  // Derived from the principal once per request — what mutations record in
  // timelines and audit logs.
  readonly actor: AuditActor;
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  // Decoded against bodySchema before the handler runs (unknown when absent).
  readonly body: unknown;
}

export type ApiServices = RepositoryServices | CurrentUser | Mail;

export interface ApiQueryParam {
  readonly name: string;
  readonly description: string;
  readonly required?: boolean;
}

// Overrides the default description for a path parameter (openapi.ts carries
// the defaults) — for routes where a shared name needs route-specific framing,
// like {submissionId} on Sessions endpoints.
export interface ApiPathParam {
  readonly name: string;
  readonly description: string;
}

// One entry describes an endpoint completely: the dispatcher validates and
// routes from it, and the OpenAPI document is generated from the same entry —
// a single source of truth, so the spec can never drift from the behavior.
export interface ApiEndpoint<A = unknown> {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly path: string; // OpenAPI style: /events/{eventId}/submissions
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  readonly tag: string;
  readonly bodySchema?: Schema.ConstraintDecoder<unknown>;
  readonly queryParams?: ReadonlyArray<ApiQueryParam>;
  readonly pathParams?: ReadonlyArray<ApiPathParam>;
  readonly successStatus?: 200 | 201 | 204;
  readonly successSchema: Schema.ConstraintDecoder<A>;
  readonly handler: (
    context: ApiRequestContext,
  ) => Effect.Effect<NoInfer<A>, AppError, ApiServices>;
}

// Pins the endpoint's success payload to its schema: A is inferred from
// successSchema alone, so the handler must return (at least) what the schema
// documents — a field the spec claims but the handler omits is a type error.
export const endpoint = <A>(definition: ApiEndpoint<A>): ApiEndpoint => definition;
