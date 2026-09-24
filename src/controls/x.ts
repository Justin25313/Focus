import { RoutePolicy } from '../filtering/engine/types';

/** X: what the home timeline shows. Erkunden/Trends are always blocked. */
export type XControls = {
  /** Keep the "Following" tab selected and remove "For you". */
  followingOnly: boolean;
};

export const DEFAULT_X_CONTROLS: XControls = { followingOnly: true };

export function xPolicyFor(): RoutePolicy {
  return { xExplore: true };
}

export function parseXControls(raw: unknown): XControls {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_X_CONTROLS };
  }
  const value = (raw as Record<string, unknown>).followingOnly;
  return {
    followingOnly:
      typeof value === 'boolean' ? value : DEFAULT_X_CONTROLS.followingOnly,
  };
}
