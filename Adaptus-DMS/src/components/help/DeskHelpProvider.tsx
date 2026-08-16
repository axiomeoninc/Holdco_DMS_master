"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { useFlashAi } from "@/src/components/ai/FlashAiProvider";
import {
    DESK_HELP_TOPICS,
    type DeskHelpTopicId,
} from "@/src/components/help/desk-help";

type DeskHelpContextValue = {
    openTopic: (id: DeskHelpTopicId) => void;
    close: () => void;
};

const DeskHelpContext = createContext<DeskHelpContextValue | null>(null);

export function useDeskHelp(): DeskHelpContextValue {
    const ctx = useContext(DeskHelpContext);
    if (!ctx) {
        throw new Error("useDeskHelp must be used within DeskHelpProvider");
    }
    return ctx;
}

export function DeskHelpProvider({ children }: { children: ReactNode }) {
    const { openPanel } = useFlashAi();
    const [topicId, setTopicId] = useState<DeskHelpTopicId | null>(null);

    const close = useCallback(() => setTopicId(null), []);
    const openTopic = useCallback((id: DeskHelpTopicId) => setTopicId(id), []);

    const value = useMemo(
        () => ({ openTopic, close }),
        [openTopic, close]
    );

    const topic = topicId ? DESK_HELP_TOPICS[topicId] : null;

    return (
        <DeskHelpContext.Provider value={value}>
            {children}
            {topic ? (
                <div
                    className="fixed inset-0 z-[85]"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="desk-help-title"
                >
                    <button
                        type="button"
                        className="absolute inset-0 bg-foreground/40"
                        onClick={close}
                        aria-label="Close help"
                    />
                    <div className="absolute left-1/2 top-[16vh] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card p-5 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <h2
                                id="desk-help-title"
                                className="text-base font-semibold text-foreground"
                            >
                                {topic.title}
                            </h2>
                            <button
                                type="button"
                                onClick={close}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {topic.body}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                onClick={() => {
                                    const seed = topic.flashSeed;
                                    close();
                                    openPanel(seed);
                                }}
                            >
                                <Sparkles className="h-4 w-4" />
                                Ask Flash AI
                            </Button>
                            <Button variant="outline" size="sm" onClick={close}>
                                Got it
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </DeskHelpContext.Provider>
    );
}
