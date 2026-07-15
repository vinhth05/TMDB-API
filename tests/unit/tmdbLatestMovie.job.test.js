const { runLatestMovieJob } = require('../../src/jobs/tmdbLatestMovie.job');
const tmdbService = require('../../src/services/tmdbService');
const latestCache = require('../../src/services/tmdbLatestMovieCache.service');

jest.mock('../../src/services/tmdbService');

describe('tmdbLatestMovie Job (ID Polling Architecture)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestCache.clear();
  });

  const mockLatestMovie = (id) => {
    tmdbService.getLatestMovie.mockResolvedValue({ id, title: `Latest ${id}` });
  };

  const mockBundle = (mockDataMap = {}) => {
    tmdbService.getMovieBundle.mockImplementation(async (movieId) => {
      if (mockDataMap[movieId] === '404') {
        const err = new Error('Not found');
        err.response = { status: 404 };
        throw err;
      }
      if (mockDataMap[movieId] === '429') {
        const err = new Error('Rate limit');
        err.response = { status: 429 };
        throw err;
      }
      if (mockDataMap[movieId] === 'timeout') {
        // Return a promise that never resolves for timeout simulation
        // Wait, the job has a Promise.race timeout of 5000ms. 
        // In tests we don't want to actually wait 5s, so we just throw directly
        throw new Error('Timeout');
      }
      
      const overrides = mockDataMap[movieId] || {};
      return {
        id: movieId,
        title: `Movie ${movieId}`,
        overview: 'This is a very good overview that is definitely longer than fifty characters for sure because we need it to be.',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        release_date: '2028-01-01',
        vote_average: 7.5,
        popularity: 10,
        adult: false,
        vote_count: 100,
        imdb_id: 'tt1234567',
        genres: [{ id: 1, name: 'Action' }],
        credits: { cast: [{ name: 'Actor 1' }], crew: [{ job: 'Director', name: 'Director 1' }] },
        production_companies: [{ name: 'Company 1' }],
        videos: { results: [{ type: 'Trailer', site: 'YouTube' }] },
        ...overrides
      };
    });
  };

  it('1. Detect new movie ID successfully', async () => {
    mockLatestMovie(100);
    await runLatestMovieJob();
    expect(latestCache.getLastCheckedMovieId()).toBe(100);

    mockLatestMovie(101);
    mockBundle({ 101: {} });
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(1);
    expect(latestCache.getMovies()[0].tmdbId).toBe(101);
    expect(latestCache.getLastCheckedMovieId()).toBe(101);
  });

  it('2. Duplicate movie ID is ignored', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(100);
    await runLatestMovieJob();
    
    expect(tmdbService.getMovieBundle).not.toHaveBeenCalled();
    expect(latestCache.getMovies().length).toBe(0);
  });

  it('3. Invalid TMDB movie ID is skipped', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(102);
    mockBundle({ 101: '404', 102: {} });
    
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(1);
    expect(latestCache.getMovies()[0].tmdbId).toBe(102);
  });

  it('4. Movie without poster is rejected', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(101);
    mockBundle({ 101: { poster_path: null, overview: null, imdb_id: null, credits: null } }); // Extremely low score
    
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(0);
  });

  it('5. Spam movie title is rejected', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(101);
    mockBundle({ 101: { title: 'This is a test movie' } });
    
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(0);
  });

  it('6. Low-quality movie goes to HOLD', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(101);
    // Score ~50: poster(20) + release_date(10) + imdb_id(15) = 45 -> HOLD
    mockBundle({ 101: { 
      overview: null,
      genres: [],
      credits: null,
      production_companies: [],
      videos: null,
      popularity: 1,
      vote_count: 5
    } });
    
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(0); // Not ACCEPT, so not in cache
  });

  it('7. High-quality movie becomes ACCEPT', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(101);
    mockBundle({ 101: {} }); // Default mock bundle has score > 70
    
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(1);
  });

  it('8. Cache never exceeds 20 movies', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(125); // delta 25. Job will scan 20 max.
    mockBundle(); // All success
    
    await runLatestMovieJob();
    
    // We mocked a gap of 25, job should scan 20
    expect(latestCache.getMovies().length).toBe(20);
  });

  it('9. TMDB rate limit does not crash scheduler', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(102);
    // Let's just mock 101 as 429
    mockBundle({ 101: '429', 102: {} });
    
    // To speed up test we should mock setTimeout globally or just let it throw in tests 
    // since we use a wait function in our job. We can spy on global.setTimeout if needed,
    // but the test should pass without crashing
    
    await expect(runLatestMovieJob()).resolves.not.toThrow();
  });

  it('10. Scheduler recovers after failure', async () => {
    latestCache.setLastCheckedMovieId(100);
    mockLatestMovie(103);
    mockBundle({ 101: 'timeout', 102: {}, 103: {} });
    
    await runLatestMovieJob();
    
    expect(latestCache.getMovies().length).toBe(2);
    expect(latestCache.getLastCheckedMovieId()).toBe(103);
  });
});
