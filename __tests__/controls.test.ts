import {
  DEFAULT_CONTROLS,
  PRESETS,
  homePathFor,
  modeOf,
  policyFor,
} from '../src/controls/controls';
import { blockReasonForPath } from '../src/filtering/engine/RouteGuard';

describe('modes', () => {
  it('Balanced is the default', () => {
    expect(modeOf(DEFAULT_CONTROLS)).toBe('balanced');
  });

  it('recognises every preset and falls back to custom', () => {
    expect(modeOf(PRESETS.messages)).toBe('messages');
    expect(modeOf(PRESETS.storiesMessages)).toBe('storiesMessages');
    expect(modeOf({ ...PRESETS.balanced, blockSaved: true })).toBe('custom');
  });

  it('every preset blocks Reels and Explore', () => {
    for (const controls of Object.values(PRESETS)) {
      const policy = policyFor(controls);
      expect(policy.reels && policy.sharedReel && policy.explore).toBe(true);
    }
  });
});

describe('route policy per mode', () => {
  it('Balanced keeps home, stories and saved open', () => {
    const policy = policyFor(PRESETS.balanced);
    expect(blockReasonForPath('/', policy)).toBeNull();
    expect(blockReasonForPath('/stories/natgeo/1/', policy)).toBeNull();
    expect(blockReasonForPath('/me/saved/', policy)).toBeNull();
  });

  it('Messages only blocks home, stories and saved', () => {
    const policy = policyFor(PRESETS.messages);
    expect(blockReasonForPath('/', policy)).toBe('feed');
    expect(blockReasonForPath('/stories/natgeo/1/', policy)).toBe('stories');
    expect(blockReasonForPath('/me/saved/', policy)).toBe('saved');
    expect(blockReasonForPath('/direct/inbox/', policy)).toBeNull();
    expect(blockReasonForPath('/natgeo/', policy)).toBeNull();
  });

  it('Stories + Messages keeps stories and the home page (feed hidden in-page)', () => {
    const policy = policyFor(PRESETS.storiesMessages);
    expect(blockReasonForPath('/', policy)).toBeNull();
    expect(blockReasonForPath('/stories/natgeo/1/', policy)).toBeNull();
  });
});

describe('home path', () => {
  it('follows the home feed setting', () => {
    expect(homePathFor(PRESETS.balanced)).toBe('/?variant=following');
    expect(homePathFor(PRESETS.storiesMessages)).toBe('/');
    expect(homePathFor(PRESETS.messages)).toBe('/direct/inbox/');
    expect(homePathFor({ ...PRESETS.balanced, homeFeed: 'normal' })).toBe('/');
  });
});
