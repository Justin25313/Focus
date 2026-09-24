import { blockReasonForPath, instagramPathFromUrl } from '../engine/RouteGuard';
import { BlockReason, isValidUsername, routeKindForPath } from './routes';

export type SearchInput =
  | { kind: 'empty' }
  | { kind: 'username'; username: string }
  | { kind: 'path'; path: string }
  | { kind: 'blocked'; reason: BlockReason }
  | { kind: 'query'; text: string };

/**
 * Interprets what the user typed into the Focus search field:
 * an exact username, a pasted Instagram link, or free text.
 */
export function parseSearchInput(input: string): SearchInput {
  const text = input.trim();
  if (!text) {
    return { kind: 'empty' };
  }

  const looksLikeLink = /(^|\/\/|\.)instagram\.com\//i.test(text);
  if (looksLikeLink) {
    const url = /^[a-z]+:\/\//i.test(text) ? text : `https://${text}`;
    const path = instagramPathFromUrl(url);
    if (path) {
      const reason = blockReasonForPath(path);
      if (reason) {
        return { kind: 'blocked', reason };
      }
      const kind = routeKindForPath(path);
      if (kind === 'profile' || kind === 'post' || kind === 'stories') {
        return { kind: 'path', path };
      }
    }
  }

  const handle = text.replace(/^@/, '');
  if (isValidUsername(handle)) {
    return { kind: 'username', username: handle };
  }
  return { kind: 'query', text };
}

export function profilePath(username: string): string {
  return `/${username}/`;
}
