import {
  parseDiagnostics,
  EMPTY_DIAGNOSTICS,
} from '../src/storage/diagnostics';
import {
  addToSearchHistory,
  MAX_SEARCH_HISTORY,
  parseSearchHistory,
} from '../src/storage/searchHistory';
import { PRESETS } from '../src/controls/controls';
import { DEFAULT_SETTINGS, parseSettings } from '../src/storage/settings';

describe('parseSettings', () => {
  it('returns defaults for missing or broken data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values and drops invalid ones', () => {
    expect(
      parseSettings({
        onboardingComplete: true,
        openLastAppOnLaunch: true,
        keepLastLocation: 'yes',
        unknown: 1,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      onboardingComplete: true,
      openLastAppOnLaunch: true,
      keepLastLocation: true,
    });
  });

  it('migrates v1 settings to the Balanced controls', () => {
    const migrated = parseSettings({
      schemaVersion: 1,
      onboardingComplete: true,
      openInstagramOnLaunch: true,
      keepLastLocation: false,
    });
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.lastService).toBe('instagram');
    expect(migrated.youtube.blockShorts).toBe(true);
    expect(migrated.trackUsage).toBe(true);
    expect(migrated.keepLastLocation).toBe(false);
    expect(migrated.grayscale).toBe(false);
    expect(migrated.controls).toEqual(PRESETS.balanced);
  });

  it('repairs broken controls field by field', () => {
    const parsed = parseSettings({
      controls: { blockReels: false, homeFeed: 'weird', blockStories: 'yes' },
    });
    expect(parsed.controls).toEqual({ ...PRESETS.balanced, blockReels: false });
  });

  it('v4 → v5: starts on the Focus home with the app icons', () => {
    const migrated = parseSettings({
      schemaVersion: 4,
      onboardingComplete: true,
      openInstagramOnLaunch: true,
      lastService: 'snapchat',
    });
    expect(migrated.openLastAppOnLaunch).toBe(false);
    // Snapchat is gone; fall back to Instagram.
    expect(migrated.lastService).toBe('instagram');
  });

  it('defaults match the PRD personal configuration', () => {
    expect(DEFAULT_SETTINGS.openLastAppOnLaunch).toBe(false);
    expect(DEFAULT_SETTINGS.keepLastLocation).toBe(true);
  });
});

describe('parseDiagnostics', () => {
  it('tolerates junk', () => {
    expect(parseDiagnostics(undefined)).toEqual(EMPTY_DIAGNOSTICS);
    expect(
      parseDiagnostics({
        blockedCount: 'x',
        lastBlocked: { path: '/reels/', reason: 'nope', at: 1 },
      }),
    ).toEqual(EMPTY_DIAGNOSTICS);
  });

  it('round-trips valid data', () => {
    const data = {
      lastFilterReadyAt: 10,
      lastBlocked: { path: '/reels/', reason: 'reels' as const, at: 11 },
      blockedCount: 4,
      lastUnknownRoute: { path: '/x/y/z/', at: 12 },
      lastError: { code: 'FILTER_TIMEOUT', at: 13 },
      webProcessRestarts: 1,
      hiddenSponsored: 2,
      hiddenSuggested: 3,
    };
    expect(parseDiagnostics(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
});

describe('search history', () => {
  it('moves repeated names to the front, case-insensitively', () => {
    expect(addToSearchHistory(['a', 'natgeo', 'b'], 'NatGeo')).toEqual([
      'NatGeo',
      'a',
      'b',
    ]);
  });

  it('is capped', () => {
    let history: string[] = [];
    for (let i = 0; i < 30; i++) {
      history = addToSearchHistory(history, `user${i}`);
    }
    expect(history).toHaveLength(MAX_SEARCH_HISTORY);
    expect(history[0]).toBe('user29');
  });

  it('drops invalid stored entries', () => {
    expect(parseSearchHistory(['ok', 5, 'explore', 'bad name'])).toEqual([
      'ok',
    ]);
    expect(parseSearchHistory('x')).toEqual([]);
  });
});
