import {
  BLOCK_REASONS,
  BlockReason,
  GUARDED_HOSTS,
  routeKindForPath,
} from '../instagram/routes';
import { parseUrl } from './RouteGuard';

export type SearchUser = {
  username: string;
  fullName: string;
  verified: boolean;
};

/**
 * Every message the page script may send. Anything else is dropped.
 * The page can never ask the app to execute code.
 */
export type WebMessage =
  | { type: 'FILTER_READY'; version: string }
  | { type: 'FILTER_ERROR'; code: string }
  | { type: 'ROUTE_CHANGED'; path: string }
  | {
      type: 'BLOCKED_ROUTE';
      path: string;
      reason: BlockReason;
      /** true: the page is on the blocked route; false: navigation was stopped. */
      navigated: boolean;
    }
  | { type: 'OPEN_SEARCH' }
  /** A post was hidden by the feed filter. */
  | { type: 'CONTENT_HIDDEN'; kind: 'sponsored' | 'suggested' }
  /** The page finished rendering after a load or navigation. */
  | { type: 'PAGE_READY'; path: string }
  /** Profile link of the signed-in account, read from Instagram's own nav. */
  | { type: 'OWN_PROFILE'; path: string }
  | {
      type: 'SEARCH_RESULTS';
      requestId: number;
      ok: boolean;
      users: SearchUser[];
    }
  /** Scrolled down (compact tab bar) or up/to the top (full tab bar). */
  | { type: 'SCROLL_STATE'; compact: boolean }
  /** A deliberate horizontal swipe outside carousels and scrollers. */
  | { type: 'SWIPE'; direction: 'left' | 'right' }
  /** A finger is on something that scrolls sideways (carousel, stories). */
  | { type: 'H_SCROLL'; active: boolean }
  /** Reddit: the communities the signed-in user has joined. */
  | { type: 'SUBSCRIPTIONS'; names: string[] };

const KNOWN_REASONS: ReadonlySet<string> = new Set(BLOCK_REASONS);
const MAX_PATH = 512;
const MAX_USERS = 25;
const MAX_SUBSCRIPTIONS = 100;

function isPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_PATH &&
    value.startsWith('/')
  );
}

function shortString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function parseUsers(value: unknown): SearchUser[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const users: SearchUser[] = [];
  for (const item of value.slice(0, MAX_USERS)) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const username = shortString(record.username, 30);
    if (!username || !/^[a-z0-9._]+$/i.test(username)) {
      continue;
    }
    users.push({
      username,
      fullName: shortString(record.fullName, 120) ?? '',
      verified: record.verified === true,
    });
  }
  return users;
}

/**
 * Validates a raw bridge message. `sourceUrl` is the URL of the page that
 * sent it; messages from anywhere except Instagram are rejected.
 */
export function parseWebMessage(
  data: string,
  sourceUrl: string,
  allowedHosts: ReadonlySet<string> = GUARDED_HOSTS,
): WebMessage | null {
  const source = parseUrl(sourceUrl);
  if (!source || source.scheme !== 'https' || !allowedHosts.has(source.host)) {
    return null;
  }
  if (typeof data !== 'string' || data.length > 20000) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const msg = raw as Record<string, unknown>;

  switch (msg.type) {
    case 'FILTER_READY': {
      const version = shortString(msg.version, 32);
      return version ? { type: 'FILTER_READY', version } : null;
    }
    case 'FILTER_ERROR': {
      const code = shortString(msg.code, 40);
      return code && /^[A-Z_]+$/.test(code)
        ? { type: 'FILTER_ERROR', code }
        : null;
    }
    case 'ROUTE_CHANGED':
      return isPath(msg.path)
        ? { type: 'ROUTE_CHANGED', path: msg.path }
        : null;
    case 'BLOCKED_ROUTE':
      if (
        isPath(msg.path) &&
        typeof msg.reason === 'string' &&
        KNOWN_REASONS.has(msg.reason) &&
        typeof msg.navigated === 'boolean'
      ) {
        return {
          type: 'BLOCKED_ROUTE',
          path: msg.path,
          reason: msg.reason as BlockReason,
          navigated: msg.navigated,
        };
      }
      return null;
    case 'OPEN_SEARCH':
      return { type: 'OPEN_SEARCH' };
    case 'CONTENT_HIDDEN':
      return msg.kind === 'sponsored' || msg.kind === 'suggested'
        ? { type: 'CONTENT_HIDDEN', kind: msg.kind }
        : null;
    case 'PAGE_READY':
      return isPath(msg.path) ? { type: 'PAGE_READY', path: msg.path } : null;
    case 'OWN_PROFILE':
      return isPath(msg.path) && routeKindForPath(msg.path) === 'profile'
        ? { type: 'OWN_PROFILE', path: msg.path }
        : null;
    case 'SEARCH_RESULTS': {
      const users = parseUsers(msg.users);
      if (
        typeof msg.requestId !== 'number' ||
        !Number.isInteger(msg.requestId) ||
        typeof msg.ok !== 'boolean' ||
        users === null
      ) {
        return null;
      }
      return {
        type: 'SEARCH_RESULTS',
        requestId: msg.requestId,
        ok: msg.ok,
        users,
      };
    }
    case 'SCROLL_STATE':
      return typeof msg.compact === 'boolean'
        ? { type: 'SCROLL_STATE', compact: msg.compact }
        : null;
    case 'SUBSCRIPTIONS': {
      if (!Array.isArray(msg.names)) {
        return null;
      }
      const names = msg.names
        .filter(
          (name): name is string =>
            typeof name === 'string' && /^[A-Za-z0-9_]{2,21}$/.test(name),
        )
        .slice(0, MAX_SUBSCRIPTIONS);
      return { type: 'SUBSCRIPTIONS', names };
    }
    case 'H_SCROLL':
      return typeof msg.active === 'boolean'
        ? { type: 'H_SCROLL', active: msg.active }
        : null;
    case 'SWIPE':
      return msg.direction === 'left' || msg.direction === 'right'
        ? { type: 'SWIPE', direction: msg.direction }
        : null;
    default:
      return null;
  }
}
