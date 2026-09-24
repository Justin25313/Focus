import { encodeSearchQuery } from '../../search/encode';
import { isSignInHost } from '../engine/signIn';
import { RouteRule, ServiceRules } from '../engine/types';

/**
 * X mobile web (x.com). Route assumptions (2026-09):
 *   /home                     Timeline (tabs "For you" / "Following") → allow,
 *                             the guard keeps "Following" selected
 *   /explore, /i/trends, …    Trends and the Explore feed             → block
 *   /search?q=…               Search results                          → allow
 *   /<user>, /<user>/status/<id>, /notifications, /messages          → allow
 */
export const X_ORIGIN = 'https://x.com';
export const X_HOME_PATH = '/home';
export const X_NOTIFICATIONS_PATH = '/notifications';
export const X_MESSAGES_PATH = '/messages';

export const X_ROUTE_RULES: readonly RouteRule[] = [
  {
    id: 'x-explore',
    pattern: '^/(?:explore|i/(?:trends|events|topics|moments))(?:/|$)',
    effect: 'block',
    reason: 'xExplore',
  },
];

const X_HOSTS: ReadonlySet<string> = new Set([
  'x.com',
  'mobile.x.com',
  'twitter.com',
  'mobile.twitter.com',
]);

export const X_SERVICE_RULES: ServiceRules = {
  rules: X_ROUTE_RULES,
  guardedHosts: X_HOSTS,
  isInAppHost: host =>
    X_HOSTS.has(host) ||
    host.endsWith('.x.com') ||
    host.endsWith('.twitter.com') ||
    isSignInHost(host),
};

/** A handle X would accept: 1–15 letters, digits or underscores. */
export function isXHandle(text: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(text);
}

export function xSearchPath(query: string): string {
  return `/search?q=${encodeSearchQuery(query)}&src=typed_query`;
}
