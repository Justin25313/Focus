import {
  Controls,
  DEFAULT_CONTROLS,
  parseControls,
} from '../controls/controls';
import {
  DEFAULT_YOUTUBE_CONTROLS,
  YouTubeControls,
  parseYouTubeControls,
} from '../controls/youtube';
import { DEFAULT_LIMITS, DailyLimits, parseLimits } from '../controls/limits';
import { DEFAULT_X_CONTROLS, XControls, parseXControls } from '../controls/x';
import { ServiceId, isServiceId } from '../services/services';

/** Seconds of the pause before an app opens; 0 = off. */
export const PAUSE_OPTIONS_S = [0, 3, 5, 10] as const;
export type PauseSeconds = (typeof PAUSE_OPTIONS_S)[number];

export type FocusSettings = {
  schemaVersion: 8;
  onboardingComplete: boolean;
  /** Launch into the last used app instead of the Focus home. */
  openLastAppOnLaunch: boolean;
  keepLastLocation: boolean;
  grayscale: boolean;
  trackUsage: boolean;
  controls: Controls;
  youtube: YouTubeControls;
  x: XControls;
  /** The app Focus opens on launch: the one used last. */
  lastService: ServiceId;
  pauseSeconds: PauseSeconds;
  limits: DailyLimits;
};

export const DEFAULT_SETTINGS: FocusSettings = {
  schemaVersion: 8,
  onboardingComplete: false,
  openLastAppOnLaunch: false,
  keepLastLocation: true,
  grayscale: false,
  trackUsage: true,
  controls: DEFAULT_CONTROLS,
  youtube: DEFAULT_YOUTUBE_CONTROLS,
  x: DEFAULT_X_CONTROLS,
  lastService: 'instagram',
  pauseSeconds: 5,
  limits: DEFAULT_LIMITS,
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Turns whatever is in storage into valid settings. Unknown or broken
 * values fall back to defaults so an old or corrupted file never blocks
 * launch.
 *
 * Migrations:
 *  v1 → v2: adds `grayscale` and `controls` (defaults = Balanced).
 *  v2 → v3: adds `trackUsage` (default on, local only).
 *  v3 → v4: adds `youtube` controls and `lastService` (Instagram).
 *  v4 → v5: `openInstagramOnLaunch` becomes `openLastAppOnLaunch`, off:
 *           Focus now starts on its home with the app icons.
 *  v5 → v6: adds `pauseSeconds` (5) and daily `limits` (none).
 *  v6 → v7: adds X and Reddit (`x` controls: Following only).
 *  v7 → v8: Instagram's start is "Für dich" like the app (was the
 *           Following feed); the old default moves along.
 */
function migrateControls(controls: Controls, version: unknown): Controls {
  const old = typeof version === 'number' ? version : 0;
  return old < 8 && controls.homeFeed === 'following'
    ? { ...controls, homeFeed: 'normal' }
    : controls;
}

export function parseSettings(raw: unknown): FocusSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const data = raw as Record<string, unknown>;
  return {
    schemaVersion: 8,
    onboardingComplete: bool(
      data.onboardingComplete,
      DEFAULT_SETTINGS.onboardingComplete,
    ),
    openLastAppOnLaunch: bool(
      data.openLastAppOnLaunch,
      DEFAULT_SETTINGS.openLastAppOnLaunch,
    ),
    keepLastLocation: bool(
      data.keepLastLocation,
      DEFAULT_SETTINGS.keepLastLocation,
    ),
    grayscale: bool(data.grayscale, DEFAULT_SETTINGS.grayscale),
    trackUsage: bool(data.trackUsage, DEFAULT_SETTINGS.trackUsage),
    controls: migrateControls(parseControls(data.controls), data.schemaVersion),
    youtube: parseYouTubeControls(data.youtube),
    x: parseXControls(data.x),
    lastService: isServiceId(data.lastService) ? data.lastService : 'instagram',
    pauseSeconds: PAUSE_OPTIONS_S.includes(data.pauseSeconds as PauseSeconds)
      ? (data.pauseSeconds as PauseSeconds)
      : DEFAULT_SETTINGS.pauseSeconds,
    limits: parseLimits(data.limits),
  };
}
