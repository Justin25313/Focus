/**
 * Time-boxed Reels: an explicit, short window in which Reels are allowed,
 * followed by a lockout. A window cannot be extended, and a new one
 * cannot start before the lockout is over. Wall-clock based, so closing
 * or backgrounding Focus does not pause the timer.
 */
export type ReelsSession = {
  startedAt: number;
  endsAt: number;
  /** Reels stay locked until this moment. */
  lockedUntil: number;
};

export const REELS_WINDOWS_MIN = [5, 10, 15] as const;
export const MIN_LOCKOUT_MIN = 5;
const MAX_WINDOW_MIN = 15;
const MINUTE = 60 * 1000;

export type ReelsStatus =
  | { state: 'idle' }
  | { state: 'active'; endsAt: number; remainingMs: number }
  | { state: 'locked'; until: number };

/** Lockout after a window: at least 5 minutes, or as long as the window. */
export function lockoutMinutes(windowMinutes: number): number {
  return Math.max(MIN_LOCKOUT_MIN, windowMinutes);
}

export function reelsStatus(
  session: ReelsSession | null,
  now: number,
): ReelsStatus {
  if (!session) {
    return { state: 'idle' };
  }
  if (now < session.endsAt) {
    return {
      state: 'active',
      endsAt: session.endsAt,
      remainingMs: session.endsAt - now,
    };
  }
  if (now < session.lockedUntil) {
    return { state: 'locked', until: session.lockedUntil };
  }
  return { state: 'idle' };
}

/** Starts a window, or returns null if one is running or locked. */
export function startReelsSession(
  current: ReelsSession | null,
  minutes: number,
  now: number,
): ReelsSession | null {
  if (reelsStatus(current, now).state !== 'idle') {
    return null;
  }
  const window = Math.min(Math.max(1, Math.round(minutes)), MAX_WINDOW_MIN);
  const endsAt = now + window * MINUTE;
  return {
    startedAt: now,
    endsAt,
    lockedUntil: endsAt + lockoutMinutes(window) * MINUTE,
  };
}

/** Ends a running window early; the lockout starts right away. */
export function endReelsSession(
  current: ReelsSession | null,
  now: number,
): ReelsSession | null {
  if (!current || reelsStatus(current, now).state !== 'active') {
    return current;
  }
  const window = Math.round((current.endsAt - current.startedAt) / MINUTE);
  return {
    ...current,
    endsAt: now,
    lockedUntil: now + lockoutMinutes(window) * MINUTE,
  };
}

/**
 * Reads a stored session. Anything implausible (e.g. a window longer than
 * the maximum, or times far in the future) is treated as a lockout that
 * ends at the latest possible moment, never as free Reels.
 */
export function parseReelsSession(
  raw: unknown,
  now: number,
): ReelsSession | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const { startedAt, endsAt, lockedUntil } = data;
  if (
    typeof startedAt !== 'number' ||
    typeof endsAt !== 'number' ||
    typeof lockedUntil !== 'number' ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endsAt) ||
    !Number.isFinite(lockedUntil)
  ) {
    return null;
  }
  const plausible =
    startedAt <= endsAt &&
    endsAt - startedAt <= MAX_WINDOW_MIN * MINUTE &&
    endsAt <= lockedUntil &&
    lockedUntil - endsAt <= MAX_WINDOW_MIN * MINUTE &&
    startedAt <= now + MINUTE;
  if (plausible) {
    return { startedAt, endsAt, lockedUntil };
  }
  return {
    startedAt: now,
    endsAt: now,
    lockedUntil: now + MIN_LOCKOUT_MIN * MINUTE,
  };
}

/** "4:07" */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
