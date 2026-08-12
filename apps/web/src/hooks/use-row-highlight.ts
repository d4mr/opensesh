import { useCallback, useEffect, useRef, useState } from "react";

export function useRowHighlight(duration = 1500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(() => new Set());

  const clearRowHighlights = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (timer.current !== null) clearTimeout(timer.current);
    frame.current = null;
    timer.current = null;
    setHighlightedIds(new Set());
  }, []);

  const highlightRows = useCallback(
    (ids: Iterable<string>) => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (timer.current !== null) clearTimeout(timer.current);
      setHighlightedIds(new Set());
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setHighlightedIds(new Set(ids));
        timer.current = setTimeout(() => {
          timer.current = null;
          setHighlightedIds(new Set());
        }, duration);
      });
    },
    [duration],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return { highlightedIds, highlightRows, clearRowHighlights } as const;
}
