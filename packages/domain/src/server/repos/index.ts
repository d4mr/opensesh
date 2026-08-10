import { Layer } from "effect";

import { makeDbLive } from "../db";
import { ContactsLive } from "./contacts";
import { CrmLive } from "./crm";
import { AgendaLive } from "./agenda";
import { EmailLogLive } from "./email-log";
import { EventsLive } from "./events";
import { FilesLive } from "./files";
import { FormsLive } from "./forms";
import { MailAdminLive } from "./mail-admin";
import { PortalFormsLive } from "./portal-forms";
import { PortalLive } from "./portal";
import { ReadModelsLive } from "./read-models";
import { ReviewsLive } from "./reviews";
import { ReviewDeskLive } from "./review-desk";
import { SubmissionsLive } from "./submissions";
import { SpeakerCommsLive } from "./speaker-comms";
import { TasksLive } from "./tasks";
import { WidgetsLive } from "./widgets";

import type { Contacts } from "./contacts";
import type { Crm } from "./crm";
import type { Agenda } from "./agenda";
import type { EmailLog } from "./email-log";
import type { Events } from "./events";
import type { Files } from "./files";
import type { Forms } from "./forms";
import type { MailAdmin } from "./mail-admin";
import type { PortalForms } from "./portal-forms";
import type { Portal } from "./portal";
import type { ReadModels } from "./read-models";
import type { Reviews } from "./reviews";
import type { ReviewDesk } from "./review-desk";
import type { Submissions } from "./submissions";
import type { SpeakerComms } from "./speaker-comms";
import type { Tasks } from "./tasks";
import type { Widgets } from "./widgets";

export * from "./contacts";
export * from "./crm";
export * from "./agenda";
export * from "./email-log";
export * from "./events";
export * from "./files";
export * from "./forms";
export * from "./mail-admin";
export * from "./portal-forms";
export * from "./portal";
export * from "./read-models";
export * from "./reviews";
export * from "./review-desk";
export * from "./submissions";
export * from "./speaker-comms";
export * from "./tasks";
export * from "./widgets";

export type RepositoryServices =
  | Agenda
  | Contacts
  | Crm
  | EmailLog
  | Events
  | Files
  | Forms
  | MailAdmin
  | PortalForms
  | Portal
  | ReadModels
  | Reviews
  | ReviewDesk
  | Submissions
  | SpeakerComms
  | Tasks
  | Widgets;

const RepositoriesLive = Layer.mergeAll(
  AgendaLive,
  ContactsLive,
  CrmLive,
  EmailLogLive,
  EventsLive,
  FilesLive,
  FormsLive,
  MailAdminLive,
  PortalFormsLive,
  PortalLive,
  ReadModelsLive,
  ReviewsLive,
  ReviewDeskLive,
  SubmissionsLive,
  SpeakerCommsLive,
  TasksLive,
  WidgetsLive,
);

export const makeRepositoriesLive = (connectionString: string) =>
  RepositoriesLive.pipe(Layer.provide(makeDbLive(connectionString)));

export const makeEventsLive = (connectionString: string) =>
  EventsLive.pipe(Layer.provide(makeDbLive(connectionString)));
