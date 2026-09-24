import {
  parseYouTubeSuggestions,
  splitSuggestion,
  youtubeSuggestUrl,
} from '../src/search/youtubeSuggest';

describe('YouTube suggestions', () => {
  it('builds an encoded request URL', () => {
    expect(youtubeSuggestUrl(' münchen & co ')).toBe(
      'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=de&ie=utf-8&oe=utf-8&q=m%C3%BCnchen%20%26%20co',
    );
  });

  it('reads the suggestion list and ignores junk', () => {
    expect(
      parseYouTubeSuggestions([
        'lofi',
        ['lofi hip hop', 'LOFI HIP HOP', 3, '', 'lofi girl'],
        [],
        {},
      ]),
    ).toEqual(['lofi hip hop', 'lofi girl']);
    expect(parseYouTubeSuggestions(null)).toEqual([]);
    expect(parseYouTubeSuggestions({ q: 'x' })).toEqual([]);
    expect(parseYouTubeSuggestions(['x', 'y'])).toEqual([]);
  });

  it('keeps at most eight', () => {
    const many = Array.from({ length: 20 }, (_, i) => `s${i}`);
    expect(parseYouTubeSuggestions(['s', many])).toHaveLength(8);
  });

  it('splits typed text from the completion', () => {
    expect(splitSuggestion('Lofi Girl', 'lofi')).toEqual({
      typed: 'Lofi',
      rest: ' Girl',
    });
    expect(splitSuggestion('lofi girl', 'jazz')).toEqual({
      typed: '',
      rest: 'lofi girl',
    });
  });
});
