import {
  DEFAULT_YOUTUBE_CONTROLS,
  youtubeHomePathFor,
  youtubePolicyFor,
} from '../src/controls/youtube';
import {
  blockReasonForPath,
  decideNavigation,
} from '../src/filtering/engine/RouteGuard';
import { parseWebMessage } from '../src/filtering/engine/messages';
import { YOUTUBE_SERVICE_RULES } from '../src/filtering/youtube/routes';
import {
  encodeSearchQuery,
  youtubeSearchPath,
} from '../src/screens/WebSearchScreen';

const yt = (path: string) => `https://m.youtube.com${path}`;
const defaults = youtubePolicyFor(DEFAULT_YOUTUBE_CONTROLS);

describe('YouTube rules', () => {
  it.each([
    ['/shorts/abc123', 'shorts'],
    ['/shorts', 'shorts'],
    ['/@creator/shorts', 'shorts'],
    ['/channel/UC123/shorts/', 'shorts'],
    ['/feed/trending', 'ytExplore'],
    ['/feed/explore', 'ytExplore'],
    ['/gaming', 'ytExplore'],
    ['/', 'ytHome'],
  ])('%s is blocked as %s', (path, reason) => {
    expect(blockReasonForPath(path, defaults, YOUTUBE_SERVICE_RULES)).toBe(
      reason,
    );
    expect(
      decideNavigation({ url: yt(path) }, defaults, YOUTUBE_SERVICE_RULES),
    ).toEqual({ action: 'block', reason, path });
  });

  it.each([
    '/watch',
    '/results',
    '/@creator',
    '/@creator/videos',
    '/feed/subscriptions',
    '/feed/you',
    '/feed/library',
    '/playlist',
  ])('%s is allowed by default', path => {
    expect(
      blockReasonForPath(path, defaults, YOUTUBE_SERVICE_RULES),
    ).toBeNull();
  });

  it('search-only mode also closes the subscriptions feed', () => {
    const policy = youtubePolicyFor({
      ...DEFAULT_YOUTUBE_CONTROLS,
      home: 'search',
    });
    expect(
      blockReasonForPath('/feed/subscriptions', policy, YOUTUBE_SERVICE_RULES),
    ).toBe('ytSubs');
    expect(blockReasonForPath('/watch', policy, YOUTUBE_SERVICE_RULES)).toBe(
      null,
    );
  });

  it('YouTube start and home paths follow the mode', () => {
    expect(youtubeHomePathFor(DEFAULT_YOUTUBE_CONTROLS)).toBe(
      '/feed/subscriptions',
    );
    const normal = { ...DEFAULT_YOUTUBE_CONTROLS, home: 'normal' as const };
    expect(youtubeHomePathFor(normal)).toBe('/');
    expect(
      blockReasonForPath('/', youtubePolicyFor(normal), YOUTUBE_SERVICE_RULES),
    ).toBeNull();
    expect(
      blockReasonForPath(
        '/shorts/x',
        youtubePolicyFor(normal),
        YOUTUBE_SERVICE_RULES,
      ),
    ).toBe('shorts');
  });

  it('keeps Google sign-in in the app and sends other sites to Safari', () => {
    expect(
      decideNavigation(
        { url: 'https://accounts.google.com/signin' },
        defaults,
        YOUTUBE_SERVICE_RULES,
      ).action,
    ).toBe('allow');
    // Sign-in sets cookies on country domains; leaving the app there
    // broke the login and opened the YouTube app.
    for (const url of [
      'https://accounts.google.de/accounts/SetSID',
      'https://accounts.google.co.uk/accounts/SetSID',
      'https://www.google.com.br/',
      'https://accounts.youtube.com/accounts/SetSID',
    ]) {
      expect(
        decideNavigation({ url }, defaults, YOUTUBE_SERVICE_RULES).action,
      ).toBe('allow');
    }
    expect(
      decideNavigation(
        { url: 'https://evilgoogle.de/' },
        defaults,
        YOUTUBE_SERVICE_RULES,
      ).action,
    ).toBe('openExternally');
    expect(
      decideNavigation(
        { url: 'https://www.instagram.com/' },
        defaults,
        YOUTUBE_SERVICE_RULES,
      ).action,
    ).toBe('openExternally');
  });

  it('accepts bridge messages only from YouTube in the YouTube view', () => {
    const data = JSON.stringify({ type: 'ROUTE_CHANGED', path: '/watch' });
    expect(
      parseWebMessage(data, yt('/watch'), YOUTUBE_SERVICE_RULES.guardedHosts),
    ).not.toBeNull();
    expect(
      parseWebMessage(
        data,
        'https://www.instagram.com/',
        YOUTUBE_SERVICE_RULES.guardedHosts,
      ),
    ).toBeNull();
  });
});

describe('host-bound rules', () => {
  const service = {
    rules: [
      {
        id: 'map',
        pattern: '^/',
        host: 'map.example.com',
        effect: 'block' as const,
        reason: 'explore' as const,
      },
    ],
    guardedHosts: new Set(['example.com', 'map.example.com']),
    isInAppHost: () => false,
  };

  it('only apply on their host', () => {
    expect(
      decideNavigation(
        { url: 'https://map.example.com/x' },
        { explore: true },
        service,
      ),
    ).toMatchObject({ action: 'block', reason: 'explore' });
    expect(
      decideNavigation(
        { url: 'https://example.com/x' },
        { explore: true },
        service,
      ).action,
    ).toBe('allow');
  });
});

describe('YouTube search path', () => {
  it('encodes everything outside a plain path', () => {
    expect(encodeSearchQuery("don't stop (live)")).toBe(
      'don%27t%20stop%20%28live%29',
    );
    expect(youtubeSearchPath(' lo-fi ')).toBe('/results?search_query=lo-fi');
  });
});
