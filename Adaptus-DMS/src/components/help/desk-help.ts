export const OPEN_COMMAND_PALETTE_EVENT = "ff-open-command-palette";

export const DESK_TOUR_STORAGE_KEY = "ff-desk-tour-v1";

export type DeskHelpTopicId =
    | "quotation"
    | "bos"
    | "casl"
    | "mvda"
    | "palette"
    | "desking";

export type DeskHelpTopic = {
    id: DeskHelpTopicId;
    title: string;
    body: string;
    flashSeed: string;
};

export const DESK_HELP_TOPICS: Record<DeskHelpTopicId, DeskHelpTopic> = {
    quotation: {
        id: "quotation",
        title: "What’s a quotation?",
        body: "A quotation is a priced offer you send a customer before a deal is won. It is not a bill of sale and does not transfer the vehicle. Use it to lock numbers; convert to a deal when they say yes.",
        flashSeed: "Explain quotations vs deals in FlashFender.",
    },
    bos: {
        id: "bos",
        title: "What’s a bill of sale?",
        body: "The bill of sale (BOS) is the Ontario transfer document: buyer, seller, vehicle, odometer, price, and tax. Print or e-sign it after the deal is agreed — not instead of a quotation.",
        flashSeed: "Walk me through creating a bill of sale.",
    },
    casl: {
        id: "casl",
        title: "CASL consent",
        body: "Canada’s anti-spam law: leave marketing email and SMS unchecked until the customer agrees. Checking a box stores a timestamp. Unchecked means do not send promotional messages.",
        flashSeed: "How should I record CASL consent on a customer?",
    },
    mvda: {
        id: "mvda",
        title: "MVDA known damage",
        body: "Ontario MVDA: if the vehicle has known damage, check the disclosure box and write the notes before marking the unit Active. The compliance pack will refuse a “no damage” pack when damage is flagged.",
        flashSeed: "What is MVDA known-damage disclosure?",
    },
    palette: {
        id: "palette",
        title: "Jump with ⌘K",
        body: "Press ⌘K (Ctrl+K on Windows) to search vehicles, customers, deals, and leads, start common actions, or look up desk terms. Flash AI is in the same palette — drafts never auto-send.",
        flashSeed: "What can I do from the command palette?",
    },
    desking: {
        id: "desking",
        title: "Desking",
        body: "Desking estimates the monthly payment from sale price minus down payment and trade-in, over the term and rate you enter. It is a desk calculator — not a credit decision or lender commit.",
        flashSeed: "How does deal desking work?",
    },
};

const tourListeners = new Set<() => void>();

export function subscribeDeskTour(onStoreChange: () => void): () => void {
    tourListeners.add(onStoreChange);
    if (typeof window !== "undefined") {
        window.addEventListener("storage", onStoreChange);
    }
    return () => {
        tourListeners.delete(onStoreChange);
        if (typeof window !== "undefined") {
            window.removeEventListener("storage", onStoreChange);
        }
    };
}

export function readDeskTourStep(maxStep: number): number | "done" {
    if (typeof window === "undefined") return "done";
    try {
        const raw = window.localStorage.getItem(DESK_TOUR_STORAGE_KEY);
        if (raw === "done") return "done";
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 0 && n < maxStep) return n;
    } catch {
        /* private mode */
    }
    return 0;
}

export function writeDeskTourStep(value: number | "done"): void {
    try {
        window.localStorage.setItem(DESK_TOUR_STORAGE_KEY, String(value));
    } catch {
        /* ignore */
    }
    tourListeners.forEach((listener) => listener());
}

export function openCommandPalette(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
}
