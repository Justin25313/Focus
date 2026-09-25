/**
 * Your own profile gets the app's profile top.
 *
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://www.instagram.com/jstin_505/"}
 */
/// <reference lib="dom" />
import {
  buildGuardConfig,
  buildGuardScript,
} from '../src/filtering/instagram/scripts';
import { PRESETS } from '../src/controls/controls';
import { parseWebMessage } from '../src/filtering/engine/messages';

type Posted = Record<string, unknown>;
const posted: Posted[] = [];

async function waitFor(condition: () => boolean, timeout = 3000) {
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
  (window as unknown as { fetch: unknown }).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      data: {
        user: {
          full_name: 'Justin',
          biography: '🩺🏋️',
          profile_pic_url: 'https://example.com/me.jpg',
          edge_owner_to_timeline_media: { count: 2 },
          edge_followed_by: { count: 182 },
          edge_follow: { count: 12345 },
        },
      },
    }),
  }));
  document.body.innerHTML =
    '<main><div><header>web header</header></div></main>';
  // eslint-disable-next-line no-eval
  (0, eval)(
    buildGuardScript(buildGuardConfig(PRESETS.balanced, false, '/jstin_505/')),
  );
});

describe('own profile', () => {
  it('shows name, numbers and buttons like the app', async () => {
    await waitFor(() => document.getElementById('focus-profile-top') !== null);
    const top = document.getElementById('focus-profile-top')!;
    expect(top.textContent).toContain('Justin');
    expect(top.textContent).toContain('182Follower');
    expect(top.textContent).toContain('12,3 Tsd.Gefolgt');
    expect(top.textContent).toContain('Bearbeiten');
    expect(top.nextElementSibling?.tagName).toBe('HEADER');
    expect(
      document.documentElement.hasAttribute('data-focus-own-profile'),
    ).toBe(true);
    // Focus shows the app's profile header; the web one goes.
    expect(
      document.documentElement.hasAttribute('data-focus-top-hidden'),
    ).toBe(true);

    (top.querySelectorAll('.fp-btn')[1] as HTMLElement).click();
    expect(posted).toContainEqual({
      type: 'SHARE',
      url: 'https://www.instagram.com/jstin_505/',
    });
  });

  it('leaves other profiles alone', async () => {
    history.pushState({}, '', '/natgeo/');
    await waitFor(() => document.getElementById('focus-profile-top') === null);
    expect(
      document.documentElement.hasAttribute('data-focus-own-profile'),
    ).toBe(false);
  });

  it('shares only the profile address', () => {
    const from = 'https://www.instagram.com/';
    const share = (url: string) =>
      parseWebMessage(JSON.stringify({ type: 'SHARE', url }), from);
    expect(share('https://www.instagram.com/jstin_505/')).not.toBeNull();
    expect(share('https://evil.example/x')).toBeNull();
    expect(share(['javascript', 'alert(1)'].join(':'))).toBeNull();
  });
});
