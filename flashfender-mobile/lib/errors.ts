import { ApiError } from '@/lib/api';

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message.length > 0) return err.message;
  return 'Something went wrong.';
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403;
}
