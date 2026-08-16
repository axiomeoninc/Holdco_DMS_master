/**
 * Quiet-hours enforcement for SMS.
 * Sending is blocked inside the configured window (default 9PM–9AM, dealership timezone).
 * A message that is blocked is recorded honestly as blocked — never silently sent later.
 */

import { DEFAULT_QUIET_HOURS, type QuietHoursConfig } from "./config";

function minutesOf(hm: string | undefined): number {
  if (!hm) return -1;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return -1;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}

function minutesOfDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Returns true when `now` falls inside the quiet window.
 * When `enabled` is false, never blocks.
 */
export function isWithinQuietHours(
  now: Date,
  cfg: QuietHoursConfig = {}
): boolean {
  const enabled = cfg.enabled ?? DEFAULT_QUIET_HOURS.enabled;
  if (!enabled) return false;

  const start = minutesOf(cfg.start ?? DEFAULT_QUIET_HOURS.start);
  const end = minutesOf(cfg.end ?? DEFAULT_QUIET_HOURS.end);
  const cur = minutesOfDate(now);

  if (start < 0 || end < 0) return false;
  if (start === end) return true; // 24h window
  if (start < end) {
    return cur >= start && cur < end;
  }
  // window crosses midnight (e.g. 21:00 → 09:00)
  return cur >= start || cur < end;
}

/**
 * Read quiet-hours settings from the dealership `settings` JSON blob
 * (settings.sms_quiet_hours). Missing/invalid values fall back to defaults.
 */
export function quietHoursFromSettings(
  settings: Record<string, unknown> | null | undefined
): QuietHoursConfig {
  const raw =
    settings && typeof settings.sms_quiet_hours === "object" && settings.sms_quiet_hours !== null
      ? (settings.sms_quiet_hours as Record<string, unknown>)
      : {};
  return {
    enabled:
      typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_QUIET_HOURS.enabled,
    start: typeof raw.start === "string" ? raw.start : DEFAULT_QUIET_HOURS.start,
    end: typeof raw.end === "string" ? raw.end : DEFAULT_QUIET_HOURS.end,
    timezone:
      typeof raw.timezone === "string" ? raw.timezone : DEFAULT_QUIET_HOURS.timezone,
  };
}

export function quietHoursLabel(cfg: QuietHoursConfig): string {
  if (!cfg.enabled) return "Quiet hours off";
  return `Quiet hours ${cfg.start}–${cfg.end} ${cfg.timezone || "local"}`;
}
