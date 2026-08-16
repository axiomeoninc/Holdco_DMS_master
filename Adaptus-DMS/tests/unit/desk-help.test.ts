import { describe, expect, it } from "vitest";
import {
    DESK_HELP_TOPICS,
    type DeskHelpTopicId,
} from "@/src/components/help/desk-help";

const REQUIRED: DeskHelpTopicId[] = [
    "quotation",
    "bos",
    "casl",
    "mvda",
    "palette",
    "desking",
];

describe("desk help topics", () => {
    it("covers every glossary id with title, body, and Flash seed", () => {
        for (const id of REQUIRED) {
            const topic = DESK_HELP_TOPICS[id];
            expect(topic.id).toBe(id);
            expect(topic.title.length).toBeGreaterThan(4);
            expect(topic.body.length).toBeGreaterThan(40);
            expect(topic.flashSeed.length).toBeGreaterThan(8);
        }
        expect(Object.keys(DESK_HELP_TOPICS).sort()).toEqual([...REQUIRED].sort());
    });

    it("does not claim Flash AI auto-sends", () => {
        expect(DESK_HELP_TOPICS.palette.body.toLowerCase()).toContain("never auto-send");
    });
});
