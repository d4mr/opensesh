const returnKey = (eventId: string) => `opensesh:portal-forms:return:${eventId}`;

interface PortalFormReturn {
  readonly formId: string;
  readonly scrollY: number;
}

const parseReturn = (value: string | null): PortalFormReturn | null => {
  if (value === null) return null;
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("formId" in parsed) ||
    !("scrollY" in parsed) ||
    typeof parsed.formId !== "string" ||
    typeof parsed.scrollY !== "number"
  ) {
    return null;
  }
  return { formId: parsed.formId, scrollY: parsed.scrollY };
};

export const rememberPortalFormList = (eventId: string, formId: string) => {
  window.sessionStorage.setItem(
    returnKey(eventId),
    JSON.stringify({ formId, scrollY: window.scrollY } satisfies PortalFormReturn),
  );
};

export const updatePortalFormReturnId = (eventId: string, formId: string) => {
  const current = parseReturn(window.sessionStorage.getItem(returnKey(eventId)));
  if (current === null) return;
  window.sessionStorage.setItem(returnKey(eventId), JSON.stringify({ ...current, formId }));
};

export const hasPortalFormListReturn = (eventId: string) =>
  parseReturn(window.sessionStorage.getItem(returnKey(eventId))) !== null;

export const takePortalFormListReturn = (eventId: string) => {
  const key = returnKey(eventId);
  const value = parseReturn(window.sessionStorage.getItem(key));
  window.sessionStorage.removeItem(key);
  return value;
};
