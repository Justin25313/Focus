import {
  DEFAULT_LIMITS,
  changeLimit,
  formatLimit,
  limitMinutesAt,
  limitStatus,
  parseLimits,
  settleLimit,
} from '../src/controls/limits';

const at = (d: number, h = 12) => new Date(2026, 8, d, h).getTime();

describe('daily limits', () => {
  it('tightening applies at once', () => {
    const limit = changeLimit({ minutes: 60 }, 30, at(24));
    expect(limit).toEqual({ minutes: 30 });
    expect(changeLimit({ minutes: null }, 30, at(24))).toEqual({
      minutes: 30,
    });
  });

  it('loosening or removing only from tomorrow', () => {
    const raised = changeLimit({ minutes: 30 }, 60, at(24, 23));
    expect(limitMinutesAt(raised, at(24, 23))).toBe(30);
    expect(limitMinutesAt(raised, at(25, 0))).toBe(60);
    const removed = changeLimit({ minutes: 30 }, null, at(24));
    expect(limitMinutesAt(removed, at(24))).toBe(30);
    expect(limitMinutesAt(removed, at(25))).toBeNull();
    expect(settleLimit(removed, at(25))).toEqual({ minutes: null });
    expect(settleLimit(removed, at(24))).toBe(removed);
  });

  it('tightening again cancels a pending loosening', () => {
    const raised = changeLimit({ minutes: 30 }, 60, at(24));
    expect(changeLimit(raised, 15, at(24))).toEqual({ minutes: 15 });
    // Choosing today's limit again drops the pending change.
    expect(changeLimit(raised, 30, at(24))).toEqual({ minutes: 30 });
  });

  it('reports remaining time and when it is reached', () => {
    expect(limitStatus({ minutes: null }, 9999, at(24))).toEqual({
      state: 'none',
    });
    expect(limitStatus({ minutes: 30 }, 600, at(24))).toEqual({
      state: 'ok',
      limitSeconds: 1800,
      remainingSeconds: 1200,
    });
    expect(limitStatus({ minutes: 30 }, 1800, at(24)).state).toBe('reached');
  });

  it('parses stored limits defensively', () => {
    expect(parseLimits(null)).toEqual(DEFAULT_LIMITS);
    expect(
      parseLimits({
        instagram: { minutes: 30, next: { minutes: null, from: '2026-09-25' } },
        youtube: { minutes: -5 },
        snapchat: { minutes: 10 },
      }),
    ).toEqual({
      ...DEFAULT_LIMITS,
      instagram: { minutes: 30, next: { minutes: null, from: '2026-09-25' } },
    });
    expect(
      parseLimits({ instagram: { minutes: 20, next: { minutes: 5 } } }),
    ).toEqual({ ...DEFAULT_LIMITS, instagram: { minutes: 20 } });
  });

  it('formats limits', () => {
    expect(formatLimit(null)).toBe('Aus');
    expect(formatLimit(45)).toBe('45 min');
    expect(formatLimit(90)).toBe('1 h 30 min');
    expect(formatLimit(120)).toBe('2 h');
  });
});
