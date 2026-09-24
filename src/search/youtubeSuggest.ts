/**
 * Search suggestions while typing, like YouTube's own search box.
 * The request goes to Google's suggest service without cookies (the
 * YouTube login lives in the WebView, not in the app's network stack),
 * and only while the search field has text.
 */
const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';
const MAX_SUGGESTIONS = 8;

export function youtubeSuggestUrl(query: string, language = 'de'): string {
  const params = [
    'client=firefox',
    'ds=yt',
    `hl=${encodeURIComponent(language)}`,
    'ie=utf-8',
    'oe=utf-8',
    `q=${encodeURIComponent(query.trim())}`,
  ];
  return `${SUGGEST_URL}?${params.join('&')}`;
}

/** Response: ["query", ["suggestion", …], …]. Anything else → []. */
export function parseYouTubeSuggestions(body: unknown): string[] {
  if (!Array.isArray(body) || !Array.isArray(body[1])) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of body[1]) {
    if (typeof item !== 'string') {
      continue;
    }
    const text = item.trim().slice(0, 120);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      out.push(text);
    }
    if (out.length === MAX_SUGGESTIONS) {
      break;
    }
  }
  return out;
}

export async function fetchYouTubeSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (!query.trim()) {
    return [];
  }
  try {
    const response = await fetch(youtubeSuggestUrl(query), {
      signal,
      credentials: 'omit',
    });
    if (!response.ok) {
      return [];
    }
    return parseYouTubeSuggestions(await response.json());
  } catch {
    return [];
  }
}

/**
 * Splits a suggestion into the part the user typed and the completion,
 * so the completion can be shown in bold (as YouTube does).
 */
export function splitSuggestion(
  suggestion: string,
  typed: string,
): { typed: string; rest: string } {
  const prefix = typed.trimStart();
  if (prefix && suggestion.toLowerCase().startsWith(prefix.toLowerCase())) {
    return {
      typed: suggestion.slice(0, prefix.length),
      rest: suggestion.slice(prefix.length),
    };
  }
  return { typed: '', rest: suggestion };
}
