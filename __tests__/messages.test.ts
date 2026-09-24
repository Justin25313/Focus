import { parseWebMessage } from '../src/filtering/engine/messages';

const FROM_IG = 'https://www.instagram.com/direct/inbox/';
const send = (value: unknown, url = FROM_IG) =>
  parseWebMessage(JSON.stringify(value), url);

describe('parseWebMessage', () => {
  it('accepts well-formed messages', () => {
    expect(send({ type: 'FILTER_READY', version: '2026.09.1' })).toEqual({
      type: 'FILTER_READY',
      version: '2026.09.1',
    });
    expect(send({ type: 'ROUTE_CHANGED', path: '/natgeo/' })).toEqual({
      type: 'ROUTE_CHANGED',
      path: '/natgeo/',
    });
    expect(
      send({
        type: 'BLOCKED_ROUTE',
        path: '/reels/',
        reason: 'reels',
        navigated: true,
      }),
    ).toEqual({
      type: 'BLOCKED_ROUTE',
      path: '/reels/',
      reason: 'reels',
      navigated: true,
    });
    expect(send({ type: 'OPEN_SEARCH' })).toEqual({ type: 'OPEN_SEARCH' });
  });

  it('accepts PAGE_READY with a path', () => {
    expect(send({ type: 'PAGE_READY', path: '/' })).toEqual({
      type: 'PAGE_READY',
      path: '/',
    });
    expect(send({ type: 'PAGE_READY' })).toBeNull();
  });

  it('accepts only profile paths as own profile', () => {
    expect(send({ type: 'OWN_PROFILE', path: '/me.myself/' })).toEqual({
      type: 'OWN_PROFILE',
      path: '/me.myself/',
    });
    expect(send({ type: 'OWN_PROFILE', path: '/reels/' })).toBeNull();
    expect(send({ type: 'OWN_PROFILE', path: '/direct/inbox/' })).toBeNull();
  });

  it('rejects messages from other origins', () => {
    expect(send({ type: 'OPEN_SEARCH' }, 'https://evil.example/')).toBeNull();
    expect(
      send({ type: 'OPEN_SEARCH' }, 'http://www.instagram.com/'),
    ).toBeNull();
    expect(send({ type: 'OPEN_SEARCH' }, 'https://m.facebook.com/')).toBeNull();
  });

  it('rejects unknown types and malformed payloads', () => {
    expect(send({ type: 'EVAL', code: 'alert(1)' })).toBeNull();
    expect(parseWebMessage('not json', FROM_IG)).toBeNull();
    expect(parseWebMessage('null', FROM_IG)).toBeNull();
    expect(send({ type: 'ROUTE_CHANGED', path: 'relative' })).toBeNull();
    expect(
      send({ type: 'ROUTE_CHANGED', path: `/${'x'.repeat(600)}` }),
    ).toBeNull();
    expect(
      send({
        type: 'BLOCKED_ROUTE',
        path: '/x/',
        reason: 'other',
        navigated: true,
      }),
    ).toBeNull();
    expect(
      send({ type: 'BLOCKED_ROUTE', path: '/reels/', reason: 'reels' }),
    ).toBeNull();
    expect(send({ type: 'FILTER_ERROR', code: 'lower case' })).toBeNull();
  });

  it('sanitises search results', () => {
    expect(
      send({
        type: 'SEARCH_RESULTS',
        requestId: 3,
        ok: true,
        users: [
          {
            username: 'natgeo',
            fullName: 'National Geographic',
            verified: true,
          },
          { username: 'bad name<script>', fullName: 'x' },
          { username: 'plain' },
          null,
          'nope',
        ],
      }),
    ).toEqual({
      type: 'SEARCH_RESULTS',
      requestId: 3,
      ok: true,
      users: [
        { username: 'natgeo', fullName: 'National Geographic', verified: true },
        { username: 'plain', fullName: '', verified: false },
      ],
    });
    expect(
      send({ type: 'SEARCH_RESULTS', requestId: 1.5, ok: true, users: [] }),
    ).toBeNull();
  });
});
