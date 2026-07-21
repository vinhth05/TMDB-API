const tmdbExportStream = require('../services/tmdbExportStream.service');
const movieSyncService = require('../services/movieSync.service');
const tmdbClient = require('../config/tmdbClient');

const downloadExportFile = async (req, res, next) => {
  try {
    console.log('[TMDB Export API] Received request to download TMDB export file');
    await tmdbExportStream.downloadExportFile();
    console.log('[TMDB Export API] Download export file finished successfully');
    res.status(200).json({
      success: true,
      message: 'Export file downloaded and ready for streaming'
    });
  } catch (error) {
    console.error('[TMDB Export API] Error downloading export file:', error.message);
    next(error);
  }
};

const exportMovies = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const cursor = parseInt(req.query.cursor || '0', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const strictParam = req.query.strict;
    // Default export API to strict: false so caller gets all valid movies unless explicitly ?strict=true
    const isStrict = strictParam === 'true';

    console.log(`[TMDB Export API] Export movies request received - cursor: ${cursor}, limit: ${limit}, strict: ${isStrict}`);

    const streamResult = await tmdbExportStream.getMovieIds(cursor, limit);
    console.log(`[TMDB Export API] Read ${streamResult.ids.length} raw IDs from export (totalRead: ${streamResult.totalRead}, hasMore: ${streamResult.hasMore})`);

    const options = { strict: isStrict };
    const processedMovies = await movieSyncService.processMoviesConcurrently(streamResult.ids, 2, options);
    const elapsed = Date.now() - startTime;
    console.log(`[TMDB Export API] Processed ${processedMovies.length}/${streamResult.ids.length} valid movies in ${elapsed}ms (nextCursor: ${cursor + streamResult.totalRead})`);

    res.status(200).json({
      cursor,
      nextCursor: cursor + streamResult.totalRead,
      limit,
      hasMore: streamResult.hasMore,
      movies: processedMovies
    });
  } catch (error) {
    console.error('[TMDB Export API] Error in exportMovies endpoint:', error.message);
    if (error.message && error.message.includes('Local export file not found')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
};

const latestMovies = async (req, res, next) => {
  try {
    console.log('[TMDB Sync API] Received request for latest movies cache');
    const latestCache = require('../services/tmdbLatestMovieCache.service');
    const data = await latestCache.getMergedLatestTop10();
    console.log(`[TMDB Sync API] Returning ${data ? data.length : 0} latest movies from cache`);
    
    res.status(200).json({
      success: true,
      movies: data
    });
  } catch (error) {
    console.error('[TMDB Sync API] Error getting latest movies:', error.message);
    next(error);
  }
};

const updatedMovies = async (req, res, next) => {
  const startTime = Date.now();
  try {
    const page = parseInt(req.query.page || '1', 10);
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    
    console.log(`[TMDB Sync API] Received request for updated movies - page: ${page}, startDate: ${startDate}, endDate: ${endDate}`);

    const updatedIds = await movieSyncService.getUpdatedMovieIds(page, startDate, endDate);
    const limitedIds = updatedIds.slice(0, 20);
    console.log(`[TMDB Sync API] Found ${updatedIds.length} updated IDs (processing first ${limitedIds.length})`);

    const processedMovies = await movieSyncService.processMoviesConcurrently(limitedIds, 2);
    const elapsed = Date.now() - startTime;
    console.log(`[TMDB Sync API] Processed ${processedMovies.length} updated movies in ${elapsed}ms`);
    
    res.status(200).json({
      success: true,
      page,
      hasMore: updatedIds.length > 20,
      movies: processedMovies
    });
  } catch (error) {
    console.error('[TMDB Sync API] Error getting updated movies:', error.message);
    next(error);
  }
};

const movieDetail = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    console.log(`[TMDB Sync API] Received request for movie detail tmdbId: ${tmdbId}`);
    const processedMovie = await movieSyncService.processMovie(tmdbId);
    
    if (!processedMovie) {
      console.warn(`[TMDB Sync API] Movie tmdbId: ${tmdbId} not found or rejected by quality checker`);
      return res.status(404).json({
        success: false,
        message: 'Movie not found or rejected by quality checker'
      });
    }
    
    console.log(`[TMDB Sync API] Successfully fetched movie detail tmdbId: ${tmdbId} - title: "${processedMovie.title}"`);

    res.status(200).json({
      success: true,
      data: processedMovie
    });
  } catch (error) {
    console.error(`[TMDB Sync API] Error fetching movie detail for tmdbId ${req.params.tmdbId}:`, error.message);
    next(error);
  }
};

module.exports = {
  downloadExportFile,
  exportMovies,
  latestMovies,
  updatedMovies,
  movieDetail
};
