import {
  DEFAULT_POLICY,
  INSTAGRAM_SERVICE_RULES,
  RouteKind,
  SYSTEM_SCHEMES,
  isPersistableKind,
  routeKindForPath,
} from '../instagram/routes';
import { BlockReason, RoutePolicy, RouteRule, ServiceRules } from './types';

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

const compiledCache = new WeakMap<readonly RouteRule[], CompiledRule[]>();

function compiled(rules: readonly RouteRule[]): CompiledRule[] {
  let result = compiledCache.get(rules);
  if (!result) {
    result = rules.map(rule => ({
      rule,
      regex: new RegExp(rule.pattern, 'i'),
    }));
    compiledCache.set(rules, result);
  }
  return result;
}

/**
 * Returns the active block reason for a path, or null. Defaults to
 * Instagram; pass the app's rules (and the host, for host-bound rules).
 */
export function blockReasonForPath(
  path: string,
  policy: RoutePolicy = DEFAULT_POLICY,
  service: ServiceRules = INSTAGRAM_SERVICE_RULES,
  host?: string,
): BlockReason | null {
  for (const { rule, regex } of compiled(service.rules)) {
    if (rule.host && rule.host !== host) {
      continue;
    }
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
  service: ServiceRules = INSTAGRAM_SERVICE_RULES,
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
    if (service.guardedHosts.has(host)) {
      const reason = blockReasonForPath(path, policy, service, host);
      if (reason && isTopFrame) {
        return { action: 'block', reason, path };
      }
      if (!isTopFrame) {
        return { action: 'allow', kind: 'frame' };
      }
      return {
        action: 'allow',
        kind:
          service === INSTAGRAM_SERVICE_RULES
            ? routeKindForPath(path)
            : 'other',
      };
    }
    if (!isTopFrame) {
      return { action: 'allow', kind: 'frame' };
    }
    if (service.isInAppHost(host)) {
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
  return servicePathFromUrl(url, INSTAGRAM_SERVICE_RULES);
}

/** Path of a URL on one of the app's guarded hosts, else null. */
export function servicePathFromUrl(
  url: string,
  service: ServiceRules,
): string | null {
  const parsed = parseUrl(url);
  if (!parsed || !service.guardedHosts.has(parsed.host)) {
    return null;
  }
  if (parsed.scheme !== 'https' && parsed.scheme !== 'http') {
    return null;
  }
  return parsed.path;
}
