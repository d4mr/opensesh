import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { taskAssignments, taskTemplates } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import {
  TaskAssignment,
  type TaskAssignmentCreate,
  type TaskStatus,
  TaskTemplate,
  type TaskTemplateCreate,
  type TaskTemplateUpdate,
} from "../schema/portal";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface TasksService {
  readonly listTemplates: (eventId: string) => Effect.Effect<ReadonlyArray<TaskTemplate>, DbError>;
  readonly createTemplate: (input: TaskTemplateCreate) => Effect.Effect<TaskTemplate, DbError>;
  readonly updateTemplate: (
    id: string,
    input: TaskTemplateUpdate,
  ) => Effect.Effect<TaskTemplate, DbError | NotFound>;
  readonly assign: (input: TaskAssignmentCreate) => Effect.Effect<TaskAssignment, DbError>;
  readonly listAssignmentsByContact: (
    contactId: string,
  ) => Effect.Effect<ReadonlyArray<TaskAssignment>, DbError>;
  readonly listAssignmentsBySubmission: (
    submissionId: string,
  ) => Effect.Effect<ReadonlyArray<TaskAssignment>, DbError>;
  readonly updateAssignmentStatus: (
    id: string,
    status: TaskStatus,
  ) => Effect.Effect<TaskAssignment, DbError | NotFound>;
}

export class Tasks extends Context.Service<Tasks, TasksService>()("opensesh/Tasks") {}

export const TasksLive = Layer.effect(
  Tasks,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const listAssignments = (column: typeof taskAssignments.contactId, value: string) =>
      query(database, "Could not list task assignments", (db) =>
        db
          .select()
          .from(taskAssignments)
          .where(eq(column, value))
          .orderBy(asc(taskAssignments.createdAt))
          .execute(),
      ).pipe(Effect.flatMap((rows) => decodeMany(TaskAssignment, "task assignment", rows)));

    return {
      listTemplates: (eventId) =>
        query(database, "Could not list task templates", (db) =>
          db
            .select()
            .from(taskTemplates)
            .where(eq(taskTemplates.eventId, eventId))
            .orderBy(asc(taskTemplates.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(TaskTemplate, "task template", rows))),
      createTemplate: (input) =>
        query(database, "Could not create task template", (db) =>
          db.insert(taskTemplates).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(TaskTemplate, "task template", rows[0]))),
      updateTemplate: (id, input) =>
        query(database, "Could not update task template", (db) =>
          db
            .update(taskTemplates)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(taskTemplates.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(TaskTemplate, "Task template", rows[0]))),
      assign: (input) =>
        query(database, "Could not assign task", (db) =>
          db.insert(taskAssignments).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(TaskAssignment, "task assignment", rows[0]))),
      listAssignmentsByContact: (contactId) =>
        listAssignments(taskAssignments.contactId, contactId),
      listAssignmentsBySubmission: (submissionId) =>
        query(database, "Could not list task assignments", (db) =>
          db
            .select()
            .from(taskAssignments)
            .where(eq(taskAssignments.submissionId, submissionId))
            .orderBy(asc(taskAssignments.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(TaskAssignment, "task assignment", rows))),
      updateAssignmentStatus: (id, status) => {
        const completedAt = status === "done" ? new Date() : null;
        return query(database, "Could not update task assignment", (db) =>
          db
            .update(taskAssignments)
            .set({ status, completedAt, updatedAt: new Date() })
            .where(eq(taskAssignments.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(TaskAssignment, "Task assignment", rows[0])));
      },
    };
  }),
);
