/**
 * Shared vocabulary of the route guard, for every supported app.
 */
export const BLOCK_REASONS = [
  // Instagram
  'reels',
  'sharedReel',
  'explore',
  'feed',
  'stories',
  'saved',
  // YouTube
  'shorts',
  'ytHome',
  'ytSubs',
  'ytExplore',
] as const;

export type BlockReason = (typeof BLOCK_REASONS)[number];

/**
 * Ordered route rules: the first match wins. `pattern` is matched
 * case-insensitively against the pathname; `host`, if set, must match too.
 */
export type RouteRule =
  | { id: string; pattern: string; host?: string; effect: 'allow' }
  | {
      id: string;
      pattern: string;
      host?: string;
      effect: 'block';
      reason: BlockReason;
    };

/** Which block reasons are active. Missing reasons are not blocked. */
export type RoutePolicy = Partial<Record<BlockReason, boolean>>;

/** Everything the native guard needs to know about one app. */
export type ServiceRules = {
  rules: readonly RouteRule[];
  /** Hosts whose paths are checked against the rules. */
  guardedHosts: ReadonlySet<string>;
  /** Other hosts allowed inside the WebView (login, CDN, redirects). */
  isInAppHost: (host: string) => boolean;
};
