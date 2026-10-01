import {
  DEFAULT_REDDIT_CONTROLS,
  parseRedditControls,
  redditPolicyFor,
} from '../src/controls/reddit';
import { buildRedditGuardConfig } from '../src/filtering/instagram/scripts';
import { parseSettings } from '../src/storage/settings';

describe('Reddit controls', () => {
  it('starts on your communities, Popular blocked', () => {
    expect(DEFAULT_REDDIT_CONTROLS).toEqual({
      home: 'communities',
      blockPopular: true,
    });
    expect(parseSettings({ schemaVersion: 8 }).reddit).toEqual(
      DEFAULT_REDDIT_CONTROLS,
    );
    expect(parseRedditControls({ home: 'x', blockPopular: 1 })).toEqual(
      DEFAULT_REDDIT_CONTROLS,
    );
  });

  it("Reddit's own start page can be chosen", () => {
    const controls = { home: 'reddit' as const, blockPopular: true };
    expect(redditPolicyFor(controls)).toEqual({ rHome: false, rPopular: true });
    const config = buildRedditGuardConfig(false, '/r/a+b/', controls);
    expect(config.redirects).toEqual({});
    expect(config.policy.rHome).toBe(false);
  });

  it('your communities: Reddit home goes to their feed', () => {
    const config = buildRedditGuardConfig(false, '/r/a+b/');
    expect(config.redirects).toEqual({ rHome: '/r/a+b/' });
    expect(config.hiddenLinkSelectors).toContain('a[href^="/r/popular"]');
  });

  it('Popular can be allowed', () => {
    const config = buildRedditGuardConfig(false, null, {
      home: 'communities',
      blockPopular: false,
    });
    expect(config.policy.rPopular).toBe(false);
    expect(config.hiddenLinkSelectors).toEqual([]);
  });
});
