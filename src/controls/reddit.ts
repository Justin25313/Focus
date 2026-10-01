import { RoutePolicy } from '../filtering/engine/types';

/**
 * Reddit: where "Home" leads.
 *  communities – a feed of only the communities you joined (default)
 *  reddit      – Reddit's own start page (with its suggestions)
 */
export type RedditHome = 'communities' | 'reddit';

export type RedditControls = {
  home: RedditHome;
  /** Popular, All and Erkunden (Reddit's endless feeds). */
  blockPopular: boolean;
};

export const DEFAULT_REDDIT_CONTROLS: RedditControls = {
  home: 'communities',
  blockPopular: true,
};

export function redditPolicyFor(controls: RedditControls): RoutePolicy {
  return {
    rHome: controls.home === 'communities',
    rPopular: controls.blockPopular,
  };
}

const HOMES: RedditHome[] = ['communities', 'reddit'];

export function parseRedditControls(raw: unknown): RedditControls {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_REDDIT_CONTROLS };
  }
  const data = raw as Record<string, unknown>;
  return {
    home: HOMES.includes(data.home as RedditHome)
      ? (data.home as RedditHome)
      : DEFAULT_REDDIT_CONTROLS.home,
    blockPopular:
      typeof data.blockPopular === 'boolean'
        ? data.blockPopular
        : DEFAULT_REDDIT_CONTROLS.blockPopular,
  };
}
