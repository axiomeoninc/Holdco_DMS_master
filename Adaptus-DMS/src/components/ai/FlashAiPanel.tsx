"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { AiNotConfiguredBanner } from "@/src/components/ai/AiNotConfiguredBanner";
import { Button } from "@/src/components/ui/Button";
import {
    formatDraftReadable,
    stripThinkingArtifacts,
    ThinkingStreamSanitizer,
} from "@/src/lib/ai/sanitize";
import { cn } from "@/src/lib/utils";

type ChatMsg = { role: "user" | "assistant"; content: string };

type FlashAiPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Optional seed prompt when opened from cmdk / page action */
    seed?: string | null;
};

export function FlashAiPanel({ open, onOpenChange, seed }: FlashAiPanelProps) {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [missing, setMissing] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const seededRef = useRef<string | null>(null);

    useEffect(() => {
        if (!open) return;
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, open, streaming]);

    useEffect(() => {
        if (!open || !seed?.trim()) return;
        if (seededRef.current === seed) return;
        seededRef.current = seed;
        setInput(seed);
    }, [open, seed]);

    const send = useCallback(
        async (text?: string) => {
            const content = (text ?? input).trim();
            if (!content || streaming) return;

            setMissing(false);
            setInput("");
            const nextMessages: ChatMsg[] = [
                ...messages,
                { role: "user", content },
            ];
            setMessages(nextMessages);
            setStreaming(true);

            try {
                const res = await fetch("/api/ai/copilot", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: nextMessages,
                        stream: true,
                    }),
                });

                if (res.status === 503) {
                    setMissing(true);
                    setMessages((m) => m.slice(0, -1));
                    return;
                }

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    const msg =
                        (err as { error?: string }).error ||
                        `Copilot failed (${res.status})`;
                    setMessages((m) => [
                        ...m,
                        { role: "assistant", content: `⚠️ ${msg}` },
                    ]);
                    return;
                }

                const ctype = res.headers.get("content-type") || "";
                if (ctype.includes("application/json")) {
                    const json = (await res.json()) as {
                        data?: { content?: string };
                    };
                    setMessages((m) => [
                        ...m,
                        {
                            role: "assistant",
                            content:
                                formatDraftReadable(json.data?.content || "") ||
                                "(empty)",
                        },
                    ]);
                    return;
                }

                setMessages((m) => [...m, { role: "assistant", content: "" }]);
                const reader = res.body?.getReader();
                if (!reader) {
                    setMessages((m) => [
                        ...m.slice(0, -1),
                        {
                            role: "assistant",
                            content: "⚠️ Empty stream from server",
                        },
                    ]);
                    return;
                }

                const decoder = new TextDecoder();
                const sanitizer = new ThinkingStreamSanitizer();
                let acc = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    acc += sanitizer.push(chunk);
                    const snapshot = formatDraftReadable(acc) || acc;
                    setMessages((m) => {
                        const copy = [...m];
                        copy[copy.length - 1] = {
                            role: "assistant",
                            content: snapshot,
                        };
                        return copy;
                    });
                }
                acc += sanitizer.flush();
                const finalText =
                    formatDraftReadable(acc) ||
                    stripThinkingArtifacts(acc) ||
                    "(empty)";
                setMessages((m) => {
                    const copy = [...m];
                    copy[copy.length - 1] = {
                        role: "assistant",
                        content: finalText,
                    };
                    return copy;
                });
            } catch (err) {
                setMessages((m) => [
                    ...m,
                    {
                        role: "assistant",
                        content: `⚠️ ${
                            err instanceof Error ? err.message : "Network error"
                        }`,
                    },
                ]);
            } finally {
                setStreaming(false);
            }
        },
        [input, messages, streaming]
    );

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange} direction="right">
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-[90] bg-foreground/40" />
                <Drawer.Content
                    className={cn(
                        "fixed bottom-0 right-0 z-[91] flex h-[100dvh] w-full flex-col border-l border-border bg-card outline-none",
                        "sm:max-w-md"
                    )}
                >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Sparkles className="h-4 w-4" />
                            </span>
                            <div>
                                <Drawer.Title className="text-sm font-semibold text-foreground">
                                    Ask Flash AI
                                </Drawer.Title>
                                <Drawer.Description className="text-xs text-muted-foreground">
                                    Desk copilot · Flash AI · dealership-scoped
                                </Drawer.Description>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                        {missing ? <AiNotConfiguredBanner compact /> : null}
                        {messages.length === 0 && !missing ? (
                            <div className="space-y-2 py-8 text-center text-sm text-muted-foreground">
                                <p>Ask about aging units, a lead, or a deal.</p>
                                <p className="text-xs">
                                    Tools search your dealership only. Drafts never auto-send.
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 pt-2">
                                    {[
                                        "What units are aging past 60 days?",
                                        "Summarize today's desk priorities",
                                        "Help me price-position an aging SUV",
                                    ].map((q) => (
                                        <button
                                            key={q}
                                            type="button"
                                            className="rounded-full border border-border bg-background px-3 py-1 text-xs hover:border-primary/40"
                                            onClick={() => void send(q)}
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        {messages.map((m, i) => (
                            <div
                                key={`${m.role}-${i}`}
                                className={cn(
                                    "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                                    m.role === "user"
                                        ? "ml-8 bg-primary/10 text-foreground"
                                        : "mr-4 bg-muted/60 text-foreground"
                                )}
                            >
                                {m.content ||
                                    (streaming && i === messages.length - 1 ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        ""
                                    ))}
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    <form
                        className="border-t border-border p-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void send();
                        }}
                    >
                        <div className="flex gap-2">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                rows={2}
                                placeholder="Ask Flash AI…"
                                className="min-h-[44px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        void send();
                                    }
                                }}
                            />
                            <Button
                                type="submit"
                                size="sm"
                                disabled={streaming || !input.trim()}
                                aria-label="Send"
                            >
                                {streaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </form>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
