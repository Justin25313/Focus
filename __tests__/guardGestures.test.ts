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
  navigateScript,
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
  // jsdom cannot load pages; full-page fallbacks land here instead.
  (window as unknown as Record<string, unknown>).__focusReplaceForTests =
    () => {};
  // Instagram reports sideways scrollers; swipes are checked as well.
  // eslint-disable-next-line no-eval
  (0, eval)(buildGuardScript({ ...buildGuardConfig(), swipeNav: true }));
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
    // The tab pager is told to stay still while the carousel is swiped.
    expect(ofType('H_SCROLL')).toEqual([
      { type: 'H_SCROLL', active: true },
      { type: 'H_SCROLL', active: false },
    ]);
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

describe('navigation inside Instagram', () => {
  const run = (script: string) => {
    // eslint-disable-next-line no-eval
    (0, eval)(script);
  };
  afterEach(() => {
    (window as unknown as Record<string, unknown>).__focusReplaceForTests =
      () => {};
  });

  it('stays in the app when the new page renders', async () => {
    const replace = jest.fn();
    (window as unknown as Record<string, unknown>).__focusReplaceForTests =
      replace;
    run(navigateScript('/natgeo/')!);
    expect(location.pathname).toBe('/natgeo/');
    const main = document.createElement('main');
    main.innerHTML = '<img src="x.jpg">';
    document.body.appendChild(main);
    await new Promise(resolve => setTimeout(resolve, 1800));
    expect(replace).not.toHaveBeenCalled();
    main.remove();
  });

  it('loads the page normally if the router ignores the change', async () => {
    const replace = jest.fn();
    (window as unknown as Record<string, unknown>).__focusReplaceForTests =
      replace;
    run(navigateScript('/nasa/')!);
    await new Promise(resolve => setTimeout(resolve, 1800));
    expect(replace).toHaveBeenCalledWith('/nasa/');
  });
});

describe('like the app', () => {
  it('hides Instagram’s own header only where Focus shows one', () => {
    const root = document.documentElement;
    history.pushState({}, '', '/');
    expect(root.hasAttribute('data-focus-top-hidden')).toBe(true);
    history.pushState({}, '', '/natgeo/');
    expect(root.hasAttribute('data-focus-top-hidden')).toBe(false);
  });

  it('asks the app when posting or a story is tapped', () => {
    const link = document.createElement('a');
    link.setAttribute('href', '/create/story/');
    const file = document.createElement('input');
    file.type = 'file';
    document.body.append(link, file);
    const tap = (el: Element) => {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(tap(link)).toBe(true);
    expect(tap(file)).toBe(true);
    expect(ofType('CREATE')).toHaveLength(2);
    link.remove();
    file.remove();
  });
});
