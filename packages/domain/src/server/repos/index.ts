import { Layer } from "effect";

import { type Db, makeDbLive } from "../db";
import { ContactsLive } from "./contacts";
import { CrmLive } from "./crm";
import { AgendaLive } from "./agenda";
import { ApiKeysLive } from "./api-keys";
import { EmailLogLive } from "./email-log";
import { EventsLive } from "./events";
import { FilesLive } from "./files";
import { FormsLive } from "./forms";
import { IntegrationsLive } from "./integrations";
import { MailAdminLive } from "./mail-admin";
import { OrganizationLive } from "./organization";
import { PortalFormsLive } from "./portal-forms";
import { PortalLive } from "./portal";
import { ReadModelsLive } from "./read-models";
import { ReviewsLive } from "./reviews";
import { ReviewDeskLive } from "./review-desk";
import { SessionsLive } from "./sessions";
import { SubmissionsLive } from "./submissions";
import { SpeakerCommsLive } from "./speaker-comms";
import { TasksLive } from "./tasks";
import { WidgetsLive } from "./widgets";

import type { Contacts } from "./contacts";
import type { Crm } from "./crm";
import type { Agenda } from "./agenda";
import type { ApiKeys } from "./api-keys";
import type { EmailLog } from "./email-log";
import type { Events } from "./events";
import type { Files } from "./files";
import type { Forms } from "./forms";
import type { Integrations } from "./integrations";
import type { MailAdmin } from "./mail-admin";
import type { Organization } from "./organization";
import type { PortalForms } from "./portal-forms";
import type { Portal } from "./portal";
import type { ReadModels } from "./read-models";
import type { Reviews } from "./reviews";
import type { ReviewDesk } from "./review-desk";
import type { Sessions } from "./sessions";
import type { Submissions } from "./submissions";
import type { SpeakerComms } from "./speaker-comms";
import type { Tasks } from "./tasks";
import type { Widgets } from "./widgets";

export * from "./contacts";
export * from "./crm";
export * from "./agenda";
export * from "./api-keys";
export * from "./email-log";
export * from "./events";
export * from "./files";
export * from "./forms";
export * from "./integrations";
export * from "./mail-admin";
export * from "./organization";
export * from "./portal-forms";
export * from "./portal";
export * from "./read-models";
export * from "./reviews";
export * from "./review-desk";
export * from "./sessions";
export * from "./submissions";
export * from "./speaker-comms";
export * from "./tasks";
export * from "./widgets";

export type RepositoryServices =
  | Agenda
  | ApiKeys
  | Contacts
  | Crm
  | EmailLog
  | Events
  | Files
  | Forms
  | Integrations
  | MailAdmin
  | Organization
  | PortalForms
  | Portal
  | ReadModels
  | Reviews
  | ReviewDesk
  | Sessions
  | Submissions
  | SpeakerComms
  | Tasks
  | Widgets;

const EventsAndReadModelsLive = ReadModelsLive.pipe(Layer.provideMerge(EventsLive));

const RepositoriesLive = Layer.mergeAll(
  AgendaLive,
  ApiKeysLive,
  ContactsLive,
  CrmLive,
  EmailLogLive,
  EventsAndReadModelsLive,
  FilesLive,
  FormsLive,
  IntegrationsLive,
  MailAdminLive,
  OrganizationLive,
  PortalFormsLive,
  PortalLive,
  ReviewsLive,
  ReviewDeskLive,
  SessionsLive,
  SubmissionsLive,
  SpeakerCommsLive,
  TasksLive,
  WidgetsLive,
);

export const makeRepositoriesLive = (connectionString: string) =>
  RepositoriesLive.pipe(Layer.provide(makeDbLive(connectionString)));

// Accepts a shared Db layer so one Postgres client (one connection setup)
// serves repositories and CurrentUser alike within a request.
export const makeRepositoriesLiveWith = (dbLive: Layer.Layer<Db>) =>
  RepositoriesLive.pipe(Layer.provide(dbLive));

export const makeEventsLive = (connectionString: string) =>
  EventsLive.pipe(Layer.provide(makeDbLive(connectionString)));
