import { NextRequest, NextResponse } from "next/server";
import { requireDealershipAccess, jsonAuthError } from "@/src/lib/auth-helpers";
import { isFlashAiConfigured, FLASH_AI_MODEL } from "@/src/lib/ai/llm";
import { AI_NOT_CONFIGURED_MESSAGE } from "@/src/lib/ai/guard";

/** GET /api/ai/status — configured flag only (no secret values). */
export async function GET(req: NextRequest) {
    const auth = await requireDealershipAccess(req);
    if (auth.error || !auth.profile) {
        return jsonAuthError(auth);
    }

    const configured = isFlashAiConfigured();
    return NextResponse.json({
        data: {
            configured,
            model: configured ? FLASH_AI_MODEL : null,
            provider: "flash_ai",
            message: configured
                ? "Flash AI ready (server-side only)."
                : AI_NOT_CONFIGURED_MESSAGE,
        },
    });
}
