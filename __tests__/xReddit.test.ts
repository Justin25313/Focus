import {
  blockReasonForPath,
  decideNavigation,
} from '../src/filtering/engine/RouteGuard';
import {
  REDDIT_SERVICE_RULES,
  redditFeedPath,
  subredditFromPath,
} from '../src/filtering/reddit/routes';
import { X_SERVICE_RULES, xSearchPath } from '../src/filtering/x/routes';
import { xPolicyFor } from '../src/controls/x';
import {
  addCommunity,
  parseCommunities,
  redditShortcuts,
  xShortcuts,
} from '../src/search/shortcuts';

const redditPolicy = { rHome: true, rPopular: true };

describe('X rules', () => {
  const reason = (path: string) =>
    blockReasonForPath(path, xPolicyFor(), X_SERVICE_RULES);

  it('blocks Explore and trends, allows the rest', () => {
    expect(reason('/explore')).toBe('xExplore');
    expect(reason('/explore/tabs/for-you')).toBe('xExplore');
    expect(reason('/i/trends')).toBe('xExplore');
    expect(reason('/home')).toBeNull();
    expect(reason('/search')).toBeNull();
    expect(reason('/jack/status/20')).toBeNull();
    expect(reason('/explorer')).toBeNull();
  });

  it('keeps sign-in in the app and sends t.co links out', () => {
    expect(
      decideNavigation(
        { url: 'https://accounts.google.de/x' },
        xPolicyFor(),
        X_SERVICE_RULES,
      ).action,
    ).toBe('allow');
    expect(
      decideNavigation(
        { url: 'https://appleid.apple.com/auth' },
        xPolicyFor(),
        X_SERVICE_RULES,
      ).action,
    ).toBe('allow');
    expect(
      decideNavigation(
        { url: 'https://t.co/abc' },
        xPolicyFor(),
        X_SERVICE_RULES,
      ).action,
    ).toBe('openExternally');
  });

  it('builds search paths and profile shortcuts', () => {
    expect(xSearchPath(" a&b (it's) ")).toBe(
      '/search?q=a%26b%20%28it%27s%29&src=typed_query',
    );
    expect(xShortcuts('@jack')[0].path).toBe('/jack');
    expect(xShortcuts('two words')).toEqual([]);
  });
});

describe('Reddit rules', () => {
  const reason = (path: string) =>
    blockReasonForPath(path, redditPolicy, REDDIT_SERVICE_RULES);

  it('blocks the home feed, Popular, All and Explore', () => {
    expect(reason('/')).toBe('rHome');
    expect(reason('/best/')).toBe('rHome');
    expect(reason('/hot')).toBe('rHome');
    expect(reason('/r/popular/')).toBe('rPopular');
    expect(reason('/r/all/top/')).toBe('rPopular');
    expect(reason('/explore/')).toBe('rPopular');
    expect(reason('/t/gaming/')).toBe('rPopular');
  });

  it('allows communities, posts, users and search', () => {
    expect(reason('/r/de/')).toBeNull();
    expect(reason('/r/de/comments/abc/title/')).toBeNull();
    expect(reason('/r/allergies/')).toBeNull();
    expect(reason('/r/popularmechanics/')).toBeNull();
    expect(reason('/user/spez/')).toBeNull();
    expect(reason('/search/?q=x')).toBeNull();
    expect(reason('/notifications')).toBeNull();
  });

  it('knows communities from paths and input', () => {
    expect(subredditFromPath('/r/de/comments/x/')).toBe('de');
    expect(subredditFromPath('/r/popular/')).toBeNull();
    expect(subredditFromPath('/user/x/')).toBeNull();
    expect(redditShortcuts('r/de')[0].path).toBe('/r/de/');
    expect(redditShortcuts('u/spez')[0].path).toBe('/user/spez/');
    expect(redditShortcuts('all')).toEqual([]);
    expect(redditShortcuts('two words')).toEqual([]);
  });

  it('builds your own feed from your communities only', () => {
    expect(redditFeedPath(['de', 'Python', 'python', 'all', '../x'])).toBe(
      '/r/de+Python/',
    );
    expect(redditFeedPath([])).toBeNull();
    // Combined feeds are allowed, unless they sneak in Popular or All.
    expect(reason('/r/de+Python/')).toBeNull();
    expect(reason('/r/de+all/')).toBe('rPopular');
    expect(reason('/r/popular+de/')).toBe('rPopular');
    expect(reason('/r/de+allergies/')).toBeNull();
  });

  it('remembers communities, most recent first', () => {
    expect(addCommunity(['de', 'Python'], 'python')).toEqual(['python', 'de']);
    expect(parseCommunities(['de', 7, '../x', 'ok_name'])).toEqual([
      'de',
      'ok_name',
    ]);
    expect(parseCommunities(null)).toEqual([]);
  });
});
