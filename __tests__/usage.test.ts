import {
  addInterval,
  dayKey,
  formatDuration,
  parseUsageLog,
  pruneLog,
  summarize,
} from '../src/usage/usage';

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime();

describe('usage log', () => {
  it('adds an interval to its day', () => {
    const log = addInterval({}, at(2026, 9, 24, 10), at(2026, 9, 24, 10, 18));
    expect(log).toEqual({ '2026-09-24': 18 * 60 });
  });

  it('splits an interval across midnight', () => {
    const log = addInterval({}, at(2026, 9, 24, 23, 50), at(2026, 9, 25, 0, 5));
    expect(log).toEqual({ '2026-09-24': 600, '2026-09-25': 300 });
  });

  it('ignores negative and absurd intervals', () => {
    expect(addInterval({}, 10, 5)).toEqual({});
    expect(addInterval({}, 0, 7 * 60 * 60 * 1000)).toEqual({});
  });

  it('prunes days older than 30 days', () => {
    const now = at(2026, 9, 24, 12);
    const log = { '2026-08-01': 100, '2026-09-20': 50 };
    expect(pruneLog(log, now)).toEqual({ '2026-09-20': 50 });
  });

  it('parses stored data defensively', () => {
    expect(
      parseUsageLog({
        '2026-09-24': 120,
        '2026-9-1': 5,
        bad: 1,
        '2026-09-23': -4,
        '2026-09-22': 'x',
        '2026-09-21': 999999,
      }),
    ).toEqual({ '2026-09-24': 120, '2026-09-21': 86400 });
    expect(parseUsageLog(null)).toEqual({});
  });
});

describe('summary', () => {
  it('reports today and the 7-day average', () => {
    const now = at(2026, 9, 24, 18); // Thursday
    const summary = summarize(
      { '2026-09-24': 18 * 60, '2026-09-20': 30 * 60, '2026-09-10': 999 },
      now,
    );
    expect(summary.todaySeconds).toBe(18 * 60);
    expect(summary.weekAverageSeconds).toBe((48 * 60) / 7);
    expect(summary.days.map(d => d.label)).toEqual([
      'Fr',
      'Sa',
      'So',
      'Mo',
      'Di',
      'Mi',
      'Do',
    ]);
    expect(summary.days[6]).toMatchObject({ key: '2026-09-24', isToday: true });
    expect(dayKey(now)).toBe('2026-09-24');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 min'],
    [59, '0 min'],
    [18 * 60, '18 min'],
    [65 * 60, '1 h 5 min'],
    [120 * 60, '2 h'],
  ])('%s s → %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
