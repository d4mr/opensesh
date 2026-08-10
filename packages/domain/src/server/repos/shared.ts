import { Effect, Schema } from "effect";

import type { Database } from "../db";
import { DbError, NotFound } from "../errors";

export const query = <A>(
  database: Database,
  message: string,
  execute: (database: Database) => Promise<A>,
) =>
  Effect.tryPromise({
    try: () => execute(database),
    catch: (cause) => new DbError({ message, cause }),
  });

export const decode = <S extends Schema.Top>(schema: S, entity: string, row: unknown) =>
  Schema.decodeUnknownEffect(schema)(row).pipe(
    Effect.mapError((cause) => new DbError({ message: `Stored ${entity} data is invalid`, cause })),
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
