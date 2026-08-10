import type { Schema } from "effect";

type JsonRecord = Readonly<Record<string, Schema.Json>>;

const formatValue = (value: Schema.Json | undefined) =>
  typeof value === "string" ? value.replace(/<[^>]+>/g, "") : JSON.stringify(value, null, 2);

const contentFieldLabels: Readonly<Record<string, string>> = {
  title: "Title",
  description: "Description",
  formatId: "Format",
  levelId: "Level",
};

// "answers" mirrors the named content fields, so it reads as noise in a
// summary line — only fall back to it when nothing named changed.
export const describeChangedFields = (fields: ReadonlyArray<string>) => {
  const named = fields.filter((field) => field !== "answers");
  const source = named.length > 0 ? named : fields;
  return source.map((field) => (contentFieldLabels[field] ?? field).toLowerCase()).join(", ");
};

export interface ContentDiffRow {
  readonly key: string;
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

export const contentDiffRows = (entry: {
  readonly changedFields: ReadonlyArray<string>;
  readonly previousValues: JsonRecord;
  readonly newValues: JsonRecord;
}): ReadonlyArray<ContentDiffRow> => {
  const rows: Array<ContentDiffRow> = [];
  const named = entry.changedFields.filter((field) => field !== "answers");
  const seen = new Set<string>();
  for (const field of named) {
    const before = formatValue(entry.previousValues[field]);
    const after = formatValue(entry.newValues[field]);
    seen.add(`${before}→${after}`);
    rows.push({ key: field, label: contentFieldLabels[field] ?? field, before, after });
  }
  if (entry.changedFields.includes("answers")) {
    const previous = entry.previousValues["answers"];
    const next = entry.newValues["answers"];
    const isRecord = (value: Schema.Json | undefined): value is JsonRecord =>
      value !== null && typeof value === "object" && !Array.isArray(value);
    if (isRecord(previous) && isRecord(next)) {
      for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
        const before = formatValue(previous[key]);
        const after = formatValue(next[key]);
        if (before === after || seen.has(`${before}→${after}`)) continue;
        rows.push({
          key: `answers:${key}`,
          label: key.replace(/^fld_/, "").replaceAll("_", " "),
          before,
          after,
        });
      }
    } else if (named.length === 0) {
      rows.push({
        key: "answers",
        label: "answers",
        before: formatValue(previous),
        after: formatValue(next),
      });
    }
  }
  return rows;
};
