/**
 * The guard script on X's mobile site.
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://x.com/notifications"}
 */
/// <reference lib="dom" />
import {
  buildGuardScript,
  buildXGuardConfig,
} from '../src/filtering/instagram/scripts';

type Posted = Record<string, unknown>;
const posted: Posted[] = [];
const ofType = (type: string) => posted.filter(m => m.type === type);

async function waitFor(condition: () => boolean, timeout = 4000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('timed out');
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

beforeAll(() => {
  (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
  document.addEventListener('click', event => event.preventDefault());
  // eslint-disable-next-line no-eval
  (0, eval)(buildGuardScript(buildXGuardConfig()));
});

beforeEach(() => {
  posted.length = 0;
});

describe('guard on X', () => {
  it('blocks Explore', () => {
    history.pushState({}, '', '/explore');
    expect(ofType('BLOCKED_ROUTE')).toEqual([
      {
        type: 'BLOCKED_ROUTE',
        path: '/explore',
        reason: 'xExplore',
        navigated: true,
      },
    ]);
    history.pushState({}, '', '/notifications');
  });

  it('keeps "Following" selected on the home timeline, fail closed', async () => {
    const root = document.documentElement;
    const list = document.createElement('div');
    list.setAttribute('role', 'tablist');
    const tabs = [0, 1].map(i => {
      const wrap = document.createElement('div');
      wrap.setAttribute('role', 'presentation');
      const tab = document.createElement('a');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      wrap.appendChild(tab);
      list.appendChild(wrap);
      return tab;
    });
    // X switches the selection when a tab is clicked.
    tabs[1].addEventListener('click', () => {
      tabs[0].setAttribute('aria-selected', 'false');
      tabs[1].setAttribute('aria-selected', 'true');
    });

    history.pushState({}, '', '/home');
    // No tabs yet: the timeline stays hidden.
    expect(root.hasAttribute('data-focus-pin-pending')).toBe(true);

    document.body.appendChild(list);
    await waitFor(() => tabs[1].getAttribute('aria-selected') === 'true');
    await waitFor(() => !root.hasAttribute('data-focus-pin-pending'));
    // "For you" is gone.
    expect(
      (tabs[0].parentElement as HTMLElement).hasAttribute(
        'data-focus-pin-hide',
      ),
    ).toBe(true);

    const css = document.getElementById('focus-guard-style')?.textContent ?? '';
    expect(css).toContain(
      'html[data-focus-pin-pending] section[role="region"]',
    );
    list.remove();
    history.pushState({}, '', '/notifications');
    expect(root.hasAttribute('data-focus-pin-pending')).toBe(false);
  });

  it('opens the Focus search instead of Explore links', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/explore');
    document.body.appendChild(link);
    link.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(ofType('OPEN_SEARCH')).toHaveLength(1);
    link.remove();
  });
});
