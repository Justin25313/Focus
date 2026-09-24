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
import { ServiceId, isServiceId } from '../services/services';

export type FocusSettings = {
  schemaVersion: 5;
  onboardingComplete: boolean;
  /** Launch into the last used app instead of the Focus home. */
  openLastAppOnLaunch: boolean;
  keepLastLocation: boolean;
  grayscale: boolean;
  trackUsage: boolean;
  controls: Controls;
  youtube: YouTubeControls;
  /** The app Focus opens on launch: the one used last. */
  lastService: ServiceId;
};

export const DEFAULT_SETTINGS: FocusSettings = {
  schemaVersion: 5,
  onboardingComplete: false,
  openLastAppOnLaunch: false,
  keepLastLocation: true,
  grayscale: false,
  trackUsage: true,
  controls: DEFAULT_CONTROLS,
  youtube: DEFAULT_YOUTUBE_CONTROLS,
  lastService: 'instagram',
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
 */
export function parseSettings(raw: unknown): FocusSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const data = raw as Record<string, unknown>;
  return {
    schemaVersion: 5,
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
    controls: parseControls(data.controls),
    youtube: parseYouTubeControls(data.youtube),
    lastService: isServiceId(data.lastService) ? data.lastService : 'instagram',
  };
}
