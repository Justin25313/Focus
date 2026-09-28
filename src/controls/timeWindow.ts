import { dayKey } from '../usage/usage';

/**
 * Time-boxed Reels and Shorts: an explicit budget (e.g. 10 minutes) you
 * choose on purpose, followed by a lockout once it is used up.
 *
 * The budget only runs while Reels (or Shorts) are actually on screen.
 * Closing Focus, locking the phone, switching to Messages or to another
 * app pauses it; coming back continues exactly where it stopped. A window
 * cannot be extended, and a new one cannot start before the lockout is
 * over. Whatever is left of a window expires at midnight.
 */
export type TimeWindow = {
  budgetMs: number;
  /** Time used, not counting the stretch since `runningSince`. */
  usedMs: number;
  /** Start of the current running stretch; null while paused. */
  runningSince: number | null;
  /** Set once the window is over: locked until then. */
  lockedUntil: number | null;
  /** Local day the window was opened ("2026-09-28"). */
  day: string;
};

export const WINDOW_MINUTES = [5, 10, 15] as const;
export const MIN_LOCKOUT_MIN = 5;
const MAX_WINDOW_MIN = 15;
const MINUTE = 60 * 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type WindowStatus =
  | { state: 'idle' }
  | { state: 'active'; remainingMs: number; running: boolean }
  | { state: 'locked'; until: number };

/** Lockout after a window: at least 5 minutes, or as long as the window. */
export function lockoutMinutes(windowMinutes: number): number {
  return Math.max(MIN_LOCKOUT_MIN, windowMinutes);
}

function lockoutMs(window: TimeWindow): number {
  return lockoutMinutes(Math.round(window.budgetMs / MINUTE)) * MINUTE;
}

/** Budget left at `now`, including a running stretch. */
export function remainingMs(window: TimeWindow, now: number): number {
  const running =
    window.runningSince === null ? 0 : Math.max(0, now - window.runningSince);
  return Math.max(0, window.budgetMs - window.usedMs - running);
}

/**
 * Brings a window up to date: a used-up budget becomes a lockout that
 * started the moment it ran out; an over lockout, or an unused rest from
 * an earlier day, is gone. Returns the same object if nothing changed.
 */
export function settleWindow(
  window: TimeWindow | null,
  now: number,
): TimeWindow | null {
  if (!window) {
    return null;
  }
  if (window.lockedUntil !== null) {
    return now < window.lockedUntil ? window : null;
  }
  if (remainingMs(window, now) <= 0) {
    const ranOutAt =
      window.runningSince === null
        ? now
        : window.runningSince + (window.budgetMs - window.usedMs);
    const lockedUntil = ranOutAt + lockoutMs(window);
    const locked = {
      ...window,
      usedMs: window.budgetMs,
      runningSince: null,
      lockedUntil,
    };
    return now < lockedUntil ? locked : null;
  }
  if (window.day !== dayKey(now)) {
    return null;
  }
  return window;
}

export function windowStatus(
  window: TimeWindow | null,
  now: number,
): WindowStatus {
  const settled = settleWindow(window, now);
  if (!settled) {
    return { state: 'idle' };
  }
  if (settled.lockedUntil !== null) {
    return { state: 'locked', until: settled.lockedUntil };
  }
  return {
    state: 'active',
    remainingMs: remainingMs(settled, now),
    running: settled.runningSince !== null,
  };
}

/** Opens a (paused) window, or returns null if one is open or locked. */
export function openWindow(
  current: TimeWindow | null,
  minutes: number,
  now: number,
): TimeWindow | null {
  if (settleWindow(current, now) !== null) {
    return null;
  }
  const length = Math.min(Math.max(1, Math.round(minutes)), MAX_WINDOW_MIN);
  return {
    budgetMs: length * MINUTE,
    usedMs: 0,
    runningSince: null,
    lockedUntil: null,
    day: dayKey(now),
  };
}

/** Runs or pauses the budget; a no-op unless the window is open. */
export function setWindowRunning(
  current: TimeWindow | null,
  running: boolean,
  now: number,
): TimeWindow | null {
  const window = settleWindow(current, now);
  if (!window || window.lockedUntil !== null) {
    return window;
  }
  if (running && window.runningSince === null) {
    return { ...window, runningSince: now };
  }
  if (!running && window.runningSince !== null) {
    return {
      ...window,
      usedMs: window.budgetMs - remainingMs(window, now),
      runningSince: null,
    };
  }
  return window;
}

/**
 * Folds the running stretch into `usedMs` (and keeps running), so a
 * stored copy is never more than one checkpoint behind.
 */
export function checkpointWindow(
  current: TimeWindow | null,
  now: number,
): TimeWindow | null {
  const window = settleWindow(current, now);
  if (!window || window.runningSince === null) {
    return window;
  }
  return {
    ...window,
    usedMs: window.budgetMs - remainingMs(window, now),
    runningSince: now,
  };
}

/** Ends an open window early; the lockout starts right away. */
export function closeWindow(
  current: TimeWindow | null,
  now: number,
): TimeWindow | null {
  const window = settleWindow(current, now);
  if (!window || window.lockedUntil !== null) {
    return window;
  }
  return {
    ...window,
    usedMs: window.budgetMs - remainingMs(window, now),
    runningSince: null,
    lockedUntil: now + lockoutMs(window),
  };
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Reads a stored window. A window that was running when Focus was closed
 * continues paused from its last checkpoint. Anything implausible (a
 * window longer than the maximum, times far in the future) is treated as
 * a short lockout, never as free Reels.
 */
export function parseWindow(raw: unknown, now: number): TimeWindow | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const lockout = (): TimeWindow => ({
    budgetMs: MIN_LOCKOUT_MIN * MINUTE,
    usedMs: MIN_LOCKOUT_MIN * MINUTE,
    runningSince: null,
    lockedUntil: now + MIN_LOCKOUT_MIN * MINUTE,
    day: dayKey(now),
  });

  // Before 0.17 a window ran on the wall clock.
  if ('startedAt' in data) {
    const { startedAt, endsAt, lockedUntil } = data;
    if (!finite(startedAt) || !finite(endsAt) || !finite(lockedUntil)) {
      return null;
    }
    if (
      endsAt < startedAt ||
      endsAt - startedAt > MAX_WINDOW_MIN * MINUTE ||
      lockedUntil < endsAt ||
      lockedUntil - endsAt > MAX_WINDOW_MIN * MINUTE ||
      startedAt > now + MINUTE
    ) {
      return lockout();
    }
    const budgetMs = endsAt - startedAt;
    return settleWindow(
      {
        budgetMs,
        usedMs: Math.min(budgetMs, Math.max(0, now - startedAt)),
        runningSince: null,
        lockedUntil: now < endsAt ? null : lockedUntil,
        day: dayKey(startedAt),
      },
      now,
    );
  }

  const { budgetMs, usedMs, runningSince, lockedUntil, day } = data;
  if (
    !finite(budgetMs) ||
    !finite(usedMs) ||
    !(runningSince === null || finite(runningSince)) ||
    !(lockedUntil === null || finite(lockedUntil)) ||
    typeof day !== 'string' ||
    !DAY.test(day)
  ) {
    return null;
  }
  const plausible =
    budgetMs > 0 &&
    budgetMs <= MAX_WINDOW_MIN * MINUTE &&
    usedMs >= 0 &&
    usedMs <= budgetMs &&
    (runningSince === null || runningSince <= now + MINUTE) &&
    (lockedUntil === null ||
      lockedUntil <= now + (MAX_WINDOW_MIN + 1) * MINUTE);
  if (!plausible) {
    return lockout();
  }
  return settleWindow(
    { budgetMs, usedMs, runningSince: null, lockedUntil, day },
    now,
  );
}

/** "4:07" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
