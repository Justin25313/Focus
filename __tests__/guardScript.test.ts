/**
 * Runs the real injected guard script inside jsdom, the way WKWebView
 * runs it at document start.
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.instagram.com/"}
 */
/// <reference lib="dom" />
import {
  buildGuardScript,
  navigateScript,
  searchScript,
} from '../src/filtering/instagram/scripts';

type Posted = Record<string, unknown>;

const posted: Posted[] = [];
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 30));
const lastMessage = () => posted[posted.length - 1];
const messagesOfType = (type: string) => posted.filter(m => m.type === type);

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
    expect(lastMessage()).toEqual({ type: 'ROUTE_CHANGED', path: '/natgeo/' });
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
    expect(posted).toHaveLength(0);
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
    expect(lastMessage()).toEqual({
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
    expect(lastMessage()).toEqual({
      type: 'SEARCH_RESULTS',
      requestId: 8,
      ok: false,
      users: [],
    });
  });
});
