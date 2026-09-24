/**
 * encodeURIComponent, but also for !'()*~ so the path stays within the
 * guard's safe-path alphabet.
 */
export function encodeSearchQuery(query: string): string {
  return encodeURIComponent(query.trim()).replace(
    /[!'()*~]/g,
    char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
