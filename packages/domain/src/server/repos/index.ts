import { Layer } from "effect";

import { makeDbLive } from "../db";
import { ContactsLive } from "./contacts";
import { EmailLogLive } from "./email-log";
import { EventsLive } from "./events";
import { FilesLive } from "./files";
import { FormsLive } from "./forms";
import { PortalFormsLive } from "./portal-forms";
import { ReviewsLive } from "./reviews";
import { SubmissionsLive } from "./submissions";
import { TasksLive } from "./tasks";

export * from "./contacts";
export * from "./email-log";
export * from "./events";
export * from "./files";
export * from "./forms";
export * from "./portal-forms";
export * from "./reviews";
export * from "./submissions";
export * from "./tasks";

const RepositoriesLive = Layer.mergeAll(
  ContactsLive,
  EmailLogLive,
  EventsLive,
  FilesLive,
  FormsLive,
  PortalFormsLive,
  ReviewsLive,
  SubmissionsLive,
  TasksLive,
);

export const makeRepositoriesLive = (database: D1Database) =>
  RepositoriesLive.pipe(Layer.provide(makeDbLive(database)));

export const makeEventsLive = (database: D1Database) =>
  EventsLive.pipe(Layer.provide(makeDbLive(database)));
