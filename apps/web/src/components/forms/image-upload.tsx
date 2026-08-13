import { ImageUpIcon, XIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function ImageUploadField({
  value,
  onChange,
  currentUrl = null,
  label,
  hint = "PNG, JPG, or SVG · 2 MB max",
  accept = "image/png,image/jpeg,image/svg+xml",
  maxBytes = 2 * 1024 * 1024,
  fallbackIcon,
  disabled = false,
  id,
  className,
}: {
  readonly value: File | null;
  readonly onChange: (file: File | null) => void;
  /** Existing image shown in the tile until a new file is chosen. */
  readonly currentUrl?: string | null;
  readonly label: string;
  readonly hint?: string;
  readonly accept?: string;
  readonly maxBytes?: number;
  readonly fallbackIcon?: ReactNode;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  useEffect(() => {
    if (value === null) {
      setPreviewUrl(currentUrl);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentUrl, value]);

  const choose = (file: File | undefined) => {
    if (file === undefined || disabled) return;
    const types = accept.split(",").map((type) => type.trim());
    const accepted = types.some((type) =>
      type === "image/*" ? file.type.startsWith("image/") : type === file.type,
    );
    if (!accepted) {
      toast.error(`Use ${hint.split("·")[0]?.trim() ?? "a supported image format"}`);
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`Images must be ${formatSize(maxBytes)} or smaller`);
      return;
    }
    onChange(file);
  };

  return (
    <label
      aria-label={label}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-2.5 transition-colors hover:border-primary/40",
        dragging && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      onDragEnter={(dragEvent) => {
        dragEvent.preventDefault();
        setDragging(true);
      }}
      onDragOver={(dragEvent) => dragEvent.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(dragEvent) => {
        dragEvent.preventDefault();
        setDragging(false);
        choose(dragEvent.dataTransfer.files[0]);
      }}
    >
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
        {previewUrl === null ? (
          (fallbackIcon ?? <ImageUpIcon className="size-4 text-muted-foreground" />)
        ) : (
          <img src={previewUrl} alt="" className="size-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {value === null ? (
          <span className="block truncate text-xs font-medium">
            Drop an image or click to browse
          </span>
        ) : (
          <span className="block truncate text-xs font-medium">
            {value.name}
            <span className="ml-1.5 font-normal text-muted-foreground">
              {formatSize(value.size)}
            </span>
          </span>
        )}
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>
      </span>
      {value === null ? null : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Remove selected image"
          onClick={(clickEvent) => {
            clickEvent.preventDefault();
            onChange(null);
          }}
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
      <input
        id={id}
        type="file"
        className="sr-only"
        disabled={disabled}
        accept={accept}
        onChange={(inputEvent) => {
          choose(inputEvent.target.files?.[0]);
          inputEvent.target.value = "";
        }}
      />
    </label>
  );
}
