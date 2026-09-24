/**
 * Local-only usage time: seconds per local calendar day. Nothing here
 * ever leaves the device. No streaks, no goals, no gamification.
 */
export type UsageLog = Record<string, number>;

export const KEEP_DAYS = 30;
/** A single interval longer than this is a clock glitch, not usage. */
const MAX_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** Local calendar day, e.g. "2026-09-24". */
export function dayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function startOfNextDay(ms: number): number {
  const date = new Date(ms);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
}

/** Adds [start, end) to the log, split across local midnights. */
export function addInterval(
  log: UsageLog,
  startMs: number,
  endMs: number,
): UsageLog {
  if (!(endMs > startMs) || endMs - startMs > MAX_INTERVAL_MS) {
    return log;
  }
  const next = { ...log };
  let cursor = startMs;
  while (cursor < endMs) {
    const boundary = Math.min(endMs, startOfNextDay(cursor));
    const key = dayKey(cursor);
    next[key] = (next[key] ?? 0) + (boundary - cursor) / 1000;
    cursor = boundary;
  }
  return next;
}

export function pruneLog(
  log: UsageLog,
  nowMs: number,
  keepDays = KEEP_DAYS,
): UsageLog {
  const oldest = dayKey(nowMs - keepDays * 24 * 60 * 60 * 1000);
  const next: UsageLog = {};
  for (const [key, seconds] of Object.entries(log)) {
    if (key >= oldest) {
      next[key] = seconds;
    }
  }
  return next;
}

export function parseUsageLog(raw: unknown): UsageLog {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }
  const log: UsageLog = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (
      DAY_KEY.test(key) &&
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0
    ) {
      log[key] = Math.min(value, 24 * 60 * 60);
    }
  }
  return log;
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export type UsageDay = {
  key: string;
  label: string;
  seconds: number;
  isToday: boolean;
};

export type UsageSummary = {
  todaySeconds: number;
  /** Total of the last 7 days (including today) divided by 7. */
  weekAverageSeconds: number;
  /** Last 7 days, oldest first. */
  days: UsageDay[];
};

export function summarize(log: UsageLog, nowMs: number): UsageSummary {
  const today = new Date(nowMs);
  const days: UsageDay[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset,
      12,
    );
    const key = dayKey(date.getTime());
    days.push({
      key,
      label: WEEKDAYS[date.getDay()],
      seconds: log[key] ?? 0,
      isToday: offset === 0,
    });
  }
  const total = days.reduce((sum, day) => sum + day.seconds, 0);
  return {
    todaySeconds: days[6].seconds,
    weekAverageSeconds: total / 7,
    days,
  };
}

/** "0 min", "18 min", "1 h 5 min". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
