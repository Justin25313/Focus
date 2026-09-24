import { RouteRule, ServiceRules } from '../engine/types';

/**
 * YouTube mobile web (m.youtube.com). Route assumptions (2026-09):
 *   /shorts/<id>             Shorts player (endless swipe)   → block
 *   /@user/shorts, …         Channel Shorts tab              → block
 *   /                        Recommendation home             → mode-dependent
 *   /feed/subscriptions      Subscriptions                   → allow (not in "search only")
 *   /feed/explore, /trending, /gaming                        → block
 *   /watch, /results, /@user, /feed/you, /feed/library, /playlist → allow
 */
export const YOUTUBE_ORIGIN = 'https://m.youtube.com';
export const YOUTUBE_SUBSCRIPTIONS_PATH = '/feed/subscriptions';
export const YOUTUBE_YOU_PATH = '/feed/you';

export const YOUTUBE_ROUTE_RULES: readonly RouteRule[] = [
  { id: 'yt-home', pattern: '^/$', effect: 'block', reason: 'ytHome' },
  {
    id: 'yt-shorts',
    pattern: '^/shorts(?:/|$)',
    effect: 'block',
    reason: 'shorts',
  },
  {
    id: 'yt-channel-shorts',
    pattern: '^/(?:@[^/]+|channel/[^/]+|c/[^/]+|user/[^/]+)/shorts(?:/|$)',
    effect: 'block',
    reason: 'shorts',
  },
  {
    id: 'yt-subscriptions',
    pattern: '^/feed/subscriptions(?:/|$)',
    effect: 'block',
    reason: 'ytSubs',
  },
  {
    id: 'yt-explore',
    pattern: '^/(?:feed/(?:explore|trending)|gaming)(?:/|$)',
    effect: 'block',
    reason: 'ytExplore',
  },
];

const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);

/**
 * Google domains, including country ones: sign-in hops through e.g.
 * accounts.google.de to set its cookies there. Handing such a hop to
 * iOS breaks the login (white page) and can open the YouTube app.
 */
const GOOGLE_HOST = /^(?:[a-z0-9-]+\.)*google\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/;

/** Google sign-in and consent pages, short links. */
export function isYouTubeInAppHost(host: string): boolean {
  return (
    YOUTUBE_HOSTS.has(host) ||
    host.endsWith('.youtube.com') ||
    host === 'youtu.be' ||
    GOOGLE_HOST.test(host)
  );
}

export const YOUTUBE_SERVICE_RULES: ServiceRules = {
  rules: YOUTUBE_ROUTE_RULES,
  guardedHosts: YOUTUBE_HOSTS,
  isInAppHost: isYouTubeInAppHost,
};
