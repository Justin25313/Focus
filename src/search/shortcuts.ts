import {
  redditUserFromInput,
  subredditFromInput,
} from '../filtering/reddit/routes';
import { isXHandle } from '../filtering/x/routes';
import type { SearchShortcut } from '../screens/WebSearchScreen';

/** X: "@name" or "name" can be a profile. */
export function xShortcuts(text: string): SearchShortcut[] {
  const handle = text.trim().replace(/^@/, '');
  if (!isXHandle(handle)) {
    return [];
  }
  return [
    {
      key: `x-${handle}`,
      title: `@${handle}`,
      subtitle: 'Profil öffnen',
      path: `/${handle}`,
    },
  ];
}

/** Reddit: a community ("r/name" or "name") or a user ("u/name"). */
export function redditShortcuts(text: string): SearchShortcut[] {
  const user = redditUserFromInput(text);
  if (user) {
    return [
      {
        key: `u-${user}`,
        title: `u/${user}`,
        subtitle: 'Profil öffnen',
        path: `/user/${user}/`,
      },
    ];
  }
  const sub = subredditFromInput(text);
  return sub
    ? [
        {
          key: `r-${sub}`,
          title: `r/${sub}`,
          subtitle: 'Community öffnen',
          path: `/r/${sub}/`,
        },
      ]
    : [];
}

export const MAX_COMMUNITIES = 30;

/** Remembers a community, most recent first, case-insensitively unique. */
export function addCommunity(list: string[], name: string): string[] {
  return [
    name,
    ...list.filter(item => item.toLowerCase() !== name.toLowerCase()),
  ].slice(0, MAX_COMMUNITIES);
}

export function parseCommunities(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter(
      (item): item is string =>
        typeof item === 'string' && /^[A-Za-z0-9_]{2,21}$/.test(item),
    )
    .slice(0, MAX_COMMUNITIES);
}
