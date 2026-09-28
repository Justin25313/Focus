import {
  checkpointWindow,
  closeWindow,
  formatCountdown,
  lockoutMinutes,
  openWindow,
  parseWindow,
  setWindowRunning,
  settleWindow,
  windowStatus,
} from '../src/controls/timeWindow';

const MIN = 60 * 1000;
// Noon, so a few hours never cross midnight.
const T0 = new Date(2026, 8, 28, 12).getTime();

describe('time window', () => {
  it('opens paused and only runs while visible', () => {
    let w = openWindow(null, 10, T0);
    expect(windowStatus(w, T0 + 5 * MIN)).toEqual({
      state: 'active',
      remainingMs: 10 * MIN,
      running: false,
    });
    w = setWindowRunning(w, true, T0);
    expect(windowStatus(w, T0 + 3 * MIN)).toMatchObject({
      remainingMs: 7 * MIN,
      running: true,
    });
    // Messages tab, or Focus closed: paused …
    w = setWindowRunning(w, false, T0 + 3 * MIN);
    expect(windowStatus(w, T0 + 60 * MIN)).toMatchObject({
      remainingMs: 7 * MIN,
      running: false,
    });
    // … and continues from where it stopped.
    w = setWindowRunning(w, true, T0 + 60 * MIN);
    expect(windowStatus(w, T0 + 62 * MIN)).toMatchObject({
      remainingMs: 5 * MIN,
    });
  });

  it('locks once the budget is used up, from the moment it ran out', () => {
    let w = setWindowRunning(openWindow(null, 5, T0), true, T0);
    w = setWindowRunning(w, false, T0 + 2 * MIN);
    w = setWindowRunning(w, true, T0 + 30 * MIN);
    // 3 more minutes: ran out at T0 + 33 min.
    expect(windowStatus(w, T0 + 34 * MIN)).toEqual({
      state: 'locked',
      until: T0 + 38 * MIN,
    });
    expect(settleWindow(w, T0 + 34 * MIN)!.runningSince).toBeNull();
    expect(windowStatus(w, T0 + 38 * MIN)).toEqual({ state: 'idle' });
  });

  it('locks as long as the window for longer windows', () => {
    expect(lockoutMinutes(5)).toBe(5);
    expect(lockoutMinutes(15)).toBe(15);
    const w = setWindowRunning(openWindow(null, 15, T0), true, T0);
    expect(windowStatus(w, T0 + 20 * MIN)).toEqual({
      state: 'locked',
      until: T0 + 30 * MIN,
    });
  });

  it('cannot be extended or reopened while open or locked', () => {
    const w = openWindow(null, 10, T0);
    expect(openWindow(w, 10, T0 + MIN)).toBeNull();
    const closed = closeWindow(w, T0 + MIN);
    expect(openWindow(closed, 5, T0 + 5 * MIN)).toBeNull();
    expect(openWindow(closed, 5, T0 + 11 * MIN)).not.toBeNull();
  });

  it('caps the window at 15 minutes', () => {
    expect(openWindow(null, 90, T0)!.budgetMs).toBe(15 * MIN);
  });

  it('closing early starts the lockout at once', () => {
    const w = setWindowRunning(openWindow(null, 10, T0), true, T0);
    const closed = closeWindow(w, T0 + 2 * MIN);
    expect(windowStatus(closed, T0 + 2 * MIN)).toEqual({
      state: 'locked',
      until: T0 + 12 * MIN,
    });
    expect(closeWindow(closed, T0 + 3 * MIN)).toBe(closed);
    // Running a locked window changes nothing.
    expect(setWindowRunning(closed, true, T0 + 3 * MIN)).toBe(closed);
  });

  it('an unused rest expires at midnight', () => {
    const w = openWindow(null, 10, T0);
    expect(windowStatus(w, T0 + 11 * 60 * MIN)).toMatchObject({
      state: 'active',
    });
    expect(windowStatus(w, T0 + 13 * 60 * MIN)).toEqual({ state: 'idle' });
  });

  it('checkpoints keep running without losing time', () => {
    let w = setWindowRunning(openWindow(null, 10, T0), true, T0);
    w = checkpointWindow(w, T0 + MIN);
    expect(w).toMatchObject({ usedMs: MIN, runningSince: T0 + MIN });
    expect(windowStatus(w, T0 + 2 * MIN)).toMatchObject({
      remainingMs: 8 * MIN,
    });
  });
});

describe('stored window', () => {
  it('round-trips; a running window comes back paused at its checkpoint', () => {
    let w = setWindowRunning(openWindow(null, 10, T0), true, T0);
    w = checkpointWindow(w, T0 + 4 * MIN);
    const parsed = parseWindow(JSON.parse(JSON.stringify(w)), T0 + 30 * MIN);
    expect(windowStatus(parsed, T0 + 30 * MIN)).toEqual({
      state: 'active',
      remainingMs: 6 * MIN,
      running: false,
    });
    expect(parseWindow(null, T0)).toBeNull();
    expect(parseWindow({ budgetMs: 'x' }, T0)).toBeNull();
  });

  it('turns tampered data into a lockout, never into free Reels', () => {
    const forever = {
      budgetMs: 600 * MIN,
      usedMs: 0,
      runningSince: null,
      lockedUntil: null,
      day: '2026-09-28',
    };
    const parsed = parseWindow(forever, T0);
    expect(windowStatus(parsed, T0).state).toBe('locked');
    expect(windowStatus(parsed, T0 + 5 * MIN).state).toBe('idle');
  });

  it('migrates the old wall-clock sessions', () => {
    const old = {
      startedAt: T0,
      endsAt: T0 + 10 * MIN,
      lockedUntil: T0 + 20 * MIN,
    };
    expect(windowStatus(parseWindow(old, T0 + 4 * MIN), T0 + 4 * MIN)).toEqual({
      state: 'active',
      remainingMs: 6 * MIN,
      running: false,
    });
    expect(
      windowStatus(parseWindow(old, T0 + 12 * MIN), T0 + 12 * MIN),
    ).toEqual({ state: 'locked', until: T0 + 20 * MIN });
    expect(parseWindow(old, T0 + 21 * MIN)).toBeNull();
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
