import type { CrmDirectoryFilters } from "@opensesh/domain";

// Return handoff for the CRM directory: opening a contact remembers where the
// list stood (filters + scroll + clicked row); mounting the directory again —
// via the Directory tab or browser back — consumes it exactly once, restores
// the position, and flashes the row the user left from.

const key = "opensesh:crm-directory:return";

export interface CrmDirectoryReturn {
  readonly contactId: string;
  readonly scrollTop: number;
  readonly filters: CrmDirectoryFilters;
}

export const rememberCrmDirectory = (value: CrmDirectoryReturn) => {
  window.sessionStorage.setItem(key, JSON.stringify(value));
};

export const takeCrmDirectoryReturn = (): CrmDirectoryReturn | null => {
  const raw = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("contactId" in parsed) ||
    !("scrollTop" in parsed) ||
    !("filters" in parsed) ||
    typeof parsed.contactId !== "string" ||
    typeof parsed.scrollTop !== "number" ||
    typeof parsed.filters !== "object" ||
    parsed.filters === null
  ) {
    return null;
  }
  return {
    contactId: parsed.contactId,
    scrollTop: parsed.scrollTop,
    filters: parsed.filters as CrmDirectoryFilters,
  };
};
