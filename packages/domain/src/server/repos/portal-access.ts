import { Context, Effect, Layer } from "effect";

import { verifications } from "../../db/auth";
import { Db } from "../db";
import type { DbError } from "../errors";
import { mintPortalAccess, type PortalAccessMint } from "../portal-access";
import { query } from "./shared";

interface PortalAccessService {
  /** Store a portal access token and return the tokened URL for the email. */
  readonly mint: (input: PortalAccessMint) => Effect.Effect<string, DbError>;
}

export class PortalAccess extends Context.Service<PortalAccess, PortalAccessService>()(
  "opensesh/PortalAccess",
) {}

export const PortalAccessLive = Layer.effect(
  PortalAccess,
  Effect.gen(function* () {
    const { database } = yield* Db;
    return {
      mint: (input) =>
        query(database, "Could not create portal access link", async (db) => {
          const minted = await mintPortalAccess(input);
          await db.insert(verifications).values(minted.verification).execute();
          return minted.url;
        }),
    };
  }),
);
