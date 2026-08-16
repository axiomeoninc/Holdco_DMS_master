"use client";

import { useEffect, useId, useRef } from "react";

type StackEntry = {
    id: string;
    onClose: () => void;
};

/** Module-level stack so nested overlays dismiss topmost-first on Escape. */
const overlayDismissStack: StackEntry[] = [];
let listenerAttached = false;

function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (overlayDismissStack.length === 0) return;
    e.preventDefault();
    const top = overlayDismissStack[overlayDismissStack.length - 1];
    top?.onClose();
}

function ensureListener() {
    if (listenerAttached || typeof document === "undefined") return;
    listenerAttached = true;
    document.addEventListener("keydown", onDocumentKeyDown);
}

export type UseOverlayDismissOptions = {
    /** When false, do not register (default true — for always-mounted-when-rendered modals). */
    open?: boolean;
    /** Master switch; when false, skip registration. */
    enabled?: boolean;
    /** Same semantics as ModalShell: Escape does not close. */
    persistent?: boolean;
};

/**
 * Registers this overlay on a topmost-only Escape dismiss stack.
 * Escape closes only the top entry; nested OCR/confirm dismiss first.
 */
export function useOverlayDismiss(
    onClose: () => void,
    options: UseOverlayDismissOptions = {}
): void {
    const { open = true, enabled = true, persistent = false } = options;
    const id = useId();
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!enabled || persistent || open === false) return;

        ensureListener();
        const entry: StackEntry = {
            id,
            onClose: () => onCloseRef.current(),
        };
        overlayDismissStack.push(entry);

        return () => {
            const idx = overlayDismissStack.findIndex((e) => e.id === id);
            if (idx >= 0) overlayDismissStack.splice(idx, 1);
        };
    }, [id, open, enabled, persistent]);
}
