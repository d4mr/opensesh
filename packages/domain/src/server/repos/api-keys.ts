import { and, desc, eq, isNull } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { apiKeys, users } from "../../db/schema";
import { Db } from "../db";
import { NotFound, type DbError } from "../errors";
import { query } from "./shared";

// What the settings UI sees. The token itself is shown exactly once at
// creation and never stored — only its hash and display prefix persist.
export interface ApiKeyView {
  readonly id: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly createdByName: string | null;
}

interface ApiKeysService {
  readonly list: (organizationId: string) => Effect.Effect<ReadonlyArray<ApiKeyView>, DbError>;
  readonly create: (input: {
    readonly organizationId: string;
    readonly name: string;
    readonly keyHash: string;
    readonly keyPrefix: string;
    readonly createdByUserId: string;
  }) => Effect.Effect<ApiKeyView, DbError>;
  readonly revoke: (
    organizationId: string,
    keyId: string,
  ) => Effect.Effect<void, DbError | NotFound>;
}

export class ApiKeys extends Context.Service<ApiKeys, ApiKeysService>()("opensesh/ApiKeys") {}

export const ApiKeysLive = Layer.effect(
  ApiKeys,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      list: (organizationId) =>
        query(database, "Could not load API keys", (db) =>
          db
            .select({
              id: apiKeys.id,
              name: apiKeys.name,
              keyPrefix: apiKeys.keyPrefix,
              createdAt: apiKeys.createdAt,
              lastUsedAt: apiKeys.lastUsedAt,
              createdByName: users.name,
            })
            .from(apiKeys)
            .leftJoin(users, eq(users.id, apiKeys.createdByUserId))
            .where(and(eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt)))
            .orderBy(desc(apiKeys.createdAt))
            .execute(),
        ),
      create: (input) =>
        query(database, "Could not create the API key", (db) =>
          db
            .insert(apiKeys)
            .values({
              organizationId: input.organizationId,
              name: input.name,
              keyHash: input.keyHash,
              keyPrefix: input.keyPrefix,
              createdByUserId: input.createdByUserId,
            })
            .returning({
              id: apiKeys.id,
              name: apiKeys.name,
              keyPrefix: apiKeys.keyPrefix,
              createdAt: apiKeys.createdAt,
              lastUsedAt: apiKeys.lastUsedAt,
            })
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows[0] === undefined
              ? Effect.die(new Error("insert returned no row"))
              : Effect.succeed({ ...rows[0], createdByName: null }),
          ),
        ),
      revoke: (organizationId, keyId) =>
        query(database, "Could not revoke the API key", (db) =>
          db
            .update(apiKeys)
            .set({ revokedAt: new Date() })
            .where(
              and(
                eq(apiKeys.id, keyId),
                eq(apiKeys.organizationId, organizationId),
                isNull(apiKeys.revokedAt),
              ),
            )
            .returning({ id: apiKeys.id })
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows.length === 0
              ? Effect.fail(new NotFound({ message: "This API key no longer exists" }))
              : Effect.void,
          ),
        ),
    };
  }),
);
