/**
 * Full-screen Reels: Instagram's controls are moved below the status bar
 * and above the tab bar; if none are found, the app is told.
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.instagram.com/reels/ABC/"}
 */
/// <reference lib="dom" />
import { PRESETS } from '../src/controls/controls';
import {
  buildGuardConfig,
  buildGuardScript,
} from '../src/filtering/instagram/scripts';
import { parseWebMessage } from '../src/filtering/engine/messages';

type Posted = Record<string, unknown>;
const posted: Posted[] = [];
const VH = window.innerHeight;

async function waitFor(condition: () => boolean, timeout = 4000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('timed out');
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

function box(el: HTMLElement, top: number, height: number) {
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height, left: 0, right: 400 } as DOMRect);
}

const reelLayout = () => posted.filter(m => m.type === 'REEL_LAYOUT');

beforeAll(() => {
  (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
});

describe('full-screen Reels', () => {
  it('moves the controls clear of status bar and tab bar', async () => {
    const item = document.createElement('div');
    box(item, 0, VH);
    const video = document.createElement('video');
    box(video, 0, VH);
    const head = document.createElement('div');
    head.style.position = 'absolute';
    box(head, 10, 40);
    const info = document.createElement('div');
    info.style.position = 'absolute';
    box(info, VH - 150, 140);
    const name = document.createElement('span');
    box(name, VH - 140, 20);
    info.appendChild(name);
    item.append(video, head, info);
    document.body.appendChild(item);

    // eslint-disable-next-line no-eval
    (0, eval)(
      buildGuardScript(
        buildGuardConfig(
          { ...PRESETS.balanced, blockReels: false },
          false,
          null,
          {
            top: 50,
            bottom: 100,
          },
        ),
      ),
    );
    await waitFor(() => info.hasAttribute('data-focus-reel-lift'));
    const root = document.documentElement;
    expect(root.hasAttribute('data-focus-reel')).toBe(true);
    expect(head.hasAttribute('data-focus-reel-top')).toBe(true);
    // Only the outermost overlay moves.
    expect(name.hasAttribute('data-focus-reel-lift')).toBe(false);
    expect(root.style.getPropertyValue('--focus-reel-lift')).toBe('100px');
    expect(root.style.getPropertyValue('--focus-reel-top')).toBe('50px');
    expect(reelLayout()).toEqual([{ type: 'REEL_LAYOUT', ok: true }]);
    expect(document.getElementById('focus-guard-style')?.textContent).toContain(
      'translate:0 calc(-1 * var(--focus-reel-lift,0px))',
    );

    // Leaving the Reels: back to normal.
    history.pushState({}, '', '/natgeo/');
    await waitFor(() => !root.hasAttribute('data-focus-reel'));
    item.remove();
  });

  it('tells the app when it cannot find the controls', async () => {
    posted.length = 0;
    const item = document.createElement('div');
    box(item, 0, VH);
    const video = document.createElement('video');
    box(video, 0, VH);
    item.appendChild(video);
    document.body.appendChild(item);
    history.pushState({}, '', '/reels/XYZ/');
    await waitFor(() => reelLayout().length > 0, 5000);
    expect(reelLayout()).toEqual([{ type: 'REEL_LAYOUT', ok: false }]);
    item.remove();
  });

  it('the bridge accepts only a yes or no', () => {
    const from = 'https://www.instagram.com/';
    const parse = (ok: unknown) =>
      parseWebMessage(JSON.stringify({ type: 'REEL_LAYOUT', ok }), from);
    expect(parse(true)).toEqual({ type: 'REEL_LAYOUT', ok: true });
    expect(parse('yes')).toBeNull();
  });
});
