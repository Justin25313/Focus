/**
 * The guard script on YouTube's mobile site.
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://m.youtube.com/feed/subscriptions"}
 */
/// <reference lib="dom" />
import {
  buildYouTubeGuardConfig,
  buildGuardScript,
  navigateScript,
} from '../src/filtering/instagram/scripts';
import { youtubeSearchPath } from '../src/screens/YouTubeSearchScreen';

type Posted = Record<string, unknown>;
const posted: Posted[] = [];
const ofType = (type: string) => posted.filter(m => m.type === type);

beforeAll(() => {
  (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
  document.addEventListener('click', event => event.preventDefault());
  // eslint-disable-next-line no-eval
  (0, eval)(buildGuardScript(buildYouTubeGuardConfig()));
});

beforeEach(() => {
  posted.length = 0;
});

describe('guard on YouTube', () => {
  it('hides Shorts shelves, the Shorts tab and YouTube’s own tab bar', () => {
    const css = document.getElementById('focus-guard-style')?.textContent ?? '';
    for (const selector of [
      'ytm-pivot-bar-renderer',
      'ytm-reel-shelf-renderer',
      'ytm-shorts-lockup-view-model',
      'a[href^="/shorts"]',
      'ytm-watch-next-secondary-results-renderer',
    ]) {
      expect(css).toContain(selector);
    }
    // Comments stay visible by default.
    expect(css).not.toContain('ytm-comment-section-renderer');
  });

  it('blocks the Shorts player', () => {
    history.pushState({}, '', '/shorts/abc123');
    expect(ofType('BLOCKED_ROUTE')).toEqual([
      {
        type: 'BLOCKED_ROUTE',
        path: '/shorts/abc123',
        reason: 'shorts',
        navigated: true,
      },
    ]);
    history.pushState({}, '', '/watch');
  });

  it('sends the recommendation home to the subscriptions, silently', () => {
    const subs = document.createElement('a');
    subs.setAttribute('href', '/feed/subscriptions');
    const onClick = jest.fn();
    subs.addEventListener('click', onClick);
    document.body.appendChild(subs);

    history.pushState({}, '', '/');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ofType('BLOCKED_ROUTE')).toHaveLength(0);

    subs.remove();
    history.pushState({}, '', '/watch');
  });

  it('stops taps on Shorts links before YouTube handles them', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/shorts/xyz');
    document.body.appendChild(link);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(ofType('BLOCKED_ROUTE')[0]).toMatchObject({
      reason: 'shorts',
      navigated: false,
    });
    link.remove();
  });

  it('does not run Instagram-only features', () => {
    const bar = document.createElement('div');
    bar.style.position = 'fixed';
    bar.getBoundingClientRect = () =>
      ({ top: window.innerHeight - 50, height: 50 } as DOMRect);
    const a = document.createElement('a');
    a.setAttribute('href', '/');
    bar.appendChild(a);
    document.body.appendChild(bar);
    history.pushState({}, '', '/watch');
    expect(bar.hasAttribute('data-focus-ig-nav')).toBe(false);
    expect(ofType('OWN_PROFILE')).toHaveLength(0);
    bar.remove();
  });

  it('can navigate to a search results page', () => {
    expect(navigateScript(youtubeSearchPath('lo-fi beats'))).not.toBeNull();
  });
});
