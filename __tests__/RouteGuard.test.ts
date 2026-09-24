import {
  blockReasonForPath,
  decideNavigation,
  instagramPathFromUrl,
  isSafeRouteToPersist,
  parseUrl,
} from '../src/filtering/engine/RouteGuard';
import {
  DEFAULT_POLICY,
  routeKindForPath,
} from '../src/filtering/instagram/routes';

const ig = (path: string) => `https://www.instagram.com${path}`;

describe('parseUrl', () => {
  it('splits scheme, host and path', () => {
    expect(parseUrl('https://www.instagram.com/p/abc/?x=1#y')).toEqual({
      scheme: 'https',
      host: 'www.instagram.com',
      path: '/p/abc/',
    });
  });

  it('normalises case, ports and credentials', () => {
    expect(parseUrl('HTTPS://user@WWW.Instagram.com:443')).toEqual({
      scheme: 'https',
      host: 'www.instagram.com',
      path: '/',
    });
  });

  it('handles non-hierarchical schemes', () => {
    expect(parseUrl('mailto:someone@example.com')?.scheme).toBe('mailto');
    expect(parseUrl('about:blank')?.scheme).toBe('about');
  });

  it('rejects garbage', () => {
    expect(parseUrl('not a url')).toBeNull();
    expect(parseUrl('')).toBeNull();
  });
});

describe('blocked Instagram routes', () => {
  it.each([
    ['/reels/', 'reels'],
    ['/reels', 'reels'],
    ['/reels/C1a2b3/', 'reels'],
    ['/Reels/', 'reels'],
    ['/reel/C1a2b3/', 'sharedReel'],
    ['/reel/C1a2b3/?igsh=abc', 'sharedReel'],
    ['/someone/reels/', 'reels'],
    ['/explore/', 'explore'],
    ['/explore', 'explore'],
    ['/explore/tags/cats/', 'explore'],
    ['/explore/locations/123/berlin/', 'explore'],
    ['/explore/search/keyword/', 'explore'],
  ])('%s is blocked as %s', (path, reason) => {
    const cleanPath = path.split('?')[0];
    expect(blockReasonForPath(cleanPath)).toBe(reason);
    expect(decideNavigation({ url: ig(path) })).toEqual({
      action: 'block',
      reason,
      path: cleanPath,
    });
  });

  it('blocks on every guarded host', () => {
    for (const host of ['instagram.com', 'm.instagram.com']) {
      expect(decideNavigation({ url: `https://${host}/reels/` }).action).toBe(
        'block',
      );
    }
  });

  it('respects a relaxed policy', () => {
    const policy = {
      ...DEFAULT_POLICY,
      reels: false,
      sharedReel: false,
    };
    expect(blockReasonForPath('/reels/', policy)).toBeNull();
    expect(blockReasonForPath('/explore/', policy)).toBe('explore');
  });
});

describe('allowed Instagram routes', () => {
  it.each([
    ['/', 'home'],
    ['/direct/inbox/', 'direct'],
    ['/direct/t/1234567890/', 'direct'],
    ['/natgeo/', 'profile'],
    ['/natgeo', 'profile'],
    ['/some.user_1/', 'profile'],
    ['/natgeo/tagged/', 'profile'],
    ['/natgeo/saved/', 'profile'],
    ['/p/C1a2b3/', 'post'],
    ['/tv/C1a2b3/', 'post'],
    ['/stories/natgeo/3141592653/', 'stories'],
    ['/explore/search/', 'search'],
    ['/accounts/login/', 'auth'],
    ['/accounts/onetap/', 'auth'],
    ['/challenge/action/', 'auth'],
    ['/natgeo/p/C1a2b3/', 'other'],
    ['/p/', 'other'],
  ])('%s is allowed as %s', (path, kind) => {
    expect(blockReasonForPath(path)).toBeNull();
    expect(routeKindForPath(path)).toBe(kind);
    expect(decideNavigation({ url: ig(path) })).toEqual({
      action: 'allow',
      kind,
    });
  });

  it('does not mistake usernames containing "reel" or "explore" for blocked routes', () => {
    expect(blockReasonForPath('/reelsfan/')).toBeNull();
    expect(blockReasonForPath('/explorer/')).toBeNull();
    expect(blockReasonForPath('/reel.lover/')).toBeNull();
  });
});

describe('navigation outside Instagram', () => {
  it('keeps login-related hosts in the WebView', () => {
    expect(
      decideNavigation({ url: 'https://accountscenter.instagram.com/' }),
    ).toEqual({ action: 'allow', kind: 'external-in-app' });
    expect(
      decideNavigation({ url: 'https://m.facebook.com/login.php' }),
    ).toEqual({ action: 'allow', kind: 'external-in-app' });
    expect(decideNavigation({ url: 'https://l.instagram.com/?u=x' })).toEqual({
      action: 'allow',
      kind: 'external-in-app',
    });
  });

  it('opens ordinary links in Safari', () => {
    expect(decideNavigation({ url: 'https://example.com/article' })).toEqual({
      action: 'openExternally',
      url: 'https://example.com/article',
    });
  });

  it('does not treat look-alike hosts as Instagram', () => {
    expect(
      decideNavigation({ url: 'https://instagram.com.evil.example/reels/' })
        .action,
    ).toBe('openExternally');
    expect(decideNavigation({ url: 'https://notinstagram.com/' }).action).toBe(
      'openExternally',
    );
  });

  it('hands system schemes to iOS', () => {
    expect(
      decideNavigation({ url: 'itms-apps://apps.apple.com/x' }).action,
    ).toBe('openExternally');
    expect(decideNavigation({ url: 'mailto:a@b.c' }).action).toBe(
      'openExternally',
    );
  });

  it('blocks unknown custom schemes, including the native Instagram app', () => {
    expect(decideNavigation({ url: 'instagram://reels_home' })).toEqual({
      action: 'ignore',
      why: 'unknownScheme',
    });
    expect(decideNavigation({ url: 'fb://profile' }).action).toBe('ignore');
  });

  it('lets sub-frames load without opening Safari', () => {
    expect(
      decideNavigation({ url: 'https://ads.example/frame', isTopFrame: false }),
    ).toEqual({ action: 'allow', kind: 'frame' });
    expect(
      decideNavigation({ url: 'intent://x', isTopFrame: false }).action,
    ).toBe('ignore');
  });

  it('allows about:blank and blob URLs', () => {
    expect(decideNavigation({ url: 'about:blank' }).action).toBe('allow');
    expect(
      decideNavigation({ url: 'blob:https://www.instagram.com/123' }).action,
    ).toBe('allow');
  });
});

describe('last safe location', () => {
  it.each([
    ['/', true],
    ['/direct/inbox/', true],
    ['/direct/t/123/', true],
    ['/natgeo/', true],
    ['/p/C1a2b3/', true],
    ['/reels/', false],
    ['/reel/C1/', false],
    ['/explore/', false],
    ['/explore/search/', false],
    ['/stories/natgeo/1/', false],
    ['/accounts/login/', false],
    ['/challenge/x/', false],
    ['/oauth/authorize/', false],
    ['/natgeo/p/C1/', false],
    ['natgeo/', false],
    [`/${'a'.repeat(300)}/`, false],
  ])('%s persistable: %s', (path, expected) => {
    expect(isSafeRouteToPersist(path)).toBe(expected);
  });
});

describe('instagramPathFromUrl', () => {
  it('extracts paths from Instagram URLs only', () => {
    expect(instagramPathFromUrl(ig('/direct/inbox/?x=1'))).toBe(
      '/direct/inbox/',
    );
    expect(instagramPathFromUrl('https://facebook.com/x')).toBeNull();
    expect(instagramPathFromUrl('about:blank')).toBeNull();
  });
});
