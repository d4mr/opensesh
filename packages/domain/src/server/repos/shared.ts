import { Effect, Schema } from "effect";

import type { Database } from "../db";
import { DbError, NotFound } from "../errors";

// The client envelope only carries the generic operation label; the underlying
// cause must reach Worker logs here or nowhere.
export const query = <A>(
  database: Database,
  message: string,
  execute: (database: Database) => Promise<A>,
) =>
  Effect.tryPromise({
    try: () => execute(database),
    catch: (cause) => new DbError({ message, cause }),
  }).pipe(Effect.tapError((error) => Effect.logError(`db: ${message}`, error.cause)));

export const decode = <S extends Schema.Top>(schema: S, entity: string, row: unknown) =>
  Schema.decodeUnknownEffect(schema)(row).pipe(
    Effect.mapError((cause) => new DbError({ message: `Stored ${entity} data is invalid`, cause })),
    Effect.tapError((error) => Effect.logError(`decode: ${entity}`, error.cause)),
  );

export const decodeMany = <S extends Schema.Top>(
  schema: S,
  entity: string,
  rows: ReadonlyArray<unknown>,
) => Effect.all(rows.map((row) => decode(schema, entity, row)));

export const decodeFound = <S extends Schema.Top>(schema: S, entity: string, row: unknown) =>
  Effect.gen(function* () {
    if (row === undefined) {
      return yield* Effect.fail(new NotFound({ message: `${entity} not found` }));
    }

    return yield* decode(schema, entity, row);
  });
