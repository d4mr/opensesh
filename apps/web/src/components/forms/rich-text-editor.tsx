import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BoldIcon,
  CodeIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  StrikethroughIcon,
  TextQuoteIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  readonly label: string;
  readonly active?: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      aria-pressed={active}
      className={cn("size-6", active && "bg-muted text-foreground")}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

const ToolbarDivider = () => <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />;

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  className,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly placeholder?: string;
  readonly className?: string;
}) {
  // Rich text is stored as markdown; the editor parses it on load and
  // serializes back on every update.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false },
        // No toolbar button and no markdown syntax — keep Cmd+U inert.
        underline: false,
      }),
      Markdown,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    contentType: "markdown",
    // SSR: render nothing on the server, mount on the client.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rte-content min-h-28 px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? "" : instance.getMarkdown());
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  const state = useEditorState({
    editor,
    selector: (context) => ({
      bold: context.editor?.isActive("bold") ?? false,
      italic: context.editor?.isActive("italic") ?? false,
      strike: context.editor?.isActive("strike") ?? false,
      code: context.editor?.isActive("code") ?? false,
      h2: context.editor?.isActive("heading", { level: 2 }) ?? false,
      h3: context.editor?.isActive("heading", { level: 3 }) ?? false,
      bulletList: context.editor?.isActive("bulletList") ?? false,
      orderedList: context.editor?.isActive("orderedList") ?? false,
      blockquote: context.editor?.isActive("blockquote") ?? false,
      link: context.editor?.isActive("link") ?? false,
    }),
  });

  useEffect(() => {
    if (editor === null || editor.isFocused) return;
    const current = editor.isEmpty ? "" : editor.getMarkdown();
    if (value !== current) editor.commands.setContent(value, { contentType: "markdown" });
  }, [editor, value]);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Radix's open-autofocus event is unreliable here and the editor can win
  // the DOM focus race back after open — typing would then land in the
  // document. Claim focus for the URL input until it sticks (bounded).
  useEffect(() => {
    if (!linkOpen) return;
    let tries = 0;
    const claim = () => {
      const input = linkInputRef.current;
      tries += 1;
      if (input !== null && document.activeElement !== input) {
        input.focus();
        input.select();
      }
      if ((input !== null && document.activeElement === input) || tries >= 8) {
        clearInterval(id);
      }
    };
    const id = setInterval(claim, 40);
    claim();
    return () => clearInterval(id);
  }, [linkOpen]);

  const onLinkOpenChange = (open: boolean) => {
    if (open) {
      const href: unknown = editor?.getAttributes("link").href;
      setLinkUrl(typeof href === "string" ? href : "");
    }
    setLinkOpen(open);
  };

  const applyLink = () => {
    if (editor === null) return;
    const url = linkUrl.trim();
    if (url.length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div className={cn("overflow-hidden rounded-md border bg-background", className)}>
      <div className="flex h-8 items-center gap-0.5 overflow-x-auto border-b bg-muted/40 px-1">
        <ToolbarButton
          label="Bold"
          active={state?.bold}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={state?.italic}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={state?.strike}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <StrikethroughIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={state?.code}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <CodeIcon />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Heading 2"
          active={state?.h2}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2Icon />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={state?.h3}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3Icon />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          label="Bullet list"
          active={state?.bulletList}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state?.orderedList}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={state?.blockquote}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <TextQuoteIcon />
        </ToolbarButton>
        <ToolbarDivider />
        <Popover open={linkOpen} onOpenChange={onLinkOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Link"
              aria-pressed={state?.link}
              className={cn(
                "size-6",
                (state?.link === true || linkOpen) && "bg-muted text-foreground",
              )}
              onMouseDown={(event) => event.preventDefault()}
            >
              <LinkIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            collisionPadding={8}
            className="w-72 p-1.5"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              linkInputRef.current?.focus();
            }}
          >
            <div className="flex items-center gap-1.5">
              <Input
                ref={linkInputRef}
                value={linkUrl}
                placeholder="https://example.com"
                aria-label="Link URL"
                className="h-7 flex-1 text-xs"
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
              />
              <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={applyLink}>
                Set
              </Button>
              {state?.link === true ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={removeLink}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
