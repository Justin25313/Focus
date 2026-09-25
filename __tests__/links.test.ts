import { focusAppForUrl } from '../src/services/links';

describe('links to Focus apps', () => {
  it('opens them in Focus instead of the real apps', () => {
    expect(focusAppForUrl('https://www.instagram.com/p/abc123/')).toEqual({
      app: 'instagram',
      path: '/p/abc123/',
    });
    expect(focusAppForUrl('https://youtu.be/dQw4w9WgXcQ?t=3')).toEqual({
      app: 'youtube',
      path: '/watch?v=dQw4w9WgXcQ',
    });
    expect(focusAppForUrl('https://www.youtube.com/watch?v=x1&t=3')).toEqual({
      app: 'youtube',
      path: '/watch?v=x1&t=3',
    });
    expect(focusAppForUrl('https://x.com/jack/status/20')).toEqual({
      app: 'x',
      path: '/jack/status/20',
    });
    expect(focusAppForUrl('https://redd.it/abc12')).toEqual({
      app: 'reddit',
      path: '/comments/abc12/',
    });
    expect(focusAppForUrl('https://reddit.com/r/de/')).toEqual({
      app: 'reddit',
      path: '/r/de/',
    });
  });

  it('leaves other sites alone and never passes unsafe paths', () => {
    expect(focusAppForUrl('https://example.com/')).toBeNull();
    expect(focusAppForUrl('mailto:a@b.c')).toBeNull();
    expect(
      focusAppForUrl('https://www.instagram.com/p/a"onload=x/?q=<b>'),
    ).toEqual({ app: 'instagram', path: '/' });
  });
});
