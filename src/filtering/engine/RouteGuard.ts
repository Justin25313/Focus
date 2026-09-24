import {
  BlockReason,
  GUARDED_HOSTS,
  INSTAGRAM_ROUTE_RULES,
  RouteKind,
  RoutePolicy,
  RouteRule,
  DEFAULT_POLICY,
  SYSTEM_SCHEMES,
  isInAppHost,
  isPersistableKind,
  routeKindForPath,
} from '../instagram/routes';

export type NavigationDecision =
  | { action: 'allow'; kind: RouteKind | 'external-in-app' | 'frame' }
  | { action: 'block'; reason: BlockReason; path: string }
  | { action: 'openExternally'; url: string }
  | { action: 'ignore'; why: 'unknownScheme' | 'invalidUrl' };

export type ParsedUrl = {
  scheme: string;
  host: string;
  path: string;
};

const URL_PATTERN = /^([a-z][a-z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)/i;

/**
 * Minimal URL parser. React Native's URL polyfill does not implement
 * hostname/pathname, so we parse the parts we need ourselves.
 */
export function parseUrl(url: string): ParsedUrl | null {
  const match = URL_PATTERN.exec(url.trim());
  if (!match) {
    return null;
  }
  const scheme = match[1].toLowerCase();
  const authority = match[2] ?? '';
  const host = authority.replace(/^.*@/, '').replace(/:\d*$/, '').toLowerCase();
  let path = match[3] || '/';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return { scheme, host, path };
}

type CompiledRule = { rule: RouteRule; regex: RegExp };

const COMPILED_RULES: readonly CompiledRule[] = INSTAGRAM_ROUTE_RULES.map(
  rule => ({ rule, regex: new RegExp(rule.pattern, 'i') }),
);

/** Returns the active block reason for an Instagram path, or null. */
export function blockReasonForPath(
  path: string,
  policy: RoutePolicy = DEFAULT_POLICY,
): BlockReason | null {
  for (const { rule, regex } of COMPILED_RULES) {
    if (regex.test(path)) {
      if (rule.effect === 'allow') {
        return null;
      }
      return policy[rule.reason] ? rule.reason : null;
    }
  }
  return null;
}

export type NavigationRequest = {
  url: string;
  isTopFrame?: boolean;
};

/**
 * Central decision for every WebView navigation request.
 */
export function decideNavigation(
  request: NavigationRequest,
  policy: RoutePolicy = DEFAULT_POLICY,
): NavigationDecision {
  const parsed = parseUrl(request.url);
  if (!parsed) {
    return { action: 'ignore', why: 'invalidUrl' };
  }
  const { scheme, host, path } = parsed;
  const isTopFrame = request.isTopFrame !== false;

  if (scheme === 'about' || scheme === 'blob') {
    return { action: 'allow', kind: 'frame' };
  }

  if (scheme === 'http' || scheme === 'https') {
    if (GUARDED_HOSTS.has(host)) {
      const reason = blockReasonForPath(path, policy);
      if (reason && isTopFrame) {
        return { action: 'block', reason, path };
      }
      return isTopFrame
        ? { action: 'allow', kind: routeKindForPath(path) }
        : { action: 'allow', kind: 'frame' };
    }
    if (!isTopFrame) {
      return { action: 'allow', kind: 'frame' };
    }
    if (isInAppHost(host)) {
      return { action: 'allow', kind: 'external-in-app' };
    }
    return { action: 'openExternally', url: request.url };
  }

  if (!isTopFrame) {
    return { action: 'ignore', why: 'unknownScheme' };
  }
  if (SYSTEM_SCHEMES.has(scheme)) {
    return { action: 'openExternally', url: request.url };
  }
  return { action: 'ignore', why: 'unknownScheme' };
}

/**
 * Whether a path may be remembered as the "last safe location".
 */
export function isSafeRouteToPersist(
  path: string,
  policy: RoutePolicy = DEFAULT_POLICY,
): boolean {
  if (!path.startsWith('/') || path.length > 256) {
    return false;
  }
  if (blockReasonForPath(path, policy)) {
    return false;
  }
  return isPersistableKind(routeKindForPath(path));
}

/** Instagram path for an arbitrary URL on a guarded host, else null. */
export function instagramPathFromUrl(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed || !GUARDED_HOSTS.has(parsed.host)) {
    return null;
  }
  if (parsed.scheme !== 'https' && parsed.scheme !== 'http') {
    return null;
  }
  return parsed.path;
}
