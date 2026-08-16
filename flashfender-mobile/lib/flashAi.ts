import { ApiError, apiFetch } from '@/lib/api';
import { isRecord } from '@/lib/parse';
import type { FlashAiMessage } from '@/lib/types';

export type FlashAiReply = {
  content: string;
};

/**
 * Desk Flash AI copilot. Drafts only — never sends email/SMS.
 * Uses non-streaming JSON so React Native can parse a single response.
 */
export async function askFlashAi(
  messages: FlashAiMessage[],
): Promise<FlashAiReply> {
  try {
    const body = await apiFetch('/api/ai/copilot', {
      method: 'POST',
      body: {
        messages,
        stream: false,
      },
    });

    if (!isRecord(body)) {
      throw new Error('Invalid Flash AI response');
    }
    const data = isRecord(body.data) ? body.data : body;
    const content =
      typeof data.content === 'string' ? data.content.trim() : '';
    if (content.length === 0) {
      throw new Error('Flash AI returned an empty reply');
    }
    return { content };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        throw new ApiError(
          401,
          'Sign in again to use Flash AI.',
          err.code,
        );
      }
      if (err.status === 402) {
        throw new ApiError(
          402,
          'Flash AI is not available on this plan.',
          err.code,
        );
      }
      if (err.status === 503) {
        throw new ApiError(
          503,
          'Flash AI is not configured for this dealership.',
          err.code,
        );
      }
    }
    throw err;
  }
}
