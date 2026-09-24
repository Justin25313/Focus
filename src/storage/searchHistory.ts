import { isValidUsername } from '../filtering/instagram/routes';

export const MAX_SEARCH_HISTORY = 12;

export function parseSearchHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item): item is string => typeof item === 'string')
    .filter(isValidUsername)
    .slice(0, MAX_SEARCH_HISTORY);
}

export function addToSearchHistory(
  history: string[],
  username: string,
): string[] {
  const lower = username.toLowerCase();
  return [
    username,
    ...history.filter(item => item.toLowerCase() !== lower),
  ].slice(0, MAX_SEARCH_HISTORY);
}
