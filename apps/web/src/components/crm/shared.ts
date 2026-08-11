import type { CrmDirectoryFilters } from "@opensesh/domain";

export const filtersFromJson = (value: Readonly<Record<string, unknown>>): CrmDirectoryFilters => ({
  search: typeof value.search === "string" ? value.search : "",
  company: typeof value.company === "string" ? value.company : "",
  title: typeof value.title === "string" ? value.title : "",
  tagIds: Array.isArray(value.tagIds)
    ? value.tagIds.filter((item): item is string => typeof item === "string")
    : [],
});

export const parseCsv = (source: string): ReadonlyArray<ReadonlyArray<string>> => {
  const rows: Array<Array<string>> = [];
  let row: Array<string> = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
};

export const splitName = (value: string) => {
  const parts = value.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || parts[0] || "",
  };
};
