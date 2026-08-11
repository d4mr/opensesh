import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { type ReactElement, type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface EntityItem {
  readonly id: string;
}

const emptyItems: ReadonlyArray<never> = [];

interface TriggerRenderProps<T extends EntityItem> {
  readonly open: boolean;
  readonly selectedItems: ReadonlyArray<T>;
}

interface EntityComboboxSharedProps<T extends EntityItem> {
  readonly items?: ReadonlyArray<T>;
  readonly loadItems?: (query: string) => Promise<ReadonlyArray<T>>;
  readonly getItemText: (item: T) => string;
  readonly renderItem: (item: T) => ReactNode;
  readonly renderValue?: (item: T) => ReactNode;
  readonly renderTrigger?: (props: TriggerRenderProps<T>) => ReactElement;
  readonly footer?: ReactNode;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly emptyText?: string;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly contentClassName?: string;
  readonly contentSide?: "top" | "right" | "bottom" | "left";
}

type EntityComboboxProps<T extends EntityItem> = EntityComboboxSharedProps<T> &
  (
    | {
        readonly multiple: true;
        readonly value: ReadonlyArray<string>;
        readonly onChange: (value: ReadonlyArray<string>) => void;
      }
    | {
        readonly multiple?: false;
        readonly value: string;
        readonly onChange: (value: string) => void;
      }
  );

export function EntityCombobox<T extends EntityItem>(props: EntityComboboxProps<T>) {
  const {
    loadItems,
    getItemText,
    renderItem,
    renderValue = renderItem,
    renderTrigger,
    footer,
    placeholder = "Choose an item",
    searchPlaceholder = "Search…",
    emptyText = "No results found.",
    disabled,
    className,
    contentClassName,
    contentSide,
  } = props;
  const items: ReadonlyArray<T> = props.items ?? emptyItems;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ReadonlyArray<T>>(items);
  const [knownItems, setKnownItems] = useState<ReadonlyMap<string, T>>(
    () => new Map(items.map((item) => [item.id, item])),
  );

  useEffect(() => {
    setKnownItems((current) => {
      const next = new Map(current);
      let changed = false;
      for (const item of items) {
        if (next.get(item.id) !== item) changed = true;
        next.set(item.id, item);
      }
      return changed ? next : current;
    });
    if (loadItems === undefined) setResults(items);
  }, [items, loadItems]);

  useEffect(() => {
    if (!open || loadItems === undefined) return;
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void loadItems(query).then(
        (loaded) => {
          if (!active) return;
          setResults(loaded);
          setKnownItems((current) => {
            const next = new Map(current);
            for (const item of loaded) next.set(item.id, item);
            return next;
          });
          setSearching(false);
        },
        () => {
          if (active) setSearching(false);
        },
      );
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadItems, open, query]);

  const selectedIds = useMemo(
    () => new Set(props.multiple ? props.value : props.value.length === 0 ? [] : [props.value]),
    [props.multiple, props.value],
  );
  const selectedItems = Array.from(selectedIds).flatMap((id) => {
    const item = knownItems.get(id);
    return item === undefined ? [] : [item];
  });
  const visibleItems = loadItems === undefined ? items : results;

  const select = (id: string) => {
    if (props.multiple) {
      props.onChange(
        selectedIds.has(id)
          ? props.value.filter((selectedId) => selectedId !== id)
          : [...props.value, id],
      );
      return;
    }
    props.onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {renderTrigger === undefined ? (
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("h-auto min-h-9 w-full justify-between px-3 font-normal", className)}
          >
            {selectedItems.length === 0 ? (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            ) : props.multiple ? (
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selectedItems.map((item) => (
                  <span key={item.id}>{renderValue(item)}</span>
                ))}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-left">
                {selectedItems[0] === undefined ? placeholder : renderValue(selectedItems[0])}
              </span>
            )}
            <ChevronsUpDownIcon className="ml-2 size-3.5 shrink-0 opacity-50" />
          </Button>
        ) : (
          renderTrigger({ open, selectedItems })
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={contentSide}
        collisionPadding={8}
        className={cn("w-[var(--radix-popover-trigger-width)] min-w-64 p-0", contentClassName)}
      >
        <Command shouldFilter={loadItems === undefined} className="relative">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={searchPlaceholder}
            className="pr-20"
          />
          {/* Whisper inside the fixed-height input row — results below never shift. */}
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute top-0 right-3 flex h-9 items-center text-xs text-muted-foreground transition-opacity duration-200",
              searching ? "opacity-100" : "opacity-0",
            )}
          >
            {searching ? "Searching…" : null}
          </span>
          <CommandList>
            <CommandEmpty>
              {searching ? " " : <span className="text-muted-foreground">{emptyText}</span>}
            </CommandEmpty>
            <CommandGroup>
              {visibleItems.map((item) => {
                const selected = selectedIds.has(item.id);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    keywords={[getItemText(item)]}
                    className={cn("py-1.5", selected && "bg-muted")}
                    onSelect={() => select(item.id)}
                  >
                    <CheckIcon className={cn("size-3.5", selected ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {footer === undefined ? null : (
              <>
                <CommandSeparator />
                <CommandGroup>{footer}</CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
