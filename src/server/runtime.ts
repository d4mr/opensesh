import { Effect, Match } from "effect"

import { DbLive, type Db } from "@/server/db"
import type { DbError, NotFound } from "@/server/errors"

type AppError = DbError | NotFound

export type ServerResult<A> =
  | { readonly ok: true; readonly data: A }
  | { readonly ok: false; readonly error: { readonly status: number; readonly message: string } }

const toServerError = Match.type<AppError>().pipe(
  Match.tag("DbError", (error) => ({ status: 500, message: error.message })),
  Match.tag("NotFound", (error) => ({ status: 404, message: error.message })),
  Match.exhaustive,
)

export const run = <A>(program: Effect.Effect<A, AppError, Db>) =>
  Effect.runPromise(
    program.pipe(
      Effect.provide(DbLive),
      Effect.match({
        onFailure: (error): ServerResult<A> => ({ ok: false, error: toServerError(error) }),
        onSuccess: (data): ServerResult<A> => ({ ok: true, data }),
      }),
    ),
  )
