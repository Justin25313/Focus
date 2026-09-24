import { RoutePolicy } from '../filtering/engine/types';
import {
  YOUTUBE_SUBSCRIPTIONS_PATH,
  YOUTUBE_YOU_PATH,
} from '../filtering/youtube/routes';

/**
 * What YouTube's start shows:
 *  subscriptions – your subscriptions instead of recommendations (default)
 *  search        – nothing to browse: search, watch, done
 *  normal        – YouTube's recommendation home (Shorts still filtered)
 */
export type YouTubeHome = 'subscriptions' | 'search' | 'normal';

export type YouTubeControls = {
  blockShorts: boolean;
  home: YouTubeHome;
  /** Hide "up next" recommendations below a video. */
  hideRelated: boolean;
  hideComments: boolean;
};

export const DEFAULT_YOUTUBE_CONTROLS: YouTubeControls = {
  blockShorts: true,
  home: 'subscriptions',
  hideRelated: true,
  hideComments: false,
};

export function youtubePolicyFor(controls: YouTubeControls): RoutePolicy {
  return {
    shorts: controls.blockShorts,
    ytHome: controls.home !== 'normal',
    ytSubs: controls.home === 'search',
    ytExplore: true,
  };
}

/** Where the YouTube start button leads. */
export function youtubeHomePathFor(controls: YouTubeControls): string {
  switch (controls.home) {
    case 'subscriptions':
      return YOUTUBE_SUBSCRIPTIONS_PATH;
    case 'search':
      return YOUTUBE_YOU_PATH;
    default:
      return '/';
  }
}

const HOMES: YouTubeHome[] = ['subscriptions', 'search', 'normal'];

export function parseYouTubeControls(raw: unknown): YouTubeControls {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_YOUTUBE_CONTROLS };
  }
  const data = raw as Record<string, unknown>;
  const bool = (key: 'blockShorts' | 'hideRelated' | 'hideComments') =>
    typeof data[key] === 'boolean'
      ? (data[key] as boolean)
      : DEFAULT_YOUTUBE_CONTROLS[key];
  return {
    blockShorts: bool('blockShorts'),
    home: HOMES.includes(data.home as YouTubeHome)
      ? (data.home as YouTubeHome)
      : DEFAULT_YOUTUBE_CONTROLS.home,
    hideRelated: bool('hideRelated'),
    hideComments: bool('hideComments'),
  };
}
