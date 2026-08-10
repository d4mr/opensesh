import type { CrmDirectoryRow, OrganizationContact } from "../server/schema/crm";

export interface CrmFilters {
  readonly search: string;
  readonly company: string;
  readonly title: string;
  readonly tagIds: ReadonlyArray<string>;
}

export const emptyCrmFilters: CrmFilters = {
  search: "",
  company: "",
  title: "",
  tagIds: [],
};

export const normalizeCrmValue = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const normalizeCrmEmail = (value: string) => value.trim().toLocaleLowerCase();

export const filterCrmDirectory = (rows: ReadonlyArray<CrmDirectoryRow>, filters: CrmFilters) => {
  const search = normalizeCrmValue(filters.search);
  const company = normalizeCrmValue(filters.company);
  const title = normalizeCrmValue(filters.title);
  return rows.filter((row) => {
    const haystack = normalizeCrmValue(
      [
        row.contact.firstName,
        row.contact.lastName,
        row.contact.email,
        row.contact.company ?? "",
        row.contact.title ?? "",
        ...row.tags.map((tag) => tag.name),
      ].join(" "),
    );
    return (
      (search.length === 0 || haystack.includes(search)) &&
      (company.length === 0 || normalizeCrmValue(row.contact.company ?? "") === company) &&
      (title.length === 0 || normalizeCrmValue(row.contact.title ?? "") === title) &&
      filters.tagIds.every((tagId) => row.tags.some((tag) => tag.id === tagId))
    );
  });
};

export interface DuplicateCandidate {
  readonly primaryId: string;
  readonly duplicateId: string;
  readonly reasons: ReadonlyArray<"email" | "name" | "company">;
}

export const findCrmDuplicates = (
  contacts: ReadonlyArray<OrganizationContact>,
): ReadonlyArray<DuplicateCandidate> =>
  contacts.flatMap((left, leftIndex) =>
    contacts.slice(leftIndex + 1).flatMap((right) => {
      const sameEmail = normalizeCrmEmail(left.email) === normalizeCrmEmail(right.email);
      const sameName =
        normalizeCrmValue(`${left.firstName} ${left.lastName}`) ===
        normalizeCrmValue(`${right.firstName} ${right.lastName}`);
      const sameCompany =
        normalizeCrmValue(left.company ?? "") !== "" &&
        normalizeCrmValue(left.company ?? "") === normalizeCrmValue(right.company ?? "");
      const sameLastName = normalizeCrmValue(left.lastName) === normalizeCrmValue(right.lastName);
      if (!sameEmail && !sameName && !(sameCompany && sameLastName)) return [];
      return [
        {
          primaryId: left.id,
          duplicateId: right.id,
          reasons: [
            ...(sameEmail ? (["email"] as const) : []),
            ...(sameName ? (["name"] as const) : []),
            ...(sameCompany ? (["company"] as const) : []),
          ],
        },
      ];
    }),
  );

export const mergeCanonicalProfiles = (
  primary: OrganizationContact,
  duplicate: OrganizationContact,
): OrganizationContact => ({
  ...primary,
  title: primary.title ?? duplicate.title,
  company: primary.company ?? duplicate.company,
  bio: primary.bio ?? duplicate.bio,
  linkedinUrl: primary.linkedinUrl ?? duplicate.linkedinUrl,
  twitterUrl: primary.twitterUrl ?? duplicate.twitterUrl,
  facebookUrl: primary.facebookUrl ?? duplicate.facebookUrl,
  websiteUrl: primary.websiteUrl ?? duplicate.websiteUrl,
  headshotUrl: primary.headshotUrl ?? duplicate.headshotUrl,
  custom: { ...duplicate.custom, ...primary.custom },
  updatedAt: primary.updatedAt > duplicate.updatedAt ? primary.updatedAt : duplicate.updatedAt,
});

export const groupEventContacts = <T extends { readonly email: string }>(
  contacts: ReadonlyArray<T>,
) =>
  Array.from(
    contacts.reduce((groups, contact) => {
      const key = normalizeCrmEmail(contact.email);
      return groups.set(key, [...(groups.get(key) ?? []), contact]);
    }, new Map<string, ReadonlyArray<T>>()),
  ).map(([email, grouped]) => ({ email, contacts: grouped }));

export const newestFirst = <T extends { readonly createdAt: Date }>(rows: ReadonlyArray<T>) =>
  [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

export const mergePreservedCollections = <T extends { readonly id: string }>(
  primary: ReadonlyArray<T>,
  duplicate: ReadonlyArray<T>,
) => Array.from(new Map([...primary, ...duplicate].map((item) => [item.id, item])).values());

export interface PipelineTransition<TCard extends { readonly stageId: string }> {
  readonly card: TCard;
  readonly history: {
    readonly fromStageId: string;
    readonly toStageId: string;
    readonly actorId: string;
    readonly createdAt: Date;
  };
}

export const transitionPipelineCard = <TCard extends { readonly stageId: string }>(
  card: TCard,
  toStageId: string,
  actorId: string,
  createdAt: Date,
): PipelineTransition<TCard> => ({
  card: { ...card, stageId: toStageId },
  history: { fromStageId: card.stageId, toStageId, actorId, createdAt },
});

export const addCanonicalToEvent = <T extends { readonly email: string }>(
  contacts: ReadonlyArray<T>,
  canonical: T,
) => {
  const normalizedEmail = normalizeCrmEmail(canonical.email);
  const matchIndex = contacts.findIndex(
    (contact) => normalizeCrmEmail(contact.email) === normalizedEmail,
  );
  if (matchIndex === -1) return [...contacts, canonical];
  return contacts.map((contact, index) => (index === matchIndex ? canonical : contact));
};
