/**
 * Swipes and scroll state reported by the guard (Instagram config).
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.instagram.com/"}
 */
/// <reference lib="dom" />
import {
  buildGuardConfig,
  buildGuardScript,
} from '../src/filtering/instagram/scripts';
import { parseWebMessage } from '../src/filtering/engine/messages';

type Posted = Record<string, unknown>;
const posted: Posted[] = [];
const ofType = (type: string) => posted.filter(m => m.type === type);

function touch(type: string, target: Element, x: number, y: number) {
  const event = new Event(type, { bubbles: true });
  const point = [{ clientX: x, clientY: y }];
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : point,
  });
  Object.defineProperty(event, 'changedTouches', { value: point });
  target.dispatchEvent(event);
}

function swipe(target: Element, fromX: number, toX: number, dy = 0) {
  touch('touchstart', target, fromX, 300);
  touch('touchend', target, toX, 300 + dy);
}

beforeAll(() => {
  (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
    postMessage: (data: string) => posted.push(JSON.parse(data)),
  };
  Object.defineProperty(window, 'innerWidth', { value: 393 });
  // eslint-disable-next-line no-eval
  (0, eval)(buildGuardScript(buildGuardConfig()));
});

beforeEach(() => {
  posted.length = 0;
});

describe('swipes', () => {
  it('reports a clear horizontal swipe', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    swipe(el, 300, 150);
    swipe(el, 100, 260);
    expect(ofType('SWIPE')).toEqual([
      { type: 'SWIPE', direction: 'left' },
      { type: 'SWIPE', direction: 'right' },
    ]);
    el.remove();
  });

  it('ignores short, diagonal and edge swipes', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    swipe(el, 300, 250);
    swipe(el, 300, 150, 120);
    swipe(el, 10, 200);
    expect(ofType('SWIPE')).toHaveLength(0);
    el.remove();
  });

  it('leaves carousels to themselves', () => {
    const article = document.createElement('article');
    const list = document.createElement('ul');
    list.innerHTML = '<li><img></li><li><img></li>';
    article.appendChild(list);
    document.body.appendChild(article);
    swipe(list.querySelector('img') as Element, 300, 120);
    expect(ofType('SWIPE')).toHaveLength(0);
    article.remove();
  });
});

describe('scroll state', () => {
  it('turns compact when scrolling down and back when scrolling up', () => {
    const scrollTo = (y: number) => {
      Object.defineProperty(window, 'scrollY', {
        value: y,
        configurable: true,
      });
      window.dispatchEvent(new Event('scroll'));
    };
    scrollTo(200);
    scrollTo(400);
    scrollTo(380);
    scrollTo(10);
    expect(ofType('SCROLL_STATE')).toEqual([
      { type: 'SCROLL_STATE', compact: true },
      { type: 'SCROLL_STATE', compact: false },
    ]);
  });
});

describe('bridge validation', () => {
  const from = 'https://www.instagram.com/';
  it('accepts only well-formed gesture messages', () => {
    expect(
      parseWebMessage(JSON.stringify({ type: 'SWIPE', direction: 'up' }), from),
    ).toBeNull();
    expect(
      parseWebMessage(
        JSON.stringify({ type: 'SCROLL_STATE', compact: 'yes' }),
        from,
      ),
    ).toBeNull();
    expect(
      parseWebMessage(
        JSON.stringify({ type: 'SCROLL_STATE', compact: true }),
        from,
      ),
    ).toEqual({ type: 'SCROLL_STATE', compact: true });
  });
});
