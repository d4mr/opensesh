import { Effect, type Schema } from "effect";

import { IntegrationError, InvalidInput } from "../errors";
import { Crm } from "../repos/crm";
import { Integrations } from "../repos/integrations";
import type { CrmCsvContact } from "../schema/crm";
import type { AcceleventsOutcome, AcceleventsSyncReport } from "../schema/integrations";
import {
  type AccelAttendee,
  type AccelAttendeesPage,
  type AccelSpeaker,
  type AccelSpeakersPage,
  demoAttendeesPage,
  demoSpeakersPage,
} from "./accelevents-fixtures";

export const ACCELEVENTS_PROVIDER = "accelevents";
export const ACCELEVENTS_DEMO_KEY = "demo-accelevents-key";
const BASE_URL = "https://api.accelevents.com";
const PAGE_SIZE = 100;
const ATTENDEE_TAG = "Accelevents attendee";

export interface AcceleventsConfig {
  readonly eventUrl: string;
  readonly apiKey: string;
  readonly importAttendees: boolean;
}

export const parseAcceleventsConfig = (
  config: Readonly<Record<string, Schema.Json>>,
): AcceleventsConfig => ({
  eventUrl: typeof config.eventUrl === "string" ? config.eventUrl : "",
  apiKey: typeof config.apiKey === "string" ? config.apiKey : "",
  importAttendees: config.importAttendees === true,
});

// ---------------------------------------------------------------------------
// Client. The demo key serves bundled fixtures shaped exactly like the real
// responses, so the whole flow runs without an Accelevents account.
// ---------------------------------------------------------------------------

const fetchJson = (url: string, apiKey: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url, { headers: { Key: apiKey, Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Accelevents responded ${response.status} for ${new URL(url).pathname}`);
      }
      return (await response.json()) as unknown;
    },
    catch: (cause) =>
      new IntegrationError({
        message: cause instanceof Error ? cause.message : "Accelevents request failed",
      }),
  });

const fetchSpeakers = (
  config: AcceleventsConfig,
): Effect.Effect<ReadonlyArray<AccelSpeaker>, IntegrationError> => {
  if (config.apiKey === ACCELEVENTS_DEMO_KEY) return Effect.succeed(demoSpeakersPage.data);
  const collect = (
    page: number,
    acc: ReadonlyArray<AccelSpeaker>,
  ): Effect.Effect<ReadonlyArray<AccelSpeaker>, IntegrationError> =>
    fetchJson(
      `${BASE_URL}/rest/host/event/${encodeURIComponent(config.eventUrl)}/speaker?page=${page}&size=${PAGE_SIZE}&expand=SPEAKER`,
      config.apiKey,
    ).pipe(
      Effect.flatMap((raw) => {
        const body = raw as AccelSpeakersPage;
        // Array.isArray narrows ReadonlyArray to any[]; keep the element type.
        const data: ReadonlyArray<AccelSpeaker> = Array.isArray(body.data) ? body.data : [];
        const next: ReadonlyArray<AccelSpeaker> = [...acc, ...data];
        return data.length < PAGE_SIZE || next.length >= body.recordsTotal
          ? Effect.succeed(next)
          : collect(page + 1, next);
      }),
    );
  return collect(0, []);
};

const fetchAttendees = (
  config: AcceleventsConfig,
): Effect.Effect<ReadonlyArray<AccelAttendee>, IntegrationError> => {
  if (config.apiKey === ACCELEVENTS_DEMO_KEY) return Effect.succeed(demoAttendeesPage.attendees);
  const collect = (
    page: number,
    acc: ReadonlyArray<AccelAttendee>,
  ): Effect.Effect<ReadonlyArray<AccelAttendee>, IntegrationError> =>
    fetchJson(
      `${BASE_URL}/rest/events/${encodeURIComponent(config.eventUrl)}/staff/allAttendees?page=${page}&size=${PAGE_SIZE}`,
      config.apiKey,
    ).pipe(
      Effect.flatMap((raw) => {
        const body = raw as AccelAttendeesPage;
        const data: ReadonlyArray<AccelAttendee> = Array.isArray(body.attendees)
          ? body.attendees
          : [];
        const next: ReadonlyArray<AccelAttendee> = [...acc, ...data];
        return data.length < PAGE_SIZE || next.length >= body.recordsTotal
          ? Effect.succeed(next)
          : collect(page + 1, next);
      }),
    );
  return collect(0, []);
};

// ---------------------------------------------------------------------------
// Sync orchestration (one-way: Accelevents → opensesh, never back).
// ---------------------------------------------------------------------------

const outcomeOf = (result: {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
}): AcceleventsOutcome => ({
  created: result.created,
  updated: result.updated,
  skipped: result.skipped,
});

const speakerRow = (speaker: AccelSpeaker): CrmCsvContact => ({
  firstName: speaker.firstName.trim(),
  lastName: speaker.lastName.trim(),
  email: speaker.email.trim().toLowerCase(),
  title: speaker.title?.trim() || null,
  company: speaker.company?.trim() || null,
  bio: speaker.bio?.trim() || null,
});

const attendeeRow = (attendee: AccelAttendee): CrmCsvContact => ({
  firstName: attendee.firstName.trim(),
  lastName: attendee.lastName.trim(),
  email: attendee.email.trim().toLowerCase(),
  title: null,
  company: null,
  bio: null,
});

const usable = (row: CrmCsvContact) =>
  row.firstName !== "" && row.lastName !== "" && row.email.includes("@");

export const syncAccelevents = (organizationId: string, eventId: string) =>
  Effect.gen(function* () {
    const integrations = yield* Integrations;
    const crm = yield* Crm;

    const stored = yield* integrations.getByEvent(eventId, ACCELEVENTS_PROVIDER);
    if (stored === null) {
      return yield* Effect.fail(
        new InvalidInput({ message: "Connect Accelevents before running a sync" }),
      );
    }
    const config = parseAcceleventsConfig(stored.config);
    if (config.eventUrl === "" || config.apiKey === "") {
      return yield* Effect.fail(
        new InvalidInput({ message: "Add the Accelevents event URL and API key first" }),
      );
    }

    // Speakers: full-profile import, linked to this event as speakers.
    const speakers = yield* fetchSpeakers(config);
    const speakerRows = speakers.map(speakerRow).filter(usable);
    const speakerResult = yield* crm.importContacts(organizationId, speakerRows, "update");
    const speakerIds = yield* integrations.contactIdsByEmails(
      organizationId,
      speakerRows.map((row) => row.email),
    );
    const byEmail = new Map(
      speakers.map((speaker) => [speaker.email.trim().toLowerCase(), speaker]),
    );
    // Enrich fields the CSV seam does not carry (socials, headshot,
    // provenance) BEFORE linking, so addToEvent copies them into the
    // per-event contact row.
    yield* Effect.forEach(
      speakerIds,
      ({ id, email }) => {
        const speaker = byEmail.get(email.trim().toLowerCase());
        if (speaker === undefined) return Effect.void;
        return integrations.enrichContact(id, {
          linkedinUrl: speaker.linkedIn?.trim() || null,
          twitterUrl: speaker.twitter?.trim() || null,
          headshotUrl: speaker.imageUrl?.trim() || null,
          custom: {
            accelevents: { speakerId: speaker.speakerId, eventUrl: config.eventUrl },
          },
        });
      },
      { concurrency: 5 },
    );
    let linkedToEvent = 0;
    yield* Effect.forEach(
      speakerIds,
      ({ id }) =>
        crm.addToEvent(id, eventId, "speaker", "invited").pipe(
          Effect.tap(() => Effect.sync(() => (linkedToEvent += 1))),
          // A contact already linked to the event is success, not failure.
          Effect.catchTag("NotFound", () => Effect.void),
        ),
      { concurrency: 5 },
    );

    // Attendees: contact-only import with a provenance tag; they are not
    // program participants, so no event link.
    let attendeesOutcome: AcceleventsOutcome | null = null;
    if (config.importAttendees) {
      const attendees = yield* fetchAttendees(config);
      const active = attendees.filter((attendee) => attendee.ticketStatus !== "CANCELLED");
      const attendeeRows = active.map(attendeeRow).filter(usable);
      const attendeeResult = yield* crm.importContacts(organizationId, attendeeRows, "skip");
      const attendeeIds = yield* integrations.contactIdsByEmails(
        organizationId,
        attendeeRows.map((row) => row.email),
      );
      yield* Effect.forEach(
        attendeeIds,
        ({ id }) => crm.saveTag(organizationId, id, ATTENDEE_TAG),
        { concurrency: 5 },
      );
      attendeesOutcome = outcomeOf(attendeeResult);
    }

    const report: AcceleventsSyncReport = {
      speakers: outcomeOf(speakerResult),
      attendees: attendeesOutcome,
      linkedToEvent,
      syncedAt: new Date().toISOString(),
    };
    yield* integrations.recordSync(stored.id, report as unknown as Record<string, Schema.Json>);
    return report;
  });
