const { normalizeMovieBundle, normalizeMoviePreview, getImageUrl } = require('../../src/utils/normalizeData');

describe('normalizeData Utility', () => {
  it('should normalize movie bundle data correctly', () => {
    const rawData = {
      id: 123,
      title: 'Test Movie',
      poster_path: '/test.jpg'
    };

    const result = normalizeMovieBundle(rawData);
    expect(result.metadata.provider).toBe('TMDB');
    expect(result.movie.tmdbId).toBe(123);
    expect(result.movie.title).toBe('Test Movie');
    expect(result.movie.poster.url).toContain('/test.jpg');
    expect(result.genres).toEqual([]);
    expect(result.credits.mainCast).toEqual([]);
  });

  it('should format image url correctly', () => {
    const url = getImageUrl('/path.jpg');
    expect(url).toBe('https://image.tmdb.org/t/p/original/path.jpg');
  });
});
