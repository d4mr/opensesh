import { describe, expect, it } from "vitest";

import type { CrmDirectoryRow, OrganizationContact } from "../server/schema/crm";
import {
  addCanonicalToEvent,
  emptyCrmFilters,
  filterCrmDirectory,
  findCrmDuplicates,
  groupEventContacts,
  mergeCanonicalProfiles,
  mergePreservedCollections,
  newestFirst,
  transitionPipelineCard,
} from "./operations";

const at = new Date("2026-08-10T10:00:00.000Z");
const contact = (
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  company: string | null,
  title: string | null,
): OrganizationContact => ({
  id,
  organizationId: "org-1",
  firstName,
  lastName,
  email,
  company,
  title,
  bio: null,
  linkedinUrl: null,
  twitterUrl: null,
  facebookUrl: null,
  websiteUrl: null,
  headshotUrl: null,
  custom: {},
  createdAt: at,
  updatedAt: at,
});

const priya = contact(
  "priya",
  "Priya",
  "Raman",
  "priya@example.com",
  "Latticework",
  "Principal Engineer",
);
const marcus = contact(
  "marcus",
  "Marcus",
  "Okafor",
  "marcus@example.com",
  "Cloudreach",
  "Advocate",
);
const rows: ReadonlyArray<CrmDirectoryRow> = [
  {
    contact: priya,
    events: [],
    tags: [
      { id: "keynote", organizationId: "org-1", name: "Keynote", createdAt: at, updatedAt: at },
      { id: "ai", organizationId: "org-1", name: "AI", createdAt: at, updatedAt: at },
    ],
  },
  { contact: marcus, events: [], tags: [] },
];

describe("CRM domain operations", () => {
  it("groups event contacts by normalized canonical email", () => {
    const groups = groupEventContacts([
      { id: "one", email: " Priya@Example.com " },
      { id: "two", email: "priya@example.com" },
      { id: "three", email: "marcus@example.com" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.contacts).toHaveLength(2);
  });

  it("uses intersection filters and clears to full membership", () => {
    expect(
      filterCrmDirectory(rows, {
        search: "Priya",
        company: "Latticework",
        title: "Principal Engineer",
        tagIds: ["keynote", "ai"],
      }).map((row) => row.contact.id),
    ).toEqual(["priya"]);
    expect(filterCrmDirectory(rows, emptyCrmFilters)).toHaveLength(2);
  });

  it("widens with any-of semantics across multiple selected tags", () => {
    expect(
      filterCrmDirectory(rows, { ...emptyCrmFilters, tagIds: ["keynote", "workshop"] }).map(
        (row) => row.contact.id,
      ),
    ).toEqual(["priya"]);
  });

  it("orders notes and history newest first", () => {
    expect(
      newestFirst([
        { id: "old", createdAt: new Date("2026-01-01T00:00:00.000Z") },
        { id: "new", createdAt: new Date("2026-02-01T00:00:00.000Z") },
      ]).map((item) => item.id),
    ).toEqual(["new", "old"]);
  });

  it("surfaces a near-duplicate with a different email", () => {
    const alternate = contact(
      "priya-alt",
      "Priya",
      "Raman",
      "priya.alt@example.com",
      "Latticework",
      null,
    );
    expect(findCrmDuplicates([priya, alternate])).toEqual([
      {
        primaryId: "priya",
        duplicateId: "priya-alt",
        reasons: ["name", "company"],
      },
    ]);
  });

  it("merges profile values and preserves notes, tags, event links, and stage history", () => {
    const duplicate = {
      ...contact("priya-alt", "Priya", "Raman", "alternate@example.com", null, null),
      bio: "Alternate bio",
      linkedinUrl: "https://linkedin.example/priya",
      custom: { region: "APAC" },
    };
    const primary = { ...priya, custom: { topic: "Build systems" } };
    expect(mergeCanonicalProfiles(primary, duplicate)).toMatchObject({
      id: "priya",
      bio: "Alternate bio",
      linkedinUrl: "https://linkedin.example/priya",
      custom: { region: "APAC", topic: "Build systems" },
    });
    expect(mergePreservedCollections([{ id: "primary-note" }], [{ id: "duplicate-note" }])).toEqual(
      [{ id: "primary-note" }, { id: "duplicate-note" }],
    );
    expect(
      mergePreservedCollections([{ id: "primary-tag" }], [{ id: "duplicate-tag" }]),
    ).toHaveLength(2);
    expect(
      mergePreservedCollections([{ id: "primary-event" }], [{ id: "duplicate-event" }]),
    ).toHaveLength(2);
    expect(
      mergePreservedCollections([{ id: "primary-transition" }], [{ id: "duplicate-transition" }]),
    ).toHaveLength(2);
  });

  it("persists a pipeline transition with actor and time", () => {
    const result = transitionPipelineCard(
      { id: "card", stageId: "prospect" },
      "contacted",
      "jordan",
      at,
    );
    expect(result.card.stageId).toBe("contacted");
    expect(result.history).toEqual({
      fromStageId: "prospect",
      toStageId: "contacted",
      actorId: "jordan",
      createdAt: at,
    });
  });

  it("reproduces dynamic segment membership from its saved filters", () => {
    const saved = { search: "", company: "Latticework", title: "", tagIds: ["ai"] };
    expect(filterCrmDirectory(rows, saved).map((row) => row.contact.id)).toEqual(["priya"]);
  });

  it("adds to an event by normalized email without duplication and preserves the profile", () => {
    const existing = [{ ...priya, firstName: "Old" }];
    const result = addCanonicalToEvent(existing, priya);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(priya);
  });
});
