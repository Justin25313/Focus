import {
  endReelsSession,
  formatCountdown,
  lockoutMinutes,
  parseReelsSession,
  reelsStatus,
  startReelsSession,
} from '../src/controls/reelsSession';

const MIN = 60 * 1000;
const T0 = 1_800_000_000_000;

describe('Reels window', () => {
  it('runs for the chosen time, then locks for at least 5 minutes', () => {
    const session = startReelsSession(null, 5, T0)!;
    expect(reelsStatus(session, T0 + 4 * MIN)).toMatchObject({
      state: 'active',
      remainingMs: MIN,
    });
    expect(reelsStatus(session, T0 + 5 * MIN)).toEqual({
      state: 'locked',
      until: T0 + 10 * MIN,
    });
    expect(reelsStatus(session, T0 + 10 * MIN)).toEqual({ state: 'idle' });
  });

  it('locks as long as the window for longer windows', () => {
    expect(lockoutMinutes(5)).toBe(5);
    expect(lockoutMinutes(15)).toBe(15);
    const session = startReelsSession(null, 15, T0)!;
    expect(session.lockedUntil).toBe(T0 + 30 * MIN);
  });

  it('cannot be extended or restarted while running or locked', () => {
    const session = startReelsSession(null, 10, T0)!;
    expect(startReelsSession(session, 10, T0 + MIN)).toBeNull();
    expect(startReelsSession(session, 5, T0 + 12 * MIN)).toBeNull();
    expect(startReelsSession(session, 5, T0 + 20 * MIN)).not.toBeNull();
  });

  it('caps the window at 15 minutes', () => {
    const session = startReelsSession(null, 90, T0)!;
    expect(session.endsAt).toBe(T0 + 15 * MIN);
  });

  it('ending early starts the lockout immediately', () => {
    const session = startReelsSession(null, 10, T0)!;
    const ended = endReelsSession(session, T0 + 2 * MIN)!;
    expect(reelsStatus(ended, T0 + 2 * MIN)).toEqual({
      state: 'locked',
      until: T0 + 12 * MIN,
    });
    // Ending again changes nothing.
    expect(endReelsSession(ended, T0 + 3 * MIN)).toBe(ended);
  });
});

describe('stored session', () => {
  it('round-trips a valid session', () => {
    const session = startReelsSession(null, 5, T0)!;
    expect(parseReelsSession(JSON.parse(JSON.stringify(session)), T0)).toEqual(
      session,
    );
    expect(parseReelsSession(null, T0)).toBeNull();
    expect(parseReelsSession({ startedAt: 'x' }, T0)).toBeNull();
  });

  it('turns tampered data into a lockout, never into free Reels', () => {
    const forever = {
      startedAt: T0,
      endsAt: T0 + 600 * MIN,
      lockedUntil: T0 + 601 * MIN,
    };
    const parsed = parseReelsSession(forever, T0)!;
    expect(reelsStatus(parsed, T0).state).toBe('locked');
    expect(reelsStatus(parsed, T0 + 5 * MIN).state).toBe('idle');
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0:00'],
    [1500, '0:02'],
    [65_000, '1:05'],
    [10 * MIN, '10:00'],
  ])('%s ms → %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
