import { SERVICE_IDS, ServiceId } from '../services/services';
import { dayKey } from '../usage/usage';

/**
 * Daily time limit per app. Tightening applies at once; loosening
 * (a higher limit, or none) only from tomorrow – otherwise the limit
 * would be one tap away from meaningless exactly when it matters.
 */
export type DailyLimit = {
  /** Minutes per day; null = no limit. */
  minutes: number | null;
  /** A loosening that starts on `from` (a local day key). */
  next?: { minutes: number | null; from: string };
};

export type DailyLimits = Record<ServiceId, DailyLimit>;

export const LIMIT_OPTIONS_MIN = [15, 30, 45, 60, 90, 120] as const;
const MAX_LIMIT_MIN = 24 * 60;

export const DEFAULT_LIMITS: DailyLimits = {
  instagram: { minutes: null },
  youtube: { minutes: null },
  x: { minutes: null },
  reddit: { minutes: null },
};

function tomorrowKey(now: number): string {
  const date = new Date(now);
  return dayKey(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
      12,
    ).getTime(),
  );
}

/** The limit that counts on the day of `now`, in minutes (null = none). */
export function limitMinutesAt(limit: DailyLimit, now: number): number | null {
  if (limit.next && dayKey(now) >= limit.next.from) {
    return limit.next.minutes;
  }
  return limit.minutes;
}

/** Whether `a` allows more time than `b`. */
function looser(a: number | null, b: number | null): boolean {
  if (b === null) {
    return false;
  }
  return a === null || a > b;
}

/** Applies a change the user asked for, following the rule above. */
export function changeLimit(
  limit: DailyLimit,
  minutes: number | null,
  now: number,
): DailyLimit {
  const current = limitMinutesAt(limit, now);
  if (looser(minutes, current)) {
    if (current === minutes) {
      return { minutes: current };
    }
    return { minutes: current, next: { minutes, from: tomorrowKey(now) } };
  }
  return { minutes };
}

/** Drops a pending change once its day has come. */
export function settleLimit(limit: DailyLimit, now: number): DailyLimit {
  if (limit.next && dayKey(now) >= limit.next.from) {
    return { minutes: limit.next.minutes };
  }
  return limit;
}

function parseMinutes(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= MAX_LIMIT_MIN
  ) {
    return Math.round(value);
  }
  return undefined;
}

export function parseLimits(raw: unknown): DailyLimits {
  const out = { ...DEFAULT_LIMITS };
  if (typeof raw !== 'object' || raw === null) {
    return out;
  }
  const data = raw as Record<string, unknown>;
  for (const id of SERVICE_IDS) {
    const item = data[id];
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const { minutes, next } = item as Record<string, unknown>;
    const parsed = parseMinutes(minutes);
    if (parsed === undefined) {
      continue;
    }
    const limit: DailyLimit = { minutes: parsed };
    if (typeof next === 'object' && next !== null) {
      const n = next as Record<string, unknown>;
      const nextMinutes = parseMinutes(n.minutes);
      if (
        nextMinutes !== undefined &&
        typeof n.from === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(n.from)
      ) {
        limit.next = { minutes: nextMinutes, from: n.from };
      }
    }
    out[id] = limit;
  }
  return out;
}

export type LimitStatus =
  | { state: 'none' }
  | { state: 'ok'; limitSeconds: number; remainingSeconds: number }
  | { state: 'reached'; limitSeconds: number };

export function limitStatus(
  limit: DailyLimit,
  usedTodaySeconds: number,
  now: number,
): LimitStatus {
  const minutes = limitMinutesAt(limit, now);
  if (minutes === null) {
    return { state: 'none' };
  }
  const limitSeconds = minutes * 60;
  const remainingSeconds = limitSeconds - usedTodaySeconds;
  return remainingSeconds > 0
    ? { state: 'ok', limitSeconds, remainingSeconds }
    : { state: 'reached', limitSeconds };
}

/** "Aus", "30 min", "1 h 30 min" */
export function formatLimit(minutes: number | null): string {
  if (minutes === null) {
    return 'Aus';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  return rest
    ? `${Math.floor(minutes / 60)} h ${rest} min`
    : `${minutes / 60} h`;
}
