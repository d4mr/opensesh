import { ApiKeyCreateRequest, ApiKeyRevokeRequest } from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { ApiKeys, type ApiKeyView } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { apiKeyDisplayPrefix, generateApiKey, hashApiKey } from "@/server/api/keys";
import { runServer } from "@/server/runtime";

// Dates cross the server-fn boundary as strings so the client type is honest.
const toView = (key: ApiKeyView) => ({
  id: key.id,
  name: key.name,
  keyPrefix: key.keyPrefix,
  createdAt: key.createdAt.toISOString(),
  lastUsedAt: key.lastUsedAt === null ? null : key.lastUsedAt.toISOString(),
  createdByName: key.createdByName,
});

export const listApiKeys = createServerFn({ method: "GET" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const apiKeys = yield* ApiKeys;
      const keys = yield* apiKeys.list(user.orgId);
      return keys.map(toView);
    }),
    { require: "admin" },
  ),
);

export const createApiKey = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ApiKeyCreateRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const name = data.name.trim();
        if (name === "") {
          return yield* Effect.fail(new InvalidInput({ message: "Name this API key" }));
        }
        const user = yield* getCurrentUser;
        const token = generateApiKey();
        const keyHash = yield* Effect.promise(() => hashApiKey(token));
        const apiKeys = yield* ApiKeys;
        const key = yield* apiKeys.create({
          organizationId: user.orgId,
          name,
          keyHash,
          keyPrefix: apiKeyDisplayPrefix(token),
          createdByUserId: user.userId,
        });
        // The only moment the token exists in plaintext outside the caller.
        return { token, key: toView(key) };
      }),
      { require: "admin" },
    ),
  );

export const revokeApiKey = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ApiKeyRevokeRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const apiKeys = yield* ApiKeys;
        yield* apiKeys.revoke(user.orgId, data.keyId);
        return { revoked: true as const };
      }),
      { require: "admin" },
    ),
  );
