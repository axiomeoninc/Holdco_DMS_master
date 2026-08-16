"use client";

import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { FlashAiPanel } from "@/src/components/ai/FlashAiPanel";

type FlashAiContextValue = {
    open: boolean;
    openPanel: (seed?: string) => void;
    closePanel: () => void;
};

const FlashAiContext = createContext<FlashAiContextValue | null>(null);

export function FlashAiProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [seed, setSeed] = useState<string | null>(null);

    const openPanel = useCallback((nextSeed?: string) => {
        setSeed(nextSeed?.trim() || null);
        setOpen(true);
    }, []);

    const closePanel = useCallback(() => setOpen(false), []);

    const value = useMemo(
        () => ({ open, openPanel, closePanel }),
        [open, openPanel, closePanel]
    );

    return (
        <FlashAiContext.Provider value={value}>
            {children}
            <FlashAiPanel
                open={open}
                onOpenChange={setOpen}
                seed={seed}
            />
        </FlashAiContext.Provider>
    );
}

export function useFlashAi(): FlashAiContextValue {
    const ctx = useContext(FlashAiContext);
    if (!ctx) {
        throw new Error("useFlashAi must be used within FlashAiProvider");
    }
    return ctx;
}
