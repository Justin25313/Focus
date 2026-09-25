import {
  DEFAULT_POLICY,
  INSTAGRAM_FOLLOWING_PATH,
  INSTAGRAM_HOME_PATH,
  INSTAGRAM_INBOX_PATH,
  RoutePolicy,
} from '../filtering/instagram/routes';

/**
 * What the home feed shows:
 *  following – only accounts you follow, newest first (Instagram's own
 *              "Following" feed, no suggestions)
 *  hidden    – Stories stay, feed posts are hidden
 *  normal    – Instagram's default "For you" feed (still filtered)
 *  off       – no home at all; Focus opens Messages instead
 */
export type HomeFeed = 'following' | 'hidden' | 'normal' | 'off';

export type Controls = {
  blockReels: boolean;
  blockExplore: boolean;
  blockStories: boolean;
  blockSaved: boolean;
  homeFeed: HomeFeed;
  hideSponsored: boolean;
  hideSuggested: boolean;
};

export type PresetId = 'balanced' | 'storiesMessages' | 'messages';
export type ModeId = PresetId | 'custom';

export const PRESETS: Record<PresetId, Controls> = {
  balanced: {
    blockReels: true,
    blockExplore: true,
    blockStories: false,
    blockSaved: false,
    // Like the app's start ("Für dich"); "Gefolgt" is one tap away.
    homeFeed: 'normal',
    hideSponsored: true,
    hideSuggested: true,
  },
  storiesMessages: {
    blockReels: true,
    blockExplore: true,
    blockStories: false,
    blockSaved: true,
    homeFeed: 'hidden',
    hideSponsored: true,
    hideSuggested: true,
  },
  messages: {
    blockReels: true,
    blockExplore: true,
    blockStories: true,
    blockSaved: true,
    homeFeed: 'off',
    hideSponsored: true,
    hideSuggested: true,
  },
};

export const PRESET_ORDER: PresetId[] = [
  'balanced',
  'storiesMessages',
  'messages',
];

export const DEFAULT_CONTROLS: Controls = PRESETS.balanced;

const KEYS = Object.keys(DEFAULT_CONTROLS) as (keyof Controls)[];

export function sameControls(a: Controls, b: Controls): boolean {
  return KEYS.every(key => a[key] === b[key]);
}

/** The preset these controls correspond to, or "custom". */
export function modeOf(controls: Controls): ModeId {
  return (
    PRESET_ORDER.find(id => sameControls(PRESETS[id], controls)) ?? 'custom'
  );
}

export function policyFor(controls: Controls): RoutePolicy {
  return {
    ...DEFAULT_POLICY,
    reels: controls.blockReels,
    sharedReel: controls.blockReels,
    explore: controls.blockExplore,
    stories: controls.blockStories,
    saved: controls.blockSaved,
    feed: controls.homeFeed === 'off',
  };
}

/** Where "home" is for these controls. */
export function homePathFor(controls: Controls): string {
  switch (controls.homeFeed) {
    case 'following':
      return INSTAGRAM_FOLLOWING_PATH;
    case 'off':
      return INSTAGRAM_INBOX_PATH;
    default:
      return INSTAGRAM_HOME_PATH;
  }
}

const HOME_FEEDS: HomeFeed[] = ['following', 'hidden', 'normal', 'off'];

export function parseControls(raw: unknown): Controls {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_CONTROLS };
  }
  const data = raw as Record<string, unknown>;
  const bool = (key: keyof Controls) =>
    typeof data[key] === 'boolean'
      ? (data[key] as boolean)
      : (DEFAULT_CONTROLS[key] as boolean);
  return {
    blockReels: bool('blockReels'),
    blockExplore: bool('blockExplore'),
    blockStories: bool('blockStories'),
    blockSaved: bool('blockSaved'),
    homeFeed: HOME_FEEDS.includes(data.homeFeed as HomeFeed)
      ? (data.homeFeed as HomeFeed)
      : DEFAULT_CONTROLS.homeFeed,
    hideSponsored: bool('hideSponsored'),
    hideSuggested: bool('hideSuggested'),
  };
}
