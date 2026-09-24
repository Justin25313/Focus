import {
  Controls,
  DEFAULT_CONTROLS,
  parseControls,
} from '../controls/controls';

export type FocusSettings = {
  schemaVersion: 2;
  onboardingComplete: boolean;
  openInstagramOnLaunch: boolean;
  keepLastLocation: boolean;
  grayscale: boolean;
  controls: Controls;
};

export const DEFAULT_SETTINGS: FocusSettings = {
  schemaVersion: 2,
  onboardingComplete: false,
  openInstagramOnLaunch: true,
  keepLastLocation: true,
  grayscale: false,
  controls: DEFAULT_CONTROLS,
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
 */
export function parseSettings(raw: unknown): FocusSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const data = raw as Record<string, unknown>;
  return {
    schemaVersion: 2,
    onboardingComplete: bool(
      data.onboardingComplete,
      DEFAULT_SETTINGS.onboardingComplete,
    ),
    openInstagramOnLaunch: bool(
      data.openInstagramOnLaunch,
      DEFAULT_SETTINGS.openInstagramOnLaunch,
    ),
    keepLastLocation: bool(
      data.keepLastLocation,
      DEFAULT_SETTINGS.keepLastLocation,
    ),
    grayscale: bool(data.grayscale, DEFAULT_SETTINGS.grayscale),
    controls: parseControls(data.controls),
  };
}
