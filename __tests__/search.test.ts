import { parseSearchInput } from '../src/filtering/instagram/search';

describe('parseSearchInput', () => {
  it('recognises usernames', () => {
    expect(parseSearchInput(' @natgeo ')).toEqual({
      kind: 'username',
      username: 'natgeo',
    });
    expect(parseSearchInput('some.user_1')).toEqual({
      kind: 'username',
      username: 'some.user_1',
    });
  });

  it('opens pasted profile and post links', () => {
    expect(
      parseSearchInput('https://www.instagram.com/natgeo/?igsh=abc'),
    ).toEqual({ kind: 'path', path: '/natgeo/' });
    expect(parseSearchInput('instagram.com/p/C1a2b3/')).toEqual({
      kind: 'path',
      path: '/p/C1a2b3/',
    });
  });

  it('refuses pasted Reels and Explore links', () => {
    expect(parseSearchInput('https://www.instagram.com/reel/C1/')).toEqual({
      kind: 'blocked',
      reason: 'sharedReel',
    });
    expect(parseSearchInput('https://instagram.com/explore/')).toEqual({
      kind: 'blocked',
      reason: 'explore',
    });
  });

  it('treats everything else as a name query', () => {
    expect(parseSearchInput('National Geographic')).toEqual({
      kind: 'query',
      text: 'National Geographic',
    });
    expect(parseSearchInput('explore')).toEqual({
      kind: 'query',
      text: 'explore',
    });
    expect(parseSearchInput('   ')).toEqual({ kind: 'empty' });
  });
});
