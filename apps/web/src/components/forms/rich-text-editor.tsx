import Placeholder from "@tiptap/extension-placeholder";
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
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
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
  placeholder,
  className,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    // SSR: render nothing on the server, mount on the client.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rte-content min-h-28 px-3 py-2 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.isEmpty ? "" : instance.getHTML());
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
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value);
  }, [editor, value]);

  const toggleLink = () => {
    if (editor === null) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL");
    if (url !== null && url.length > 0) {
      editor.chain().focus().setLink({ href: url }).run();
    }
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
        <ToolbarButton label="Link" active={state?.link} onClick={toggleLink}>
          <LinkIcon />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
