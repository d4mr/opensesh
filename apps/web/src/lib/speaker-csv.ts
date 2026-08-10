import type { SpeakerCsvRow } from "@opensesh/domain";

interface CsvPreviewRow {
  readonly number: number;
  readonly row: SpeakerCsvRow;
  readonly matched: boolean;
  readonly errors: ReadonlyArray<string>;
}

export interface CsvPreview {
  readonly mapping: ReadonlyArray<{ readonly header: string; readonly field: string }>;
  readonly rows: ReadonlyArray<CsvPreviewRow>;
}

const aliases: Readonly<Record<string, keyof Omit<SpeakerCsvRow, "action"> | "name">> = {
  name: "name",
  fullname: "name",
  firstname: "firstName",
  first: "firstName",
  lastname: "lastName",
  last: "lastName",
  email: "email",
  emailaddress: "email",
  title: "title",
  jobtitle: "title",
  company: "company",
  organization: "company",
  bio: "bio",
  biography: "bio",
  dietary: "dietary",
  dietaryrequirements: "dietary",
  tshirt: "tshirt",
  tshirtsize: "tshirt",
  linkedin: "linkedin",
  linkedinurl: "linkedin",
  twitter: "twitter",
  x: "twitter",
  twitterurl: "twitter",
  facebook: "facebook",
  facebookurl: "facebook",
  website: "website",
  websiteurl: "website",
  phone: "phone",
  phonenumber: "phone",
};

const csvCells = (text: string) => {
  const rows: Array<Array<string>> = [[]];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    if (char === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      rows.at(-1)?.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)?.push(cell);
      cell = "";
      rows.push([]);
    } else cell += char;
  }
  rows.at(-1)?.push(cell);
  return rows.filter((row) => row.some((value) => value.trim() !== ""));
};

export const parseSpeakerCsv = (text: string, existingEmails: ReadonlySet<string>): CsvPreview => {
  const cells = csvCells(text);
  const headers = cells[0]?.map((value) => value.trim()) ?? [];
  const indexedMapping = headers.flatMap((header, index) => {
    const field = aliases[header.toLowerCase().replace(/[^a-z0-9]/g, "")];
    return field === undefined ? [] : [{ header, field, index }];
  });
  const rows = cells.slice(1).map((values, index) => {
    const valueFor = (field: (typeof indexedMapping)[number]["field"]) => {
      const match = indexedMapping.find((item) => item.field === field);
      return match === undefined ? "" : (values[match.index]?.trim() ?? "");
    };
    const fullName = valueFor("name").split(/\s+/).filter(Boolean);
    const firstName = valueFor("firstName") || fullName[0] || "";
    const lastName = valueFor("lastName") || fullName.slice(1).join(" ");
    const email = valueFor("email").toLowerCase();
    const matched = existingEmails.has(email);
    const nullable = (field: (typeof indexedMapping)[number]["field"]) => valueFor(field) || null;
    const row: SpeakerCsvRow = {
      firstName,
      lastName,
      email,
      title: nullable("title"),
      company: nullable("company"),
      bio: nullable("bio"),
      dietary: valueFor("dietary") || "none",
      tshirt: nullable("tshirt"),
      linkedin: nullable("linkedin"),
      twitter: nullable("twitter"),
      facebook: nullable("facebook"),
      website: nullable("website"),
      phone: nullable("phone"),
      action: matched ? "update" : "create",
    };
    const errors = [
      firstName === "" ? "First name is required" : null,
      lastName === "" ? "Last name is required" : null,
      !email.includes("@") ? "Valid email is required" : null,
    ].filter((value): value is string => value !== null);
    return { number: index + 2, row, matched, errors };
  });
  return {
    mapping: indexedMapping.map(({ header, field }) => ({ header, field })),
    rows,
  };
};
