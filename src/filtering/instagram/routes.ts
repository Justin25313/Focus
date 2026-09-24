/**
 * Instagram route knowledge. This file is the single source of truth for
 * which Instagram paths Focus allows or blocks. The same rule data is used
 * natively (RouteGuard) and inside the page (guard script), so both layers
 * always agree.
 *
 * Route assumptions (mobile web, 2026-09) — verify during device QA:
 *   /reels/            Reels feed (swipeable, endless)            → block
 *   /reels/<id>/       Reel inside the feed viewer                → block
 *   /reel/<id>/        Single Reel page (shared links)            → block (M5 will allow exact shared Reels)
 *   /<user>/reels/     Profile Reels tab                          → block
 *   /explore/          Explore grid (also mobile web search tab)  → block
 *   /explore/tags/…    Hashtag grid                               → block
 *   /explore/search/   Plain search page                          → allow
 */

export const INSTAGRAM_RULE_VERSION = '2026.09.1';

export const INSTAGRAM_ORIGIN = 'https://www.instagram.com';
export const INSTAGRAM_HOME_PATH = '/';
export const INSTAGRAM_INBOX_PATH = '/direct/inbox/';

export type BlockReason = 'reels' | 'sharedReel' | 'explore';

export type RouteKind =
  | 'home'
  | 'direct'
  | 'profile'
  | 'post'
  | 'stories'
  | 'search'
  | 'auth'
  | 'other';

export type RouteRule =
  | { id: string; pattern: string; effect: 'allow' }
  | { id: string; pattern: string; effect: 'block'; reason: BlockReason };

/**
 * Ordered: the first matching rule wins. Patterns are matched
 * case-insensitively against the URL pathname.
 */
export const INSTAGRAM_ROUTE_RULES: readonly RouteRule[] = [
  { id: 'explore-search', pattern: '^/explore/search/?$', effect: 'allow' },
  {
    id: 'explore',
    pattern: '^/explore(?:/|$)',
    effect: 'block',
    reason: 'explore',
  },
  {
    id: 'reels-feed',
    pattern: '^/reels(?:/|$)',
    effect: 'block',
    reason: 'reels',
  },
  {
    id: 'reel-single',
    pattern: '^/reel(?:/|$)',
    effect: 'block',
    reason: 'sharedReel',
  },
  {
    id: 'profile-reels',
    pattern: '^/[^/]+/reels(?:/|$)',
    effect: 'block',
    reason: 'reels',
  },
];

/** Which block reasons are active. Milestone 2: everything is always on. */
export type RoutePolicy = Record<BlockReason, boolean>;

export const STRICT_POLICY: RoutePolicy = {
  reels: true,
  sharedReel: true,
  explore: true,
};

/**
 * First path segments that are Instagram features, never usernames.
 */
export const RESERVED_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
  'about',
  'accounts',
  'api',
  'ar',
  'auth_platform',
  'challenge',
  'create',
  'data',
  'developer',
  'direct',
  'download',
  'emails',
  'explore',
  'graphql',
  'legal',
  'lite',
  'login',
  'nametag',
  'notifications',
  'oauth',
  'p',
  'press',
  'privacy',
  'qp',
  'reel',
  'reels',
  'session',
  'signup',
  'stories',
  'terms',
  'tv',
  'two_factor',
  'web',
  'your_activity',
]);

/** Paths that belong to login, 2FA and security challenges. Never persisted. */
const AUTH_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
  'accounts',
  'auth_platform',
  'challenge',
  'login',
  'oauth',
  'session',
  'signup',
  'two_factor',
  'emails',
]);

const USERNAME = /^[a-z0-9._]{1,30}$/i;
const PROFILE_SUBPAGES: ReadonlySet<string> = new Set([
  'tagged',
  'saved',
  'followers',
  'following',
]);

export function isValidUsername(name: string): boolean {
  return (
    USERNAME.test(name) && !RESERVED_FIRST_SEGMENTS.has(name.toLowerCase())
  );
}

/** Classifies an already-allowed Instagram path. */
export function routeKindForPath(path: string): RouteKind {
  if (path === '/' || path === '') {
    return 'home';
  }
  const segments = path.split('/').filter(Boolean);
  const first = (segments[0] ?? '').toLowerCase();

  if (first === 'direct') {
    return 'direct';
  }
  if ((first === 'p' || first === 'tv') && segments.length >= 2) {
    return 'post';
  }
  if (first === 'stories') {
    return 'stories';
  }
  if (first === 'explore' && segments[1]?.toLowerCase() === 'search') {
    return 'search';
  }
  if (AUTH_FIRST_SEGMENTS.has(first)) {
    return 'auth';
  }
  if (
    isValidUsername(segments[0] ?? '') &&
    (segments.length === 1 ||
      (segments.length === 2 &&
        PROFILE_SUBPAGES.has((segments[1] ?? '').toLowerCase())))
  ) {
    return 'profile';
  }
  return 'other';
}

const PERSISTABLE_KINDS: ReadonlySet<RouteKind> = new Set([
  'home',
  'direct',
  'profile',
  'post',
]);

export function isPersistableKind(kind: RouteKind): boolean {
  return PERSISTABLE_KINDS.has(kind);
}

/** Hosts whose paths are subject to the route guard. */
export const GUARDED_HOSTS: ReadonlySet<string> = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
]);

/**
 * Hosts that may load inside the WebView besides the guarded ones:
 * other Instagram subdomains (link shim, help, account center) and
 * Facebook for "Continue with Facebook" login.
 */
export function isInAppHost(host: string): boolean {
  return (
    GUARDED_HOSTS.has(host) ||
    host.endsWith('.instagram.com') ||
    host === 'facebook.com' ||
    host.endsWith('.facebook.com')
  );
}

/** Schemes handed to iOS instead of loading in the WebView. */
export const SYSTEM_SCHEMES: ReadonlySet<string> = new Set([
  'itms-apps',
  'itms-appss',
  'mailto',
  'tel',
  'sms',
]);
