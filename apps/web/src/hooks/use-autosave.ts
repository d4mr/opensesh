import { useEffect, useRef, useState } from "react";

export type AutosaveState = "saved" | "dirty" | "saving" | "error";

/**
 * The app's autosave contract (born in the form editor, shared by every
 * autosaving surface): saves never block the UI and persist in the
 * background; in-flight saves serialize, with a change made mid-save queuing
 * exactly one trailing save of the then-current values; dirtiness is a
 * payload-JSON compare against the last saved snapshot; two quiet seconds
 * after edits begin, the payload persists; leaving with unsaved changes
 * warns via beforeunload. The save callback owns error toasts and cache
 * invalidation — the hook only tracks state.
 */
export function useAutosave<TPayload>({
  buildPayload,
  save,
  enabled = true,
}: {
  readonly buildPayload: () => TPayload;
  readonly save: (
    payload: TPayload,
  ) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }>;
  readonly enabled?: boolean;
}) {
  const [state, setState] = useState<AutosaveState>("saved");
  const [error, setError] = useState<string>();
  const buildPayloadRef = useRef(buildPayload);
  buildPayloadRef.current = buildPayload;
  const saveRef = useRef(save);
  saveRef.current = save;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const lastSavedRef = useRef<string | null>(null);
  if (lastSavedRef.current === null) lastSavedRef.current = JSON.stringify(buildPayload());
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const persist = async (): Promise<void> => {
    if (!enabledRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    const payload = buildPayloadRef.current();
    const json = JSON.stringify(payload);
    if (json === lastSavedRef.current) {
      setState("saved");
      return;
    }
    inFlightRef.current = true;
    setState("saving");
    setError(undefined);
    const result = await saveRef.current(payload);
    inFlightRef.current = false;
    if (!result.ok) {
      setState("error");
      setError(result.message);
      return;
    }
    lastSavedRef.current = json;
    if (queuedRef.current) {
      queuedRef.current = false;
      return persist();
    }
    setState(
      JSON.stringify(buildPayloadRef.current()) === lastSavedRef.current ? "saved" : "dirty",
    );
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const markDirty = () => {
    if (!enabledRef.current || inFlightRef.current) return;
    setState((current) =>
      JSON.stringify(buildPayloadRef.current()) === lastSavedRef.current
        ? current === "saving"
          ? current
          : "saved"
        : "dirty",
    );
  };
  const markDirtyRef = useRef(markDirty);
  markDirtyRef.current = markDirty;
  // Trailing autosave: two quiet seconds after edits begin, persist.
  useEffect(() => {
    if (state !== "dirty") return;
    const timer = window.setTimeout(() => void persistRef.current(), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!enabledRef.current || stateRef.current === "saved") return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  // Stable identities so consumers can hold them in effect deps without
  // re-firing every render.
  const stable = useRef({
    persist: () => void persistRef.current(),
    markDirty: () => markDirtyRef.current(),
  });
  return { state, error, ...stable.current };
}
