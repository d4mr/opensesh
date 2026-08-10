import { BoldIcon, ItalicIcon, LinkIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  className,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly className?: string;
}) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editor.current !== null && document.activeElement !== editor.current) {
      editor.current.innerHTML = value;
    }
  }, [value]);
  const command = (name: "bold" | "italic" | "createLink") => {
    if (name === "createLink") {
      const url = window.prompt("Link URL");
      if (url !== null) document.execCommand(name, false, url);
    } else {
      document.execCommand(name);
    }
    editor.current?.focus();
    onChange(editor.current?.innerHTML ?? "");
  };
  return (
    <div className={cn("overflow-hidden rounded-md border bg-background", className)}>
      <div className="flex h-8 items-center gap-0.5 border-b bg-muted/40 px-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Bold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("bold")}
        >
          <BoldIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Italic"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("italic")}
        >
          <ItalicIcon />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Add link"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command("createLink")}
        >
          <LinkIcon />
        </Button>
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        className="min-h-28 px-3 py-2 text-sm outline-none [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onBlur={onBlur}
      />
    </div>
  );
}
