import { XIcon } from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { useRowHighlight } from "@/hooks/use-row-highlight";
import { cn } from "@/lib/utils";

interface SpotlightChangeOptions {
  readonly replace: boolean;
  readonly keyboard: boolean;
}

export interface SpotlightListRenderProps {
  readonly compact: boolean;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
  readonly openSpotlight: (id: string) => void;
  readonly rowRef: (id: string) => (node: HTMLElement | null) => void;
  readonly rowClassName: (id: string) => string;
}

export function SpotlightLayout({
  spotlightId,
  orderedIds,
  highlightedIds: externalHighlightedIds,
  onSpotlightChange,
  clearFilters,
  list,
  panel,
  className,
}: {
  readonly spotlightId: string | undefined;
  readonly orderedIds: ReadonlyArray<string>;
  readonly highlightedIds?: ReadonlySet<string>;
  readonly onSpotlightChange: (id: string | undefined, options: SpotlightChangeOptions) => void;
  readonly clearFilters?: () => void;
  readonly list: (props: SpotlightListRenderProps) => ReactNode;
  readonly panel: ReactNode;
  readonly className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const previousId = useRef<string | undefined>(undefined);
  const firstLayout = useRef(true);
  const savedScrollTop = useRef(0);
  const keyboardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { highlightedIds: returnedRowIds, highlightRows, clearRowHighlights } = useRowHighlight();
  const [keyboardAction, setKeyboardAction] = useState(false);
  const compact = spotlightId !== undefined;
  const inView = compact && orderedIds.includes(spotlightId);

  const rememberScroll = useCallback(() => {
    savedScrollTop.current = scrollRef.current?.scrollTop ?? 0;
  }, []);

  const markKeyboardAction = useCallback((duration = 240) => {
    setKeyboardAction(true);
    if (keyboardTimer.current !== null) clearTimeout(keyboardTimer.current);
    keyboardTimer.current = setTimeout(() => setKeyboardAction(false), duration);
  }, []);

  const changeSpotlight = useCallback(
    (id: string | undefined, options: SpotlightChangeOptions) => {
      rememberScroll();
      clearRowHighlights();
      if (options.keyboard) markKeyboardAction(id === undefined ? 1500 : 240);
      else {
        setKeyboardAction(false);
        if (keyboardTimer.current !== null) clearTimeout(keyboardTimer.current);
      }
      onSpotlightChange(id, options);
    },
    [clearRowHighlights, markKeyboardAction, onSpotlightChange, rememberScroll],
  );

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const previous = previousId.current;

    if (firstLayout.current) {
      firstLayout.current = false;
      if (spotlightId !== undefined && inView) {
        rowRefs.current.get(spotlightId)?.scrollIntoView({ block: "nearest" });
      }
    } else {
      if (scroller !== null) scroller.scrollTop = savedScrollTop.current;
      if (previous !== undefined && spotlightId === undefined) {
        rowRefs.current.get(previous)?.scrollIntoView({ block: "nearest" });
        highlightRows([previous]);
      }
    }

    previousId.current = spotlightId;
  }, [highlightRows, inView, spotlightId]);

  useLayoutEffect(() => {
    if (externalHighlightedIds?.size !== 1) return;
    const id = externalHighlightedIds.values().next().value;
    if (id !== undefined) rowRefs.current.get(id)?.scrollIntoView({ block: "nearest" });
  }, [externalHighlightedIds]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const onScroll = () => rememberScroll();
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller?.removeEventListener("scroll", onScroll);
  }, [rememberScroll]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (spotlightId === undefined) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        changeSpotlight(undefined, { replace: true, keyboard: true });
        return;
      }

      const offset =
        event.key === "ArrowDown" || event.key.toLowerCase() === "j"
          ? 1
          : event.key === "ArrowUp" || event.key.toLowerCase() === "k"
            ? -1
            : 0;
      if (offset === 0) return;
      const index = orderedIds.indexOf(spotlightId);
      if (index < 0) return;
      const nextId = orderedIds[index + offset];
      if (nextId === undefined) return;
      event.preventDefault();
      changeSpotlight(nextId, { replace: true, keyboard: true });
      rowRefs.current.get(nextId)?.scrollIntoView({ block: "nearest" });
      rememberScroll();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeSpotlight, orderedIds, rememberScroll, spotlightId]);

  useEffect(
    () => () => {
      if (keyboardTimer.current !== null) clearTimeout(keyboardTimer.current);
    },
    [],
  );

  const rowRef = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      if (node === null) rowRefs.current.delete(id);
      else rowRefs.current.set(id, node);
    },
    [],
  );

  const rowClassName = useCallback(
    (id: string) =>
      cn(
        "spotlight-row relative border-l-2 border-l-transparent transition-colors [transition-duration:200ms] [transition-timing-function:var(--ease-out)]",
        id === spotlightId && "border-l-primary bg-muted hover:bg-muted",
        (returnedRowIds.has(id) || externalHighlightedIds?.has(id) === true) &&
          "spotlight-row-highlight",
      ),
    [externalHighlightedIds, returnedRowIds, spotlightId],
  );

  return (
    <div
      data-open={compact ? "true" : "false"}
      data-keyboard-action={keyboardAction ? "true" : "false"}
      className={cn("spotlight-layout min-h-0 flex-1", className)}
    >
      <div className="min-h-0 min-w-0 overflow-hidden">
        {list({
          compact,
          scrollRef,
          openSpotlight: (id) =>
            changeSpotlight(id, {
              replace: false,
              keyboard: false,
            }),
          rowRef,
          rowClassName,
        })}
      </div>
      <aside
        aria-label="Spotlight details"
        aria-hidden={!compact}
        className="min-h-0 min-w-0 overflow-hidden border-l bg-background"
      >
        {compact ? (
          <div className="spotlight-panel-inner flex h-full min-w-0 flex-col">
            {inView ? (
              panel
            ) : (
              <>
                <SpotlightPanelHeader
                  identity={<span className="text-xs font-medium">Spotlight</span>}
                  onClose={() => changeSpotlight(undefined, { replace: true, keyboard: false })}
                />
                <div className="grid flex-1 place-items-center p-6 text-center">
                  <div className="max-w-64">
                    <p className="text-sm font-medium">Not in this view</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The selected item is filtered out or no longer available.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="pressable mt-3"
                      onClick={
                        clearFilters ??
                        (() => changeSpotlight(undefined, { replace: true, keyboard: false }))
                      }
                    >
                      {clearFilters === undefined ? "Return to list" : "Clear filters"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function SpotlightPanelHeader({
  identity,
  status,
  actions,
  onClose,
}: {
  readonly identity: ReactNode;
  readonly status?: ReactNode;
  readonly actions?: ReactNode;
  readonly onClose: () => void;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        {identity}
        {status}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {actions}
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="pressable"
          aria-label="Close spotlight"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
    </header>
  );
}
