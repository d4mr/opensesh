import { Layer } from "effect";

import { makeDbLive } from "../db";
import { ContactsLive } from "./contacts";
import { AgendaLive } from "./agenda";
import { EmailLogLive } from "./email-log";
import { EventsLive } from "./events";
import { FilesLive } from "./files";
import { FormsLive } from "./forms";
import { PortalFormsLive } from "./portal-forms";
import { PortalLive } from "./portal";
import { ReadModelsLive } from "./read-models";
import { ReviewsLive } from "./reviews";
import { ReviewDeskLive } from "./review-desk";
import { SubmissionsLive } from "./submissions";
import { TasksLive } from "./tasks";

import type { Contacts } from "./contacts";
import type { Agenda } from "./agenda";
import type { EmailLog } from "./email-log";
import type { Events } from "./events";
import type { Files } from "./files";
import type { Forms } from "./forms";
import type { PortalForms } from "./portal-forms";
import type { Portal } from "./portal";
import type { ReadModels } from "./read-models";
import type { Reviews } from "./reviews";
import type { ReviewDesk } from "./review-desk";
import type { Submissions } from "./submissions";
import type { Tasks } from "./tasks";

export * from "./contacts";
export * from "./agenda";
export * from "./email-log";
export * from "./events";
export * from "./files";
export * from "./forms";
export * from "./portal-forms";
export * from "./portal";
export * from "./read-models";
export * from "./reviews";
export * from "./review-desk";
export * from "./submissions";
export * from "./tasks";

export type RepositoryServices =
  | Agenda
  | Contacts
  | EmailLog
  | Events
  | Files
  | Forms
  | PortalForms
  | Portal
  | ReadModels
  | Reviews
  | ReviewDesk
  | Submissions
  | Tasks;

const RepositoriesLive = Layer.mergeAll(
  AgendaLive,
  ContactsLive,
  EmailLogLive,
  EventsLive,
  FilesLive,
  FormsLive,
  PortalFormsLive,
  PortalLive,
  ReadModelsLive,
  ReviewsLive,
  ReviewDeskLive,
  SubmissionsLive,
  TasksLive,
);

export const makeRepositoriesLive = (connectionString: string) =>
  RepositoriesLive.pipe(Layer.provide(makeDbLive(connectionString)));

export const makeEventsLive = (connectionString: string) =>
  EventsLive.pipe(Layer.provide(makeDbLive(connectionString)));
