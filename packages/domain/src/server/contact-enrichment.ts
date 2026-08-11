// The single merge policy for every non-authoritative writer of contact
// identity (CFP participant answers, CSV import, CRM → event linkage). The
// speaker portal and admin editors stay full-overwrite — they are the only
// places a person deliberately clears a field. Everywhere else, an empty
// value means "no information", never "delete what you have".
//
//   fillBlanks     — incoming writes only where the existing field is empty
//                    (CFP updates, CRM copy-on-link). Protects richer data
//                    from stale or sparse round-trips.
//   preferIncoming — non-empty incoming overwrites; empty incoming never
//                    blanks (CSV rows the importer explicitly marked update).
//
// `custom` is jsonb shared by every form that writes the contact, so it
// always merges per key — a form can update its own keys but can never
// wholesale-replace answers other forms collected.

export type ContactEnrichmentMode = "fillBlanks" | "preferIncoming";

const blank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim().length === 0) ||
  (Array.isArray(value) && value.length === 0);

export const enrichContact = <Patch extends Record<string, unknown>>(
  existing: Record<string, unknown>,
  incoming: Patch,
  mode: ContactEnrichmentMode,
): Partial<Patch> => {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (key === "custom") continue;
    if (blank(value)) continue;
    if (mode === "fillBlanks" && !blank(existing[key])) continue;
    patch[key] = value;
  }
  const incomingCustom = incoming["custom"];
  if (incomingCustom !== undefined && incomingCustom !== null) {
    const existingCustom = existing["custom"];
    const merged: Record<string, unknown> = {
      ...(typeof existingCustom === "object" && existingCustom !== null ? existingCustom : {}),
    };
    for (const [key, value] of Object.entries(incomingCustom)) {
      if (!blank(value)) merged[key] = value;
    }
    patch["custom"] = merged;
  }
  return patch as Partial<Patch>;
};
