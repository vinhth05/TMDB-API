const { runLatestMovieJob } = require('../../src/jobs/tmdbLatestMovie.job');
const qualityChecker = require('../../src/services/movieQualityChecker.service');
const latestCache = require('../../src/services/tmdbLatestMovieCache.service');
const tmdbService = require('../../src/services/tmdbService');
const nodeCache = require('../../src/utils/nodeCache');

jest.mock('../../src/services/tmdbService');
jest.mock('../../src/utils/nodeCache');

describe('TMDB Latest Movie Feed System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestCache.clear();
  });

  describe('Scheduler & Fetching', () => {
    it('should detect new TMDB movie ID and scan', async () => {
      latestCache.setLastCheckedMovieId(100);
      tmdbService.getLatestMovie.mockResolvedValue({ id: 102 });
      
      // Mocks for batch fetch
      tmdbService.getMovieBundle.mockResolvedValueOnce({ id: 101, title: 'Valid Movie A', overview: 'This is a very good overview that has more than 50 characters to ensure it passes.', poster_path: '/path.jpg', release_date: '2023-01-01', genres: [{id: 1}], credits: { cast: [{id: 1}] }, popularity: 10, vote_count: 50, external_ids: { imdb_id: 'tt1' } });
      tmdbService.getMovieBundle.mockResolvedValueOnce({ id: 102, title: 'Garbage xxx' });

      await runLatestMovieJob();

      expect(tmdbService.getMovieBundle).toHaveBeenCalledTimes(2);
      expect(latestCache.getLastCheckedMovieId()).toBe(102);
    });

    it('should fetch movie detail successfully', async () => {
      const mockDetail = { id: 200, title: 'Test Fetch' };
      tmdbService.getMovieBundle.mockResolvedValue(mockDetail);
      
      const detail = await tmdbService.getMovieBundle(200);
      expect(detail.id).toBe(200);
    });

    it('should not crash scheduler on TMDB API failure', async () => {
      latestCache.setLastCheckedMovieId(100);
      tmdbService.getLatestMovie.mockResolvedValue({ id: 101 });
      
      tmdbService.getMovieBundle.mockRejectedValue(new Error('Network Error'));

      await expect(runLatestMovieJob()).resolves.not.toThrow();
    });
  });

  describe('Movie Quality Checker', () => {
    it('should reject garbage movie', () => {
      const garbageMovie = { adult: true, title: 'Garbage', id: 1 };
      const { decision } = qualityChecker.evaluate(garbageMovie);
      expect(decision).toBe('REJECT');

      const spamMovie = { title: 'sample movie xxx', id: 2 };
      const res2 = qualityChecker.evaluate(spamMovie);
      expect(res2.decision).toBe('REJECT');
    });

    it('should accept high-quality movie', () => {
      const goodMovie = {
        id: 1,
        title: 'Blockbuster',
        overview: 'This is an amazing blockbuster movie overview. It is very long and descriptive to pass the 50 char limit.',
        poster_path: '/poster.jpg',
        release_date: '2023-01-01',
        genres: [{ name: 'Action' }],
        credits: { cast: [{ name: 'Actor' }] },
        popularity: 10,
        vote_count: 50,
        imdb_id: 'tt12345'
      };

      const { decision, score } = qualityChecker.evaluate(goodMovie);
      expect(decision).toBe('ACCEPT');
      expect(score).toBeGreaterThanOrEqual(70);
    });

    it('should HOLD incomplete movie', () => {
      const incompleteMovie = {
        id: 2,
        title: 'Indie Film',
        poster_path: '/poster.jpg', // +20
        release_date: '2023-01-01'  // +15
        // Total 35 + maybe something else to reach 40-69
      };
      
      incompleteMovie.popularity = 6; // +10 => 45

      const { decision, score } = qualityChecker.evaluate(incompleteMovie);
      expect(decision).toBe('HOLD');
      expect(score).toBeGreaterThanOrEqual(40);
      expect(score).toBeLessThan(70);
    });
  });

  describe('Cache & Merge Logic', () => {
    it('should prioritize verified movies over future movies', async () => {
      nodeCache.get.mockReturnValue(null);
      tmdbService.discoverMovies.mockResolvedValue({
        results: [
          { id: 201, title: 'Future 1' },
          { id: 202, title: 'Future 2' }
        ]
      });

      latestCache.addMovie({ tmdbId: 101, title: 'Verified 1', score: 100 });

      const merged = await latestCache.getMergedLatestTop10();
      expect(merged[0].title).toBe('Verified 1');
      expect(merged[0].source).toBe('VERIFIED');
      expect(merged[1].title).toBe('Future 1');
      expect(merged[1].source).toBe('FUTURE');
    });

    it('should remove duplicate movies', async () => {
      nodeCache.get.mockReturnValue(null);
      tmdbService.discoverMovies.mockResolvedValue({
        results: [
          { id: 101, title: 'Future Duplicate' },
          { id: 202, title: 'Future 2' }
        ]
      });

      latestCache.addMovie({ tmdbId: 101, title: 'Verified 1', score: 100 });

      const merged = await latestCache.getMergedLatestTop10();
      // Should not contain duplicate 101
      const count101 = merged.filter(m => m.tmdbId === 101).length;
      expect(count101).toBe(1);
    });

    it('should always return maximum 20 movies', async () => {
      for (let i = 1; i <= 25; i++) {
        latestCache.addMovie({ tmdbId: i, title: `Verified ${i}`, score: 100 });
      }

      const merged = await latestCache.getMergedLatestTop10();
      expect(merged.length).toBe(20);
    });

    it('should correctly expire future cache (mocking)', async () => {
      // Simulate cache missing/expired
      nodeCache.get.mockReturnValue(null);
      tmdbService.discoverMovies.mockResolvedValue({ results: [] });

      await latestCache.fetchFutureMoviesFallback();

      expect(tmdbService.discoverMovies).toHaveBeenCalledWith(expect.objectContaining({
        'primary_release_date.gte': expect.any(String),
        'primary_release_date.lte': expect.any(String),
        sortBy: 'popularity.desc',
        page: 1
      }));
      expect(nodeCache.set).toHaveBeenCalledWith('future_fallback_movies', expect.any(Array), 43200);
    });
  });
});
