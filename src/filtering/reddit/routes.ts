import { encodeSearchQuery } from '../../search/encode';
import { isSignInHost } from '../engine/signIn';
import { RouteRule, ServiceRules } from '../engine/types';

/**
 * Reddit mobile web (www.reddit.com). Route assumptions (2026-09):
 *   /, /best, /hot, /new, …   Home feed with recommendations → block
 *   /r/popular, /r/all        Everything feeds               → block
 *   /explore, /t/…            Discovery                      → block
 *   /r/<name>, /r/<name>/comments/…, /user/…, /search, /notifications → allow
 * Focus's own Reddit start lists your communities instead.
 */
export const REDDIT_ORIGIN = 'https://www.reddit.com';
export const REDDIT_NOTIFICATIONS_PATH = '/notifications';

export const REDDIT_ROUTE_RULES: readonly RouteRule[] = [
  {
    id: 'reddit-home',
    pattern: '^/(?:(?:best|hot|new|top|rising|controversial)/?)?$',
    effect: 'block',
    reason: 'rHome',
  },
  {
    id: 'reddit-popular',
    pattern: '^/r/(?:popular|all)(?:/|$)',
    effect: 'block',
    reason: 'rPopular',
  },
  {
    id: 'reddit-explore',
    pattern: '^/(?:explore|t|topics)(?:/|$)',
    effect: 'block',
    reason: 'rPopular',
  },
];

const REDDIT_HOSTS: ReadonlySet<string> = new Set([
  'www.reddit.com',
  'reddit.com',
  'm.reddit.com',
  'new.reddit.com',
  'sh.reddit.com',
]);

export const REDDIT_SERVICE_RULES: ServiceRules = {
  rules: REDDIT_ROUTE_RULES,
  guardedHosts: REDDIT_HOSTS,
  isInAppHost: host =>
    REDDIT_HOSTS.has(host) ||
    host.endsWith('.reddit.com') ||
    host === 'redd.it' ||
    host.endsWith('.redd.it') ||
    host.endsWith('.redditmedia.com') ||
    isSignInHost(host),
};

const NAME = /^[A-Za-z0-9_]{2,21}$/;

/** "r/Name" or "/r/Name/…" → "Name"; anything else → null. */
export function subredditFromPath(path: string): string | null {
  const match = /^\/r\/([A-Za-z0-9_]{2,21})(?:\/|$)/.exec(path);
  if (!match || /^(?:popular|all)$/i.test(match[1])) {
    return null;
  }
  return match[1];
}

/** What the user typed, if it can be a community name ("r/" optional). */
export function subredditFromInput(text: string): string | null {
  const name = text.trim().replace(/^\/?r\//i, '');
  return NAME.test(name) && !/^(?:popular|all)$/i.test(name) ? name : null;
}

export function redditUserFromInput(text: string): string | null {
  const match = /^\/?u(?:ser)?\/([A-Za-z0-9_-]{3,20})$/i.exec(text.trim());
  return match ? match[1] : null;
}

export function redditSearchPath(query: string): string {
  return `/search/?q=${encodeSearchQuery(query)}`;
}
