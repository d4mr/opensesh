import {
  aiReviewResults,
  apiKeys,
  contactEditHistory,
  crmPipelineCards,
  crmStageHistory,
  emailCampaigns,
  events,
  organizationContactNotes,
  organizations,
  users,
} from "@opensesh/domain/db/schema";
import { makeDatabase } from "@opensesh/domain/server/db";
import { resetApiE2eDatabase } from "@opensesh/domain/testing/api-e2e";
import { eq } from "drizzle-orm";
import { Schema } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";

import { apiEndpoints } from "../src/server/api";
import { hashApiKey } from "../src/server/api/keys";

const PRIMARY_TOKEN = "osk_local_api_e2e_primary";
const OTHER_TOKEN = "osk_local_api_e2e_other";
const REVOKED_TOKEN = "osk_local_api_e2e_revoked";
const DEVFLOW_EVENT_ID = "evt_devflow_2027";
const INITIAL_ROUND_ID = "rnd_devflow_initial";
const JsonRecord = Schema.Record(Schema.String, Schema.Unknown);
const JsonArray = Schema.Array(Schema.Unknown);

if (process.env.DATABASE_URL === undefined) process.loadEnvFile("apps/web/.dev.vars");
const sourceDatabaseUrl = process.env.DATABASE_URL;
if (sourceDatabaseUrl === undefined || sourceDatabaseUrl.length === 0) {
  throw new Error(
    "DATABASE_URL is required; expected apps/web/.dev.vars to point to local Postgres",
  );
}

const testDatabaseUrl = new URL(sourceDatabaseUrl);
testDatabaseUrl.pathname = "/opensesh_api_e2e";
process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = testDatabaseUrl.toString();

const server = createTestHarness({
  root: process.cwd(),
  workers: [
    {
      configPath: "apps/web/dist/server/wrangler.json",
      secrets: { ANTHROPIC_API_KEY: "local-e2e-anthropic-key" },
    },
  ],
});

const exercisedOperations = new Set<string>();
let documentedOperations = new Set<string>();
let createdEventId = "";
let manualSessionId = "";
let agendaSessionIds: ReadonlyArray<string> = [];
const originalFetch = globalThis.fetch;

const asRecord = (value: unknown) => Schema.decodeUnknownSync(JsonRecord)(value);
const asArray = (value: unknown) => Schema.decodeUnknownSync(JsonArray)(value);
const stringField = (value: unknown, key: string) => {
  const field = asRecord(value)[key];
  if (typeof field !== "string") throw new Error(`Expected ${key} to be a string`);
  return field;
};
const numberField = (value: unknown, key: string) => {
  const field = asRecord(value)[key];
  if (typeof field !== "number") throw new Error(`Expected ${key} to be a number`);
  return field;
};

const collectOperationIds = (value: unknown, target: Set<string>): void => {
  if (Array.isArray(value)) {
    for (const item of value) collectOperationIds(item, target);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "operationId" && typeof item === "string") target.add(item);
    else collectOperationIds(item, target);
  }
};

interface OperationRequest {
  readonly params?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly token?: string;
}

const requestOperation = async (operationId: string, input: OperationRequest = {}) => {
  const endpoint = apiEndpoints.find((candidate) => candidate.operationId === operationId);
  if (endpoint === undefined) throw new Error(`Unknown API operation: ${operationId}`);
  const params = input.params ?? {};
  const path = endpoint.path.replaceAll(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`${operationId} is missing path parameter ${name}`);
    return encodeURIComponent(value);
  });
  const search = new URLSearchParams(input.query).toString();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.token ?? PRIMARY_TOKEN}`,
    ...(input.body === undefined ? {} : { "content-type": "application/json" }),
  };
  const response = await server.fetch(`/api/v1${path}${search === "" ? "" : `?${search}`}`, {
    method: endpoint.method,
    headers,
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
  });
  const expectedStatus = endpoint.successStatus ?? 200;
  const text = await response.text();
  expect(response.status, `${operationId}: ${text}`).toBe(expectedStatus);
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  exercisedOperations.add(operationId);
  if (expectedStatus === 204) {
    expect(text).toBe("");
    return null;
  }
  expect(response.headers.get("content-type")).toContain("application/json");
  return JSON.parse(text) as unknown;
};

const contactBody = (email: string, firstName = "API", lastName = "Tester") => ({
  firstName,
  lastName,
  email,
  title: "Staff Engineer",
  company: "Local Harness Labs",
  bio: "Created by the exhaustive local API integration suite.",
  linkedinUrl: null,
  twitterUrl: null,
  facebookUrl: null,
  websiteUrl: null,
  headshotUrl: null,
});

const speakerBody = (id: string | null, email: string) => ({
  id,
  firstName: "Taylor",
  lastName: "E2E",
  email,
  title: "Principal Engineer",
  company: "Local Harness Labs",
  bio: "A complete speaker profile used by the local API suite.",
  linkedinUrl: null,
  twitterUrl: null,
  websiteUrl: null,
  dietaryRequirements: "vegetarian",
  tshirtSize: "M",
  travelLogistics: "Arriving by train",
  workflowStatus: "onboarding",
});

const widgetOptions = {
  trackIds: [],
  formatIds: [],
  tagIds: [],
  dayKeys: [],
  theme: "light",
  primaryColor: "#1d6b4c",
  dateFormat: "24h",
  showSpeakerCompany: true,
  showSpeakerTitle: true,
  showSpeakerBio: true,
  showSessionDescription: true,
  showSessionLevel: true,
  showSessionFormat: true,
  showAddToCalendar: true,
  customCss: ".opensesh-widget { border-radius: 0; }",
};

describe.sequential("all opensesh REST operations through local workerd and Postgres", () => {
  beforeAll(async () => {
    const connectionString = await resetApiE2eDatabase(sourceDatabaseUrl);
    const database = makeDatabase(connectionString, 1);
    try {
      await database.insert(organizations).values({
        id: "org_api_e2e_other",
        name: "Other Tenant",
        slug: "api-e2e-other",
        logo: null,
        metadata: null,
      });
      await database.insert(users).values({
        id: "usr_api_e2e_other",
        email: "other-tenant@api-e2e.example.com",
        name: "Other Tenant Owner",
        emailVerified: true,
        image: null,
      });
      await database.insert(events).values({
        id: "evt_api_e2e_other",
        organizationId: "org_api_e2e_other",
        name: "Other Tenant Event",
        slug: "other-tenant-event",
        timezone: "UTC",
        startsAt: new Date("2027-06-01T09:00:00.000Z"),
        endsAt: new Date("2027-06-01T17:00:00.000Z"),
      });
      await database.insert(apiKeys).values([
        {
          id: "api_key_e2e_primary",
          organizationId: "org_ai_engineer",
          name: "Local API E2E",
          keyHash: await hashApiKey(PRIMARY_TOKEN),
          keyPrefix: PRIMARY_TOKEN.slice(0, 12),
          createdByUserId: "usr_dana",
        },
        {
          id: "api_key_e2e_other",
          organizationId: "org_api_e2e_other",
          name: "Other Tenant API E2E",
          keyHash: await hashApiKey(OTHER_TOKEN),
          keyPrefix: OTHER_TOKEN.slice(0, 12),
          createdByUserId: "usr_api_e2e_other",
        },
        {
          id: "api_key_e2e_revoked",
          organizationId: "org_ai_engineer",
          name: "Revoked API E2E",
          keyHash: await hashApiKey(REVOKED_TOKEN),
          keyPrefix: REVOKED_TOKEN.slice(0, 12),
          createdByUserId: "usr_dana",
          revokedAt: new Date(),
        },
      ]);
    } finally {
      await database.$client.end();
    }

    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "https://api.anthropic.com/v1/messages") {
        const placements = agendaSessionIds.map((submissionId, index) => {
          const startsAt = new Date(Date.UTC(2027, 4, 13, 16 + index, 0, 0));
          const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
          return {
            submissionId,
            roomId: "room_devflow_1",
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            reason: "Deterministic local integration fixture",
          };
        });
        return new Response(
          JSON.stringify({
            content: [
              {
                type: "tool_use",
                name: "submit_abstract_review",
                input: {
                  score: 4.25,
                  reasoning: "Strong practical relevance and a concrete, verifiable proposal.",
                },
              },
              { type: "tool_use", name: "propose_agenda", input: { placements } },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return originalFetch(input, init);
    };

    await server.listen();
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    expect([...exercisedOperations].sort()).toEqual([...documentedOperations].sort());
    await server.close();
  });

  it("proves protocol metadata, CORS, routing, validation, authentication, and tenancy", async () => {
    const index = await server.fetch("/api/v1/");
    expect(index.status).toBe(200);
    expect(index.headers.get("access-control-allow-origin")).toBe("*");
    await expect(index.json()).resolves.toMatchObject({
      name: "opensesh API",
      version: "v1",
      endpoints: apiEndpoints.length,
    });

    const openapi = await server.fetch("/api/v1/openapi.json");
    expect(openapi.status).toBe(200);
    collectOperationIds(await openapi.json(), documentedOperations);
    expect(documentedOperations.size).toBe(64);
    expect(documentedOperations.size).toBe(apiEndpoints.length);

    const preflight = await server.fetch("/api/v1/events", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("DELETE");

    const missing = await server.fetch("/api/v1/events");
    expect(missing.status).toBe(401);
    await expect(missing.json()).resolves.toMatchObject({ error: { code: "missing_api_key" } });

    const invalid = await server.fetch("/api/v1/events", {
      headers: { Authorization: "Bearer osk_invalid" },
    });
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toMatchObject({ error: { code: "invalid_api_key" } });

    const revoked = await server.fetch("/api/v1/events", {
      headers: { Authorization: `Bearer ${REVOKED_TOKEN}` },
    });
    expect(revoked.status).toBe(401);

    const unknown = await server.fetch("/api/v1/not-a-real-route", {
      headers: { Authorization: `Bearer ${PRIMARY_TOKEN}` },
    });
    expect(unknown.status).toBe(404);

    const wrongMethod = await server.fetch("/api/v1/events", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${PRIMARY_TOKEN}` },
    });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toContain("GET");

    const malformed = await server.fetch("/api/v1/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRIMARY_TOKEN}`,
        "content-type": "application/json",
      },
      body: "{not json",
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ error: { code: "invalid_json" } });

    const invalidBody = await server.fetch("/api/v1/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PRIMARY_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: 42 }),
    });
    expect(invalidBody.status).toBe(400);
    await expect(invalidBody.json()).resolves.toMatchObject({ error: { code: "invalid_body" } });

    const crossTenant = await server.fetch(`/api/v1/events/${DEVFLOW_EVENT_ID}`, {
      headers: { Authorization: `Bearer ${OTHER_TOKEN}` },
    });
    expect(crossTenant.status).toBe(403);
  });

  it("covers organization, event, and event-library CRUD with persisted reads", async () => {
    const organization = await requestOperation("getOrganization");
    expect(stringField(asRecord(organization).organization, "id")).toBe("org_ai_engineer");

    const before = asArray(await requestOperation("listEvents"));
    const created = await requestOperation("createEvent", {
      body: {
        name: "API E2E Summit 2027",
        type: "summit",
        timezone: "UTC",
        startsAt: "2027-09-10T09:00:00.000Z",
        endsAt: "2027-09-10T17:00:00.000Z",
      },
    });
    createdEventId = stringField(created, "id");

    const event = await requestOperation("getEvent", { params: { eventId: createdEventId } });
    expect(stringField(event, "name")).toBe("API E2E Summit 2027");

    const updated = await requestOperation("updateEvent", {
      params: { eventId: createdEventId },
      body: {
        tagline: "A complete local API contract test",
        location: "Localhost",
        defaultSubmissionLimit: 5,
      },
    });
    expect(stringField(updated, "location")).toBe("Localhost");

    const libraryBefore = asRecord(
      await requestOperation("getEventLibrary", { params: { eventId: createdEventId } }),
    );
    expect(asArray(libraryBefore.tracks)).toHaveLength(0);

    const tag = await requestOperation("saveLibraryItem", {
      params: { eventId: createdEventId },
      body: { kind: "tag", id: null, name: "API E2E" },
    });
    const tagId = stringField(tag, "id");
    await requestOperation("saveLibraryItem", {
      params: { eventId: createdEventId },
      body: { kind: "tag", id: tagId, name: "API E2E Updated" },
    });
    await requestOperation("deleteLibraryItem", {
      params: { eventId: createdEventId, kind: "tag", itemId: tagId },
    });

    const after = asArray(await requestOperation("listEvents"));
    expect(after).toHaveLength(before.length + 1);
    const libraryAfter = asRecord(
      await requestOperation("getEventLibrary", { params: { eventId: createdEventId } }),
    );
    expect(asArray(libraryAfter.tags)).toHaveLength(0);
  });

  it("covers submission review-desk state, decisions, direct sessions, and speaker reads", async () => {
    const list = asRecord(
      await requestOperation("listSubmissions", {
        params: { eventId: DEVFLOW_EVENT_ID },
        query: { kind: "abstract", status: "pending" },
      }),
    );
    expect(asArray(list.submissions).length).toBeGreaterThanOrEqual(4);

    const detail = await requestOperation("getSubmission", {
      params: { eventId: DEVFLOW_EVENT_ID, submissionId: "sub_devflow_1" },
    });
    expect(stringField(asRecord(detail).submission, "code")).toBe("SESS-1");

    await requestOperation("changeSubmissionStatus", {
      params: { eventId: DEVFLOW_EVENT_ID, submissionId: "sub_devflow_2" },
      body: { status: "maybe" },
    });
    await requestOperation("changeSubmissionStatus", {
      params: { eventId: DEVFLOW_EVENT_ID, submissionId: "sub_devflow_2" },
      body: { status: "pending" },
    });

    const decision = await requestOperation("decideSubmissions", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        submissionIds: ["sub_devflow_1"],
        decision: "accept",
        feedback: "Accepted by the local API integration suite.",
        approveContent: true,
      },
    });
    expect(asArray(asRecord(decision).submissions)).toHaveLength(1);
    expect(numberField(decision, "createdEmails")).toBeGreaterThan(0);

    const session = await requestOperation("createSession", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        title: "Local API Contract Testing in Production-Shaped Runtimes",
        description: "A direct session created through the public REST API.",
        formatId: "fmt_devflow_talk",
        speakerIds: ["con_devflow_priya"],
      },
    });
    manualSessionId = stringField(session, "id");
    agendaSessionIds = ["sub_devflow_1", manualSessionId];

    const speaker = await requestOperation("getSpeaker", {
      params: { eventId: DEVFLOW_EVENT_ID, contactId: "con_devflow_priya" },
    });
    expect(stringField(speaker, "email")).toBe("priya.speaker@sbek-test.example.com");
  });

  it("covers speaker CRUD, workflow, imports, invitations, campaigns, and email persistence", async () => {
    const before = asRecord(
      await requestOperation("listSpeakers", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    const speaker = await requestOperation("saveSpeaker", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: speakerBody(null, "taylor-e2e@api-e2e.example.com"),
    });
    const speakerId = stringField(speaker, "id");

    const updated = await requestOperation("saveSpeaker", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        ...speakerBody(speakerId, "taylor-e2e@api-e2e.example.com"),
        company: "Updated Labs",
      },
    });
    expect(stringField(updated, "company")).toBe("Updated Labs");

    const workflow = await requestOperation("setSpeakerWorkflow", {
      params: { eventId: DEVFLOW_EVENT_ID, contactId: speakerId },
      body: { status: "confirmed" },
    });
    expect(stringField(workflow, "workflowStatus")).toBe("confirmed");

    const imported = await requestOperation("importSpeakers", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        rows: [
          {
            firstName: "Imported",
            lastName: "Speaker",
            email: "imported-speaker@api-e2e.example.com",
            title: "Developer Advocate",
            company: "Import Labs",
            bio: "Imported through the API.",
            dietary: "none",
            tshirt: "L",
            linkedin: null,
            twitter: null,
            facebook: null,
            website: null,
            phone: null,
            action: "create",
          },
        ],
      },
    });
    expect(numberField(imported, "created")).toBe(1);

    const invitations = await requestOperation("inviteSpeakerPortals", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: { contactIds: [speakerId] },
    });
    expect(numberField(invitations, "sent")).toBe(1);

    const communicationsBefore = asRecord(
      await requestOperation("getCommunications", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    const campaign = await requestOperation("sendCampaign", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        templateId: null,
        subject: "API E2E speaker update",
        body: "Hello {speaker_name}, this is a local integration delivery.",
        contactIds: [speakerId],
      },
    });
    expect(numberField(campaign, "sent")).toBe(1);

    const communicationsAfter = asRecord(
      await requestOperation("getCommunications", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(asArray(communicationsAfter.campaigns).length).toBe(
      asArray(communicationsBefore.campaigns).length + 1,
    );
    const after = asRecord(
      await requestOperation("listSpeakers", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(asArray(after.rows).length).toBeGreaterThan(asArray(before.rows).length);
  });

  it("covers review configuration, reviewers, assignments, distribution, reminders, and AI", async () => {
    const workspace = asRecord(
      await requestOperation("getEvaluation", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(workspace.aiConfigured).toBe(true);

    const now = Date.now();
    const savedRound = await requestOperation("saveReviewRound", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        roundId: null,
        name: "API E2E Review",
        opensAt: new Date(now - 86_400_000).toISOString(),
        closesAt: new Date(now + 30 * 86_400_000).toISOString(),
        blind: false,
        position: 3,
        criteria: [
          {
            id: null,
            label: "Usefulness",
            type: "numeric",
            min: 1,
            max: 5,
            options: [],
            required: true,
            weight: 1,
            position: 1,
          },
        ],
      },
    });
    expect(stringField(savedRound, "roundId")).not.toBe("");

    const provisioned = asRecord(
      await requestOperation("addReviewer", {
        params: { eventId: DEVFLOW_EVENT_ID, roundId: INITIAL_ROUND_ID },
        body: {
          email: "reviewer-e2e@api-e2e.example.com",
          assignmentCap: 5,
          accessPath: "/admin/evaluation/rnd_devflow_initial",
        },
      }),
    );
    const reviewer = asRecord(provisioned.reviewer);
    const reviewerMember = asRecord(reviewer.member);
    const eventMemberId = stringField(reviewerMember, "eventMemberId");

    const assigned = await requestOperation("assignReviews", {
      params: { eventId: DEVFLOW_EVENT_ID, roundId: INITIAL_ROUND_ID },
      body: { eventMemberId, submissionIds: ["sub_devflow_2"] },
    });
    expect(numberField(assigned, "created")).toBe(1);

    await requestOperation("autoDistributeReviews", {
      params: { eventId: DEVFLOW_EVENT_ID, roundId: INITIAL_ROUND_ID },
      body: { trackIds: ["trk_devflow_ai"] },
    });

    const afterAssignment = asRecord(
      await requestOperation("getEvaluation", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    const initialRound = asArray(afterAssignment.rounds)
      .map(asRecord)
      .find((round) => {
        const configuration = asRecord(round.configuration);
        return stringField(configuration.round, "id") === INITIAL_ROUND_ID;
      });
    if (initialRound === undefined) throw new Error("Initial review round disappeared");
    const assignment = asArray(initialRound.assignments)
      .map(asRecord)
      .find(
        (item) => item.eventMemberId === eventMemberId && item.submissionId === "sub_devflow_2",
      );
    if (assignment === undefined) throw new Error("Assigned review did not persist");

    await requestOperation("unassignReview", {
      params: {
        eventId: DEVFLOW_EVENT_ID,
        roundId: INITIAL_ROUND_ID,
        assignmentId: stringField(assignment, "id"),
      },
    });

    const reminders = await requestOperation("sendReviewReminders", {
      params: { eventId: DEVFLOW_EVENT_ID, roundId: INITIAL_ROUND_ID },
      body: { eventMemberIds: [eventMemberId] },
    });
    expect(numberField(reminders, "failed")).toBe(0);

    const aiResult = await requestOperation("generateAiReview", {
      params: { eventId: DEVFLOW_EVENT_ID, roundId: INITIAL_ROUND_ID },
      body: { submissionId: "sub_devflow_2" },
    });
    expect(numberField(aiResult, "score")).toBe(4.25);

    const overridden = await requestOperation("overrideAiReview", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        resultId: stringField(aiResult, "id"),
        score: 4.5,
        reason: "Human calibration in the local integration suite",
      },
    });
    expect(numberField(overridden, "overriddenScore")).toBe(4.5);
  });

  it("covers scheduling, publication, AI drafts, draft changes, and draft acceptance", async () => {
    const agendaBefore = asRecord(
      await requestOperation("getAgenda", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(asArray(agendaBefore.sessions).length).toBeGreaterThanOrEqual(2);

    const scheduled = asRecord(
      await requestOperation("scheduleSession", {
        params: { eventId: DEVFLOW_EVENT_ID },
        body: {
          submissionId: "sub_devflow_1",
          roomId: "room_devflow_1",
          startsAt: "2027-05-13T16:00:00.000Z",
          endsAt: "2027-05-13T16:30:00.000Z",
        },
      }),
    );
    expect(
      asArray(scheduled.sessions).some((item) => stringField(item, "id") === "sub_devflow_1"),
    ).toBe(true);

    const published = asRecord(
      await requestOperation("publishAgenda", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(asRecord(published.event).agendaPublishedAt).not.toBeNull();
    const unpublished = asRecord(
      await requestOperation("unpublishAgenda", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(asRecord(unpublished.event).agendaPublishedAt).toBeNull();

    const draft = await requestOperation("generateAgendaDraft", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: {
        name: "API E2E generated agenda",
        criteria: {
          days: ["2027-05-13"],
          roomIds: ["room_devflow_1"],
          includeStatuses: ["accepted"],
          respectExistingPlacements: false,
          rules: ["Keep the local test deterministic"],
        },
      },
    });
    const draftId = stringField(draft, "id");

    const duplicate = await requestOperation("changeAgendaDraft", {
      params: { eventId: DEVFLOW_EVENT_ID, draftId },
      body: { action: "duplicate" },
    });
    const duplicateId = stringField(duplicate, "id");
    const discarded = await requestOperation("changeAgendaDraft", {
      params: { eventId: DEVFLOW_EVENT_ID, draftId: duplicateId },
      body: { action: "discard" },
    });
    expect(stringField(discarded, "status")).toBe("discarded");

    const accepted = await requestOperation("acceptAgendaDraft", {
      params: { eventId: DEVFLOW_EVENT_ID, draftId },
      body: { submissionIds: [manualSessionId] },
    });
    expect(asArray(asRecord(accepted).changedSubmissionIds)).toEqual([manualSessionId]);

    const drafts = asArray(
      await requestOperation("listAgendaDrafts", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(drafts.length).toBeGreaterThanOrEqual(2);
  });

  it("covers the organization CRM, pipeline, notes, tags, merging, imports, and segments", async () => {
    const before = asArray(await requestOperation("listContacts", { query: { q: "" } }));
    const primary = await requestOperation("createContact", {
      body: contactBody("crm-primary@api-e2e.example.com", "Primary", "Contact"),
    });
    const primaryId = stringField(primary, "id");
    const duplicate = await requestOperation("createContact", {
      body: contactBody("crm-duplicate@api-e2e.example.com", "Duplicate", "Contact"),
    });
    const duplicateId = stringField(duplicate, "id");

    const updated = await requestOperation("updateContact", {
      params: { contactId: primaryId },
      body: {
        ...contactBody("crm-primary@api-e2e.example.com", "Primary", "Contact"),
        company: "Updated CRM Labs",
      },
    });
    expect(stringField(updated, "company")).toBe("Updated CRM Labs");

    const imported = await requestOperation("importContacts", {
      body: {
        behavior: "update",
        rows: [
          {
            firstName: "Primary",
            lastName: "Contact",
            email: "crm-primary@api-e2e.example.com",
            title: "Distinguished Engineer",
            company: "Imported CRM Labs",
            bio: "Updated by the bulk importer.",
          },
          {
            firstName: "Bulk",
            lastName: "Imported",
            email: "crm-imported@api-e2e.example.com",
            title: null,
            company: "Import Labs",
            bio: null,
          },
        ],
      },
    });
    expect(numberField(imported, "created")).toBe(1);
    expect(numberField(imported, "updated")).toBe(1);

    const tag = await requestOperation("addContactTag", {
      params: { contactId: primaryId },
      body: { name: "API E2E Tag" },
    });
    const tagId = stringField(tag, "id");
    await requestOperation("addContactNote", {
      params: { contactId: primaryId },
      body: { body: "A persisted note written by an organization-scoped API key." },
    });
    await requestOperation("addContactToEvent", {
      params: { contactId: primaryId },
      body: { eventId: DEVFLOW_EVENT_ID, participation: "speaker" },
    });

    const detail = asRecord(
      await requestOperation("getContact", { params: { contactId: primaryId } }),
    );
    expect(asArray(detail.notes)).toHaveLength(1);
    expect(asArray(detail.tags)).toHaveLength(1);
    expect(asArray(detail.events)).toHaveLength(1);

    await requestOperation("removeContactTag", {
      params: { contactId: primaryId, tagId },
    });
    const merged = await requestOperation("mergeContacts", {
      body: { primaryId, duplicateId },
    });
    expect(stringField(merged, "id")).toBe(primaryId);

    const board = asRecord(await requestOperation("getPipeline"));
    const columns = asArray(board.columns).map(asRecord);
    const firstStageId = stringField(asRecord(columns[0]?.stage), "id");
    const secondStageId = stringField(asRecord(columns[1]?.stage), "id");
    const temporaryStage = await requestOperation("savePipelineStage", {
      body: { id: null, name: "API E2E Temporary", semanticStatus: "open", position: 5 },
    });
    const temporaryStageId = stringField(temporaryStage, "id");

    await requestOperation("reorderPipelineStages", {
      body: {
        stageIds: [...columns.map((column) => stringField(column.stage, "id")), temporaryStageId],
      },
    });
    const card = await requestOperation("addPipelineCard", {
      body: { organizationContactId: primaryId, stageId: firstStageId, note: "API E2E card" },
    });
    const moved = await requestOperation("movePipelineCard", {
      params: { cardId: stringField(card, "id") },
      body: { toStageId: secondStageId },
    });
    expect(stringField(moved, "stageId")).toBe(secondStageId);
    await requestOperation("deletePipelineStage", { params: { stageId: temporaryStageId } });

    const segmentsBefore = asArray(await requestOperation("listSegments"));
    const segment = await requestOperation("saveSegment", {
      body: { name: "API E2E Segment", filter: { company: "Imported CRM Labs" } },
    });
    expect(stringField(segment, "name")).toBe("API E2E Segment");
    const segmentsAfter = asArray(await requestOperation("listSegments"));
    expect(segmentsAfter).toHaveLength(segmentsBefore.length + 1);

    const after = asArray(await requestOperation("listContacts", { query: { q: "api-e2e" } }));
    expect(after.length).toBeGreaterThan(0);
    expect(before.length).toBeGreaterThan(0);
  });

  it("covers public program data, widget CRUD, and persisted email logs", async () => {
    await requestOperation("publishAgenda", { params: { eventId: DEVFLOW_EVENT_ID } });
    const program = asRecord(
      await requestOperation("getProgram", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(asArray(program.sessions).length).toBeGreaterThanOrEqual(2);

    const before = asArray(
      await requestOperation("listWidgets", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    const widget = await requestOperation("createWidget", {
      params: { eventId: DEVFLOW_EVENT_ID },
      body: { name: "API E2E Speaker Gallery", view: "speaker_gallery" },
    });
    const widgetId = stringField(widget, "id");
    const updated = await requestOperation("updateWidget", {
      params: { eventId: DEVFLOW_EVENT_ID, widgetId },
      body: {
        name: "API E2E Agenda",
        view: "agenda",
        enabled: true,
        options: widgetOptions,
      },
    });
    expect(stringField(updated, "view")).toBe("agenda");

    const after = asArray(
      await requestOperation("listWidgets", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(after).toHaveLength(before.length + 1);
    const emails = asArray(
      await requestOperation("listEmails", { params: { eventId: DEVFLOW_EVENT_ID } }),
    );
    expect(emails.length).toBeGreaterThan(0);
  });

  it("covers the fully local Accelevents demo connection and idempotent sync", async () => {
    const disconnected = asRecord(
      await requestOperation("getAcceleventsIntegration", {
        params: { eventId: createdEventId },
      }),
    );
    expect(disconnected.connected).toBe(false);

    const connected = asRecord(
      await requestOperation("saveAcceleventsIntegration", {
        params: { eventId: createdEventId },
        body: {
          eventUrl: "demo",
          apiKey: "demo-accelevents-key",
          importAttendees: true,
        },
      }),
    );
    expect(connected.connected).toBe(true);

    const firstSync = await requestOperation("syncAccelevents", {
      params: { eventId: createdEventId },
    });
    expect(numberField(asRecord(firstSync).speakers, "created")).toBeGreaterThan(0);
    const secondSync = await requestOperation("syncAccelevents", {
      params: { eventId: createdEventId },
    });
    expect(numberField(asRecord(secondSync).speakers, "created")).toBe(0);

    const persisted = asRecord(
      await requestOperation("getAcceleventsIntegration", {
        params: { eventId: createdEventId },
      }),
    );
    expect(persisted.lastSyncedAt).not.toBeNull();
    expect(persisted.apiKeyPreview).not.toBe("demo-accelevents-key");
  });

  it("persists the exact API key as the actor, never the key creator", async () => {
    const database = makeDatabase(testDatabaseUrl.toString(), 1);
    try {
      const [notes, histories, campaigns, edits, cards, overrides, keys] = await Promise.all([
        database
          .select()
          .from(organizationContactNotes)
          .where(eq(organizationContactNotes.authorApiKeyId, "api_key_e2e_primary"))
          .execute(),
        database
          .select()
          .from(crmStageHistory)
          .where(eq(crmStageHistory.actorApiKeyId, "api_key_e2e_primary"))
          .execute(),
        database
          .select()
          .from(emailCampaigns)
          .where(eq(emailCampaigns.createdByApiKeyId, "api_key_e2e_primary"))
          .execute(),
        database
          .select()
          .from(contactEditHistory)
          .where(eq(contactEditHistory.authorApiKeyId, "api_key_e2e_primary"))
          .execute(),
        database
          .select()
          .from(crmPipelineCards)
          .where(eq(crmPipelineCards.note, "API E2E card"))
          .execute(),
        database
          .select()
          .from(aiReviewResults)
          .where(eq(aiReviewResults.overriddenByApiKeyId, "api_key_e2e_primary"))
          .execute(),
        database.select().from(apiKeys).where(eq(apiKeys.id, "api_key_e2e_primary")).execute(),
      ]);

      expect(notes.length).toBeGreaterThan(0);
      expect(notes.every((row) => row.authorUserId === null)).toBe(true);
      expect(histories.length).toBeGreaterThan(0);
      expect(histories.every((row) => row.actorUserId === null)).toBe(true);
      expect(campaigns.length).toBeGreaterThan(0);
      expect(campaigns.every((row) => row.createdByUserId === null)).toBe(true);
      expect(edits.length).toBeGreaterThan(0);
      expect(
        edits.every(
          (row) =>
            row.authorUserId === null &&
            row.reviewedByUserId === null &&
            row.reviewedByApiKeyId === "api_key_e2e_primary",
        ),
      ).toBe(true);
      expect(cards).toHaveLength(1);
      expect(cards[0]?.ownerUserId).toBeNull();
      expect(overrides.length).toBeGreaterThan(0);
      expect(overrides.every((row) => row.overriddenByUserId === null)).toBe(true);
      expect(keys[0]?.lastUsedAt).toBeInstanceOf(Date);
    } finally {
      await database.$client.end();
    }
  });
});
