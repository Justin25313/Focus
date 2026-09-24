export type FocusSettings = {
  schemaVersion: 1;
  onboardingComplete: boolean;
  openInstagramOnLaunch: boolean;
  keepLastLocation: boolean;
};

export const DEFAULT_SETTINGS: FocusSettings = {
  schemaVersion: 1,
  onboardingComplete: false,
  openInstagramOnLaunch: true,
  keepLastLocation: true,
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Turns whatever is in storage into valid settings. Unknown or broken
 * values fall back to defaults so an old or corrupted file never blocks
 * launch. New schema versions add their migration steps here.
 */
export function parseSettings(raw: unknown): FocusSettings {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const data = raw as Record<string, unknown>;
  return {
    schemaVersion: 1,
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
  };
}
