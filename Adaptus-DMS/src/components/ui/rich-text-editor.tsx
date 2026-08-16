"use client";

// TipTap rich text — vehicle descriptions / notes. Stores HTML; plain text still works.

import { useEffect } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Undo2,
    Redo2,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

export type RichTextEditorProps = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    minHeight?: number;
    editable?: boolean;
};

function toEditorContent(value: string): string {
    const v = value?.trim() ?? "";
    if (!v) return "";
    if (v.startsWith("<")) return v;
    return `<p>${v
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "</p><p>")}</p>`;
}

function ToolbarButton({
    onClick,
    active,
    disabled,
    label,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    label: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
                active && "bg-primary-50 text-primary"
            )}
        >
            {children}
        </button>
    );
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = "Write…",
    label,
    className,
    minHeight = 120,
    editable = true,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content: toEditorContent(value),
        editable,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm max-w-none px-3 py-2 focus:outline-none",
                    "text-sm text-foreground [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1"
                ),
                "data-placeholder": placeholder,
            },
        },
        onUpdate: ({ editor: ed }) => {
            const html = ed.isEmpty ? "" : ed.getHTML();
            onChange(html);
        },
    });

    useEffect(() => {
        if (!editor) return;
        const next = toEditorContent(value);
        const current = editor.isEmpty ? "" : editor.getHTML();
        if (next === current) return;
        // External reset / template apply — don't re-emit onChange
        editor.commands.setContent(next || "", { emitUpdate: false });
    }, [value, editor]);

    if (!editor) {
        return (
            <div className={cn("space-y-1.5", className)}>
                {label ? <p className="text-sm font-medium text-foreground">{label}</p> : null}
                <div
                    className="animate-pulse rounded-md border border-border bg-muted/40"
                    style={{ minHeight }}
                />
            </div>
        );
    }

    return (
        <div className={cn("space-y-1.5", className)}>
            {label ? <p className="text-sm font-medium text-foreground">{label}</p> : null}
            <div className="overflow-hidden rounded-md border border-border bg-card focus-within:ring-2 focus-within:ring-ring">
                {editable ? (
                    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-1.5 py-1">
                        <ToolbarButton
                            label="Bold"
                            active={editor.isActive("bold")}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                        >
                            <Bold className="h-3.5 w-3.5" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Italic"
                            active={editor.isActive("italic")}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                        >
                            <Italic className="h-3.5 w-3.5" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Bullet list"
                            active={editor.isActive("bulletList")}
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                        >
                            <List className="h-3.5 w-3.5" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Numbered list"
                            active={editor.isActive("orderedList")}
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        >
                            <ListOrdered className="h-3.5 w-3.5" />
                        </ToolbarButton>
                        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                        <ToolbarButton
                            label="Undo"
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={!editor.can().undo()}
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                        </ToolbarButton>
                        <ToolbarButton
                            label="Redo"
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={!editor.can().redo()}
                        >
                            <Redo2 className="h-3.5 w-3.5" />
                        </ToolbarButton>
                    </div>
                ) : null}
                <EditorContent editor={editor} style={{ minHeight }} />
            </div>
        </div>
    );
}

/** Read-only HTML / plain description display. */
export function RichTextDisplay({
    value,
    empty = "—",
    className,
}: {
    value?: string | null;
    empty?: string;
    className?: string;
}) {
    const v = value?.trim() ?? "";
    if (!v) {
        return <p className={cn("text-sm text-muted-foreground", className)}>{empty}</p>;
    }
    if (v.startsWith("<")) {
        return (
            <div
                className={cn(
                    "prose prose-sm max-w-none text-sm leading-relaxed text-foreground/85 [&_p]:my-1",
                    className
                )}
                dangerouslySetInnerHTML={{ __html: v }}
            />
        );
    }
    return (
        <p className={cn("whitespace-pre-line text-sm leading-relaxed text-foreground/85", className)}>
            {v}
        </p>
    );
}
