import { RouteRule, ServiceRules } from '../engine/types';

/**
 * Snapchat for Web. The web app itself (web.snapchat.com) only has chats,
 * Snaps, calls and friends' Stories – Spotlight, Discover and the Snap
 * Map are not part of it. What can still pull you in are shared links to
 * public Spotlight/Discover content and the web map.
 */
export const SNAPCHAT_ORIGIN = 'https://web.snapchat.com';

export const SNAPCHAT_ROUTE_RULES: readonly RouteRule[] = [
  {
    id: 'snap-map',
    host: 'map.snapchat.com',
    pattern: '^/',
    effect: 'block',
    reason: 'snapMap',
  },
  {
    id: 'snap-spotlight',
    pattern: '^/(?:spotlight|discover)(?:/|$)',
    effect: 'block',
    reason: 'spotlight',
  },
];

const SNAPCHAT_HOSTS: ReadonlySet<string> = new Set([
  'web.snapchat.com',
  'www.snapchat.com',
  'snapchat.com',
  'map.snapchat.com',
]);

export const SNAPCHAT_SERVICE_RULES: ServiceRules = {
  rules: SNAPCHAT_ROUTE_RULES,
  guardedHosts: SNAPCHAT_HOSTS,
  isInAppHost: host =>
    SNAPCHAT_HOSTS.has(host) ||
    host.endsWith('.snapchat.com') ||
    host === 'snap.com' ||
    host.endsWith('.snap.com'),
};
