import {
  type AcceleventsSyncReport,
  type EventIntegrationView,
  IntegrationSettingsRequest,
  RunIntegrationSyncRequest,
  SaveIntegrationRequest,
} from "@opensesh/domain";
import {
  ACCELEVENTS_PROVIDER,
  parseAcceleventsConfig,
  syncAccelevents,
} from "@opensesh/domain/server/integrations/accelevents";
import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { Integrations, type StoredIntegration } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const maskKey = (apiKey: string) =>
  apiKey === "" ? null : `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;

const toView = (stored: StoredIntegration | null): EventIntegrationView | null => {
  if (stored === null) return null;
  const config = parseAcceleventsConfig(stored.config);
  return {
    provider: "accelevents",
    eventUrl: config.eventUrl,
    hasApiKey: config.apiKey !== "",
    apiKeyPreview: maskKey(config.apiKey),
    importAttendees: config.importAttendees,
    lastSyncedAt: stored.lastSyncedAt === null ? null : stored.lastSyncedAt.toISOString(),
    lastResult: stored.lastResult as AcceleventsSyncReport | null,
  };
};

export const getIntegration = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(IntegrationSettingsRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const integrations = yield* Integrations;
        const stored = yield* integrations.getByEvent(data.eventId, ACCELEVENTS_PROVIDER);
        return toView(stored);
      }),
      { require: "staff" },
    ),
  );

export const saveIntegration = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SaveIntegrationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireEventAccess(data.eventId, "admin");
        const integrations = yield* Integrations;
        const existing = yield* integrations.getByEvent(data.eventId, ACCELEVENTS_PROVIDER);
        const previous = existing === null ? null : parseAcceleventsConfig(existing.config);
        // null apiKey = keep the stored one; the client never sees it back.
        const apiKey = data.apiKey === null ? (previous?.apiKey ?? "") : data.apiKey.trim();
        const stored = yield* integrations.upsert(data.eventId, ACCELEVENTS_PROVIDER, {
          eventUrl: data.eventUrl.trim(),
          apiKey,
          importAttendees: data.importAttendees,
        });
        return toView(stored);
      }),
      { require: "staff" },
    ),
  );

export const runIntegrationSync = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(RunIntegrationSyncRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const access = yield* requireEventAccess(data.eventId, "admin");
        return yield* syncAccelevents(access.user.orgId, data.eventId);
      }),
      { require: "staff" },
    ),
  );
