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

import type { Contacts } from "./contacts";
import type { EmailLog } from "./email-log";
import type { Events } from "./events";
import type { Files } from "./files";
import type { Forms } from "./forms";
import type { PortalForms } from "./portal-forms";
import type { Reviews } from "./reviews";
import type { Submissions } from "./submissions";
import type { Tasks } from "./tasks";

export * from "./contacts";
export * from "./email-log";
export * from "./events";
export * from "./files";
export * from "./forms";
export * from "./portal-forms";
export * from "./reviews";
export * from "./submissions";
export * from "./tasks";

export type RepositoryServices =
  | Contacts
  | EmailLog
  | Events
  | Files
  | Forms
  | PortalForms
  | Reviews
  | Submissions
  | Tasks;

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

export const makeRepositoriesLive = (connectionString: string) =>
  RepositoriesLive.pipe(Layer.provide(makeDbLive(connectionString)));

export const makeEventsLive = (connectionString: string) =>
  EventsLive.pipe(Layer.provide(makeDbLive(connectionString)));
