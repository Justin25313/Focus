import { parseUrl } from '../filtering/engine/RouteGuard';
import { GUARDED_HOSTS } from '../filtering/instagram/routes';
import { REDDIT_SERVICE_RULES } from '../filtering/reddit/routes';
import { X_SERVICE_RULES } from '../filtering/x/routes';
import { YOUTUBE_SERVICE_RULES } from '../filtering/youtube/routes';
import { ServiceId } from './services';

/**
 * A link to one of Focus's apps, e.g. an Instagram post shared on
 * Reddit. Handing it to iOS would open the real app (universal links) –
 * exactly what Focus is there to avoid – so it opens in Focus instead.
 */
export function focusAppForUrl(
  url: string,
): { app: ServiceId; path: string } | null {
  const parsed = parseUrl(url);
  if (!parsed || (parsed.scheme !== 'https' && parsed.scheme !== 'http')) {
    return null;
  }
  const { host } = parsed;
  const rest = pathAndQuery(url);
  if (GUARDED_HOSTS.has(host)) {
    return { app: 'instagram', path: rest };
  }
  if (host === 'youtu.be') {
    const id = /^\/([A-Za-z0-9_-]{6,20})/.exec(parsed.path)?.[1];
    return id ? { app: 'youtube', path: `/watch?v=${id}` } : null;
  }
  if (YOUTUBE_SERVICE_RULES.guardedHosts.has(host)) {
    return { app: 'youtube', path: rest };
  }
  if (X_SERVICE_RULES.guardedHosts.has(host)) {
    return { app: 'x', path: rest };
  }
  if (host === 'redd.it') {
    const id = /^\/([A-Za-z0-9]{4,12})$/.exec(parsed.path)?.[1];
    return id ? { app: 'reddit', path: `/comments/${id}/` } : null;
  }
  if (REDDIT_SERVICE_RULES.guardedHosts.has(host)) {
    return { app: 'reddit', path: rest };
  }
  return null;
}

/** "/p/abc/?x=1" from a full URL; only the characters Focus navigates to. */
function pathAndQuery(url: string): string {
  const match = /^[a-z]+:\/\/[^/?#]+([^#]*)/i.exec(url);
  const rest = match?.[1] || '/';
  const [path, query] = rest.split('?');
  const safePath = /^\/[A-Za-z0-9._\-/@+]*$/.test(path) ? path : '/';
  const safeQuery =
    query && /^[A-Za-z0-9_=&%.+-]*$/.test(query) ? `?${query}` : '';
  return safePath + safeQuery;
}
