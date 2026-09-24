/**
 * Runs the real injected guard script inside jsdom, the way WKWebView
 * runs it at document start.
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.instagram.com/?variant=following"}
 */
/// <reference lib="dom" />
import { PRESETS } from '../src/controls/controls';
import {
  buildGuardConfig,
  buildGuardScript,
  configureScript,
  navigateScript,
  searchScript,
} from '../src/filtering/instagram/scripts';

type Posted = Record<string, unknown>;

const posted: Posted[] = [];
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 30));
const lastMessage = () => posted[posted.length - 1];
const messagesOfType = (type: string) => posted.filter(m => m.type === type);
const lastOfType = (type: string) => messagesOfType(type).pop();
// Settle timers from earlier steps may post PAGE_READY at any time.
const withoutReady = () => posted.filter(m => m.type !== 'PAGE_READY');

function install() {
  // eslint-disable-next-line no-eval
  (0, eval)(buildGuardScript());
}

function click(href: string): MouseEvent {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  const inner = document.createElement('span');
  anchor.appendChild(inner);
  document.body.appendChild(anchor);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  inner.dispatchEvent(event);
  anchor.remove();
  return event;
}

beforeAll(() => {
  (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
  // jsdom cannot navigate; stop real link navigation after our guard ran.
  document.addEventListener('click', event => event.preventDefault());
  install();
});

beforeEach(() => {
  posted.length = 0;
});

describe('injected guard script', () => {
  it('announces itself and hides Reels entry points', () => {
    // Installed in beforeAll; re-check the side effects.
    const style = document.getElementById('focus-guard-style');
    expect(style?.textContent).toContain('a[href="/reels/"]');
    expect(style?.textContent).toContain('html[data-focus-blocked] body');
    expect(
      (window as unknown as { __focusGuard: unknown }).__focusGuard,
    ).toBeDefined();
  });

  it('reports allowed SPA navigations', () => {
    history.pushState({}, '', '/natgeo/');
    expect(lastMessage()).toEqual({ type: 'ROUTE_CHANGED', path: '/natgeo/' });
  });

  it('blocks a Reels route reached through pushState and pauses media', () => {
    const video = document.createElement('video');
    const pause = jest.fn();
    Object.defineProperty(video, 'paused', { get: () => false });
    video.pause = pause;
    document.body.appendChild(video);

    history.pushState({}, '', '/reels/C1a2b3/');

    expect(lastMessage()).toEqual({
      type: 'BLOCKED_ROUTE',
      path: '/reels/C1a2b3/',
      reason: 'reels',
      navigated: true,
    });
    expect(document.documentElement.hasAttribute('data-focus-blocked')).toBe(
      true,
    );
    expect(pause).toHaveBeenCalled();
    video.remove();
  });

  it('does not report the same blocked route twice', () => {
    history.replaceState({}, '', '/reels/C1a2b3/');
    expect(messagesOfType('BLOCKED_ROUTE')).toHaveLength(0);
  });

  it('leaves the blocked route by going back', async () => {
    (window as any).__focusGuard.leaveBlocked();
    await flush();
    expect(location.pathname).toBe('/natgeo/');
    expect(lastOfType('ROUTE_CHANGED')).toEqual({
      type: 'ROUTE_CHANGED',
      path: '/natgeo/',
    });
    expect(document.documentElement.hasAttribute('data-focus-blocked')).toBe(
      false,
    );
  });

  it('stops clicks on blocked links before Instagram sees them', () => {
    const seenByPage = jest.fn();
    document.body.addEventListener('click', seenByPage);

    const event = click('/reels/');
    expect(event.defaultPrevented).toBe(true);
    expect(seenByPage).not.toHaveBeenCalled();
    expect(lastMessage()).toEqual({
      type: 'BLOCKED_ROUTE',
      path: '/reels/',
      reason: 'reels',
      navigated: false,
    });
    expect(location.pathname).toBe('/natgeo/');

    click('https://www.instagram.com/reel/XYZ/');
    expect(lastMessage()).toMatchObject({ reason: 'sharedReel' });

    document.body.removeEventListener('click', seenByPage);
  });

  it('turns the Explore tab into the Focus search', () => {
    const event = click('/explore/');
    expect(event.defaultPrevented).toBe(true);
    expect(lastMessage()).toEqual({ type: 'OPEN_SEARCH' });
  });

  it('lets normal links through', () => {
    const seenByPage = jest.fn();
    document.body.addEventListener('click', seenByPage);
    click('/p/C1a2b3/');
    click('https://example.com/');
    expect(seenByPage).toHaveBeenCalledTimes(2);
    expect(withoutReady()).toHaveLength(0);
    document.body.removeEventListener('click', seenByPage);
  });

  it('restores its style element if the page removes it', () => {
    document.getElementById('focus-guard-style')?.remove();
    history.pushState({}, '', '/direct/inbox/');
    expect(document.getElementById('focus-guard-style')).not.toBeNull();
  });

  it('navigates by clicking an existing Instagram link (SPA, no reload)', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/natgeo/');
    const onClick = jest.fn();
    anchor.addEventListener('click', onClick);
    document.body.appendChild(anchor);

    // eslint-disable-next-line no-eval
    (0, eval)(navigateScript('/natgeo/')!);
    expect(onClick).toHaveBeenCalledTimes(1);
    anchor.remove();
  });

  it('refuses to navigate to blocked or unsafe paths', () => {
    expect(navigateScript('/x"];alert(1)//')).toBeNull();
    const before = location.pathname;
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '/reels/');
    const onClick = jest.fn();
    anchor.addEventListener('click', onClick);
    document.body.appendChild(anchor);

    (window as any).__focusGuard.navigate('/reels/');
    (window as any).__focusGuard.navigate('https://evil.example/');

    expect(onClick).not.toHaveBeenCalled();
    expect(location.pathname).toBe(before);
    anchor.remove();
  });

  it("hides Instagram's bottom bar and reports the own profile", () => {
    const fixedBox = (top: number, height: number) => {
      const el = document.createElement('div');
      el.style.position = 'fixed';
      el.getBoundingClientRect = () =>
        ({ top, height, bottom: top + height } as DOMRect);
      return el;
    };
    const link = (href: string, withImage = false) => {
      const a = document.createElement('a');
      a.setAttribute('href', href);
      if (withImage) {
        a.appendChild(document.createElement('img'));
      }
      return a;
    };

    const header = fixedBox(0, 44);
    header.appendChild(link('/direct/inbox/'));
    const bar = fixedBox(window.innerHeight - 50, 50);
    const row = document.createElement('div');
    row.append(
      link('/'),
      link('/explore/'),
      link('/direct/inbox/'),
      link('/me.myself/', true),
    );
    bar.appendChild(row);
    document.body.append(header, bar);

    history.pushState({}, '', '/p/abc/');

    expect(bar.hasAttribute('data-focus-ig-nav')).toBe(true);
    expect(header.hasAttribute('data-focus-ig-nav')).toBe(false);
    expect(messagesOfType('OWN_PROFILE')).toEqual([
      { type: 'OWN_PROFILE', path: '/me.myself/' },
    ]);
    expect(document.getElementById('focus-guard-style')?.textContent).toContain(
      '[data-focus-ig-nav]{display:none!important;}',
    );

    history.pushState({}, '', '/p/def/');
    expect(messagesOfType('OWN_PROFILE')).toHaveLength(1);

    header.remove();
    bar.remove();
  });

  it('reports PAGE_READY once a new page has content and the DOM is quiet', async () => {
    history.pushState({}, '', '/direct/inbox/');
    const main = document.createElement('main');
    document.body.appendChild(main);
    await new Promise<void>(resolve => setTimeout(resolve, 400));
    expect(lastOfType('PAGE_READY')).toEqual({
      type: 'PAGE_READY',
      path: '/direct/inbox/',
    });
    main.remove();
  });

  it('hides a late-rendered Instagram bar without waiting for the poll', async () => {
    const bar = document.createElement('div');
    bar.style.position = 'fixed';
    bar.getBoundingClientRect = () =>
      ({ top: window.innerHeight - 50, height: 50 } as DOMRect);
    const home = document.createElement('a');
    home.setAttribute('href', '/');
    bar.appendChild(home);
    document.body.appendChild(bar);
    await new Promise<void>(resolve => setTimeout(resolve, 60));
    expect(bar.hasAttribute('data-focus-ig-nav')).toBe(true);
    bar.remove();
  });

  describe('modes', () => {
    const configure = (...args: Parameters<typeof buildGuardConfig>) =>
      // eslint-disable-next-line no-eval
      (0, eval)(configureScript(buildGuardConfig(...args)));
    let clock = Date.now();
    beforeEach(() => {
      // Redirects are throttled; give every test a fresh 10 s window.
      clock += 10000;
      jest.spyOn(Date, 'now').mockReturnValue(clock);
    });
    afterEach(() => {
      jest.restoreAllMocks();
      configure();
    });

    it('sends home to the Following feed', () => {
      const replace = jest.fn();
      (window as any).__focusReplaceForTests = replace;
      history.pushState({}, '', '/');
      expect(replace).toHaveBeenCalledWith('/?variant=following');
      history.pushState({}, '', '/natgeo/');
      delete (window as any).__focusReplaceForTests;
    });

    it('leaves an explicitly chosen feed variant alone', () => {
      const replace = jest.fn();
      (window as any).__focusReplaceForTests = replace;
      history.pushState({}, '', '/?variant=home');
      expect(replace).not.toHaveBeenCalled();
      history.pushState({}, '', '/natgeo/');
      delete (window as any).__focusReplaceForTests;
    });

    it('Messages only: home goes straight to the inbox', () => {
      configure(PRESETS.messages);
      const inbox = document.createElement('a');
      inbox.setAttribute('href', '/direct/inbox/');
      const onClick = jest.fn();
      inbox.addEventListener('click', onClick);
      document.body.appendChild(inbox);

      history.pushState({}, '', '/');
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(messagesOfType('BLOCKED_ROUTE')).toHaveLength(0);

      inbox.remove();
      history.pushState({}, '', '/natgeo/');
    });

    it('Messages only: Stories show the block screen', () => {
      configure(PRESETS.messages);
      history.pushState({}, '', '/stories/natgeo/123/');
      expect(lastOfType('BLOCKED_ROUTE')).toMatchObject({
        reason: 'stories',
        navigated: true,
      });
      history.pushState({}, '', '/natgeo/');
    });

    it('Stories + Messages hides feed posts on the home page only', () => {
      configure(PRESETS.storiesMessages);
      const css = document.getElementById('focus-guard-style')?.textContent;
      expect(css).toContain(
        'html[data-focus-route="home"] main article{display:none!important;}',
      );
      history.pushState({}, '', '/');
      expect(document.documentElement.getAttribute('data-focus-route')).toBe(
        'home',
      );
      history.pushState({}, '', '/natgeo/');
      expect(document.documentElement.hasAttribute('data-focus-route')).toBe(
        false,
      );
    });

    it('grayscale is a root filter that can be switched off again', () => {
      configure(PRESETS.balanced, true);
      const style = () =>
        document.getElementById('focus-guard-style')?.textContent ?? '';
      expect(style()).toContain('html{filter:grayscale(1)!important;}');
      configure(PRESETS.balanced, false);
      expect(style()).not.toContain('grayscale');
    });
  });

  describe('feed filter', () => {
    const article = (...texts: string[]) => {
      const el = document.createElement('article');
      const header = document.createElement('header');
      for (const text of texts) {
        const span = document.createElement('span');
        span.textContent = text;
        header.appendChild(span);
      }
      el.appendChild(header);
      return el;
    };

    it('hides only posts with an exact sponsored or suggested label', async () => {
      const main = document.createElement('main');
      const ad = article('brand', 'Gesponsert');
      const suggested = article('stranger', 'Suggested for you');
      const friend = article('friend', 'Wir wurden gesponsert von Oma');
      const friend2 = article('anzeigenhauptmeister', 'Berlin');
      main.append(ad, suggested, friend, friend2);
      document.body.appendChild(main);
      await new Promise<void>(resolve => setTimeout(resolve, 60));

      expect(ad.getAttribute('data-focus-hidden')).toBe('sponsored');
      expect(suggested.getAttribute('data-focus-hidden')).toBe('suggested');
      expect(friend.hasAttribute('data-focus-hidden')).toBe(false);
      expect(friend2.hasAttribute('data-focus-hidden')).toBe(false);
      expect(messagesOfType('CONTENT_HIDDEN')).toEqual([
        { type: 'CONTENT_HIDDEN', kind: 'sponsored' },
        { type: 'CONTENT_HIDDEN', kind: 'suggested' },
      ]);

      // Switching the filter off shows the posts again, without a reload.
      // eslint-disable-next-line no-eval
      (0, eval)(
        configureScript(
          buildGuardConfig({
            ...PRESETS.balanced,
            hideSponsored: false,
            hideSuggested: false,
          }),
        ),
      );
      expect(ad.hasAttribute('data-focus-hidden')).toBe(false);
      expect(suggested.hasAttribute('data-focus-hidden')).toBe(false);

      // eslint-disable-next-line no-eval
      (0, eval)(configureScript(buildGuardConfig()));
      main.remove();
    });
  });

  it('can be injected twice without side effects', () => {
    install();
    expect(document.querySelectorAll('#focus-guard-style')).toHaveLength(1);
  });

  it('runs account searches through Instagram and reports sanitised results', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [
          {
            user: {
              username: 'natgeo',
              full_name: 'National Geographic',
              is_verified: true,
              email: 'should-not-leak',
            },
          },
        ],
      }),
    });
    (window as any).fetch = fetchMock;

    // eslint-disable-next-line no-eval
    (0, eval)(searchScript('nat geo', 7));
    await flush();

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/web/search/topsearch/?context=user&query=nat%20geo',
    );
    expect(lastOfType('SEARCH_RESULTS')).toEqual({
      type: 'SEARCH_RESULTS',
      requestId: 7,
      ok: true,
      users: [
        { username: 'natgeo', fullName: 'National Geographic', verified: true },
      ],
    });
  });

  it('falls back and reports failure when search is unavailable', async () => {
    (window as any).fetch = jest.fn().mockResolvedValue({ ok: false });
    // eslint-disable-next-line no-eval
    (0, eval)(searchScript('x', 8));
    await flush();
    expect((window as any).fetch).toHaveBeenCalledTimes(2);
    expect(lastOfType('SEARCH_RESULTS')).toEqual({
      type: 'SEARCH_RESULTS',
      requestId: 8,
      ok: false,
      users: [],
    });
  });
});
