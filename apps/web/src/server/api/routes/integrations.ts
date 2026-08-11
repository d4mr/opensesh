import { requireEventAccess } from "@opensesh/domain/server/current-user";
import {
  ACCELEVENTS_PROVIDER,
  parseAcceleventsConfig,
  syncAccelevents,
} from "@opensesh/domain/server/integrations/accelevents";
import { Integrations } from "@opensesh/domain/server/repos";
import { Effect, Schema } from "effect";

import type { ApiEndpoint } from "../types";

const SaveBody = Schema.Struct({
  eventUrl: Schema.String,
  // null keeps the previously stored key.
  apiKey: Schema.NullOr(Schema.String),
  importAttendees: Schema.Boolean,
});

const maskKey = (apiKey: string) =>
  apiKey === "" ? null : `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;

export const integrationEndpoints: ReadonlyArray<ApiEndpoint> = [
  {
    method: "GET",
    path: "/events/{eventId}/integrations/accelevents",
    operationId: "getAcceleventsIntegration",
    summary: "Get the Accelevents connection",
    description: "The stored API key never round-trips — only its masked prefix.",
    tag: "Integrations",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const integrations = yield* Integrations;
        const stored = yield* integrations.getByEvent(access.event.id, ACCELEVENTS_PROVIDER);
        if (stored === null) return { connected: false };
        const config = parseAcceleventsConfig(stored.config);
        return {
          connected: config.apiKey !== "",
          eventUrl: config.eventUrl,
          apiKeyPreview: maskKey(config.apiKey),
          importAttendees: config.importAttendees,
          lastSyncedAt: stored.lastSyncedAt?.toISOString() ?? null,
          lastResult: stored.lastResult,
        };
      }),
  },
  {
    method: "PUT",
    path: "/events/{eventId}/integrations/accelevents",
    operationId: "saveAcceleventsIntegration",
    summary: "Connect or update Accelevents",
    description:
      'Set apiKey to the literal "demo-accelevents-key" with eventUrl "demo" to use the bundled demo connection.',
    tag: "Integrations",
    bodySchema: SaveBody,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof SaveBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const integrations = yield* Integrations;
        const existing = yield* integrations.getByEvent(access.event.id, ACCELEVENTS_PROVIDER);
        const previous = existing === null ? null : parseAcceleventsConfig(existing.config);
        const apiKey = body.apiKey === null ? (previous?.apiKey ?? "") : body.apiKey.trim();
        const stored = yield* integrations.upsert(access.event.id, ACCELEVENTS_PROVIDER, {
          eventUrl: body.eventUrl.trim(),
          apiKey,
          importAttendees: body.importAttendees,
        });
        const config = parseAcceleventsConfig(stored.config);
        return {
          connected: config.apiKey !== "",
          eventUrl: config.eventUrl,
          apiKeyPreview: maskKey(config.apiKey),
          importAttendees: config.importAttendees,
        };
      }),
  },
  {
    method: "POST",
    path: "/events/{eventId}/integrations/accelevents/sync",
    operationId: "syncAccelevents",
    summary: "Run a one-way Accelevents sync",
    description:
      "Pulls speakers (linked to the event with full profiles) and optionally attendees (tagged CRM contacts). Idempotent by email; nothing is ever written back to Accelevents.",
    tag: "Integrations",
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        return yield* syncAccelevents(context.principal.organizationId, access.event.id);
      }),
  },
];
