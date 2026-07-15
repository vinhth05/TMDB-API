const cron = require('node-cron');
const tmdbService = require('../services/tmdbService');
const latestCache = require('../services/tmdbLatestMovieCache.service');
const qualityChecker = require('../services/movieQualityChecker.service');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, process.env.JEST_WORKER_ID !== undefined ? 0 : ms));

const fetchMovieWithRetry = async (movieId, retries = 2) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const fetchPromise = tmdbService.getMovieBundle(movieId);
      const timeoutMs = process.env.JEST_WORKER_ID !== undefined ? 100 : 5000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      );

      const movieDetail = await Promise.race([fetchPromise, timeoutPromise]);
      return movieDetail;
    } catch (error) {
      const isRateLimit = error.response && error.response.status === 429;
      const isNotFound = error.response && error.response.status === 404;

      if (isNotFound) {
        throw error;
      }

      if (attempt === retries) {
        throw error;
      }

      attempt++;
      const backoffTime = isRateLimit ? 2000 * Math.pow(2, attempt) : 1000 * attempt;
      await wait(backoffTime);
    }
  }
};

const processBatch = async (movieIds) => {
  let accepted = 0;
  let hold = 0;
  let rejected = 0;
  let errors = 0;

  // Process sequentially to minimize memory and CPU spikes
  for (const movieId of movieIds) {
    try {
      const movieDetail = await fetchMovieWithRetry(movieId);
      const { decision, score } = qualityChecker.evaluate(movieDetail);

      if (decision === 'ACCEPT') {
        const formattedMovie = {
          tmdbId: movieDetail.id,
          title: movieDetail.title || movieDetail.original_title,
          originalTitle: movieDetail.original_title,
          overview: movieDetail.overview,
          posterPath: movieDetail.poster_path,
          backdropPath: movieDetail.backdrop_path,
          releaseDate: movieDetail.release_date,
          popularity: movieDetail.popularity,
          voteAverage: movieDetail.vote_average,
          score: score
        };
        latestCache.addMovie(formattedMovie);
        accepted++;
      } else if (decision === 'HOLD') {
        hold++;
      } else {
        rejected++;
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        rejected++; // 404s are just rejected/skipped
      } else {
        console.error(`[Job] TMDB Error for movie ${movieId}:`, err.message);
        errors++;
        rejected++;
      }
    }
  }

  return { accepted, hold, rejected, errors };
};

let isRunning = false;

const runLatestMovieJob = async () => {
  if (isRunning) {
    console.log('[Job] Previous scheduler execution is still running. Skipping.');
    return;
  }

  isRunning = true;
  console.log('[Job] Scheduler execution started.');
  const startTime = Date.now();

  try {
    const latestMovie = await tmdbService.getLatestMovie();

    if (!latestMovie || !latestMovie.id) {
      console.warn('[Job] Invalid movie response from TMDB /movie/latest');
      return;
    }

    const latestMovieId = latestMovie.id;
    console.log(`[Job] Latest TMDB ID detected: ${latestMovieId}`);

    let lastCheckedMovieId = latestCache.getLastCheckedMovieId();

    if (!lastCheckedMovieId) {
      console.log(`[Job] First run. Seeding by scanning the last 10 movies...`);
      lastCheckedMovieId = latestMovieId - 10;
      latestCache.setLastCheckedMovieId(lastCheckedMovieId);
    }

    if (latestMovieId <= lastCheckedMovieId) {
      return;
    }

    let startId = lastCheckedMovieId + 1;
    let endId = latestMovieId;

    // Maximum per scheduler execution: 10 movie IDs.
    if (endId - startId + 1 > 10) {
      startId = endId - 9;
    }

    const idsToScan = [];
    for (let id = startId; id <= endId; id++) {
      idsToScan.push(id);
    }

    console.log(`[Job] Number of movies scanned: ${idsToScan.length}`);

    const { accepted, hold, rejected, errors } = await processBatch(idsToScan);

    latestCache.setLastCheckedMovieId(endId);

    const duration = Date.now() - startTime;
    console.log(`[Job] Execution time: ${duration}ms. Accepted: ${accepted}. Hold: ${hold}. Rejected: ${rejected}. TMDB errors: ${errors}.`);
    
  } catch (error) {
    console.error('[Job] Scheduler error:', error.message);
  } finally {
    isRunning = false;
  }
};

const startJob = () => {
  // Every 15 minutes
  cron.schedule('*/15 * * * *', runLatestMovieJob);
  console.log('[Job] Scheduled tmdbLatestMovie to run every 15 minutes.');

  runLatestMovieJob();
};

module.exports = { startJob, runLatestMovieJob };
