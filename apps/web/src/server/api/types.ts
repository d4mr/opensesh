import type { CurrentUser } from "@opensesh/domain/server/current-user";
import type { Mail } from "@opensesh/domain/server/mail";
import type { RepositoryServices } from "@opensesh/domain/server/repos";
import type { AppError } from "@opensesh/domain/server/runtime";
import type { Effect, Schema } from "effect";

// The org-scoped machine identity resolved from the bearer key. Every
// endpoint runs as an admin of the key's organization — event-level access
// still goes through requireEventAccess, so keys cannot cross tenants.
export interface ApiPrincipal {
  readonly organizationId: string;
  readonly keyId: string;
  readonly keyName: string;
}

export interface ApiRequestContext {
  readonly principal: ApiPrincipal;
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

// One entry describes an endpoint completely: the dispatcher validates and
// routes from it, and the OpenAPI document is generated from the same entry —
// a single source of truth, so the spec can never drift from the behavior.
export interface ApiEndpoint {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly path: string; // OpenAPI style: /events/{eventId}/submissions
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  readonly tag: string;
  readonly bodySchema?: Schema.ConstraintDecoder<unknown>;
  readonly queryParams?: ReadonlyArray<ApiQueryParam>;
  readonly successStatus?: 200 | 201 | 204;
  readonly handler: (context: ApiRequestContext) => Effect.Effect<unknown, AppError, ApiServices>;
}
