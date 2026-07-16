const tmdbExportStream = require('../services/tmdbExportStream.service');
const movieSyncService = require('../services/movieSync.service');
const tmdbClient = require('../config/tmdbClient');

const exportMovies = async (req, res, next) => {
  try {
    const cursor = parseInt(req.query.cursor || '0', 10);
    const limit = parseInt(req.query.limit || '20', 10);

    const streamResult = await tmdbExportStream.getMovieIds(cursor, limit);
    const processedMovies = await movieSyncService.processMoviesConcurrently(streamResult.ids, 2);

    res.status(200).json({
      cursor,
      nextCursor: cursor + streamResult.totalRead,
      limit,
      hasMore: streamResult.hasMore,
      movies: processedMovies
    });
  } catch (error) {
    next(error);
  }
};

const latestMovies = async (req, res, next) => {
  try {
    const response = await tmdbClient.get('/movie/latest');
    const latestId = response.data.id;
    
    // We fetch a batch backwards from the latest ID to find ACCEPT movies, 
    // since /movie/latest only returns one movie and it might be rejected.
    // For simplicity and since the prompt asks for "Newest ACCEPT movies", 
    // we will check a few recent IDs.
    const recentIds = [];
    for (let i = 0; i < 10; i++) {
      if (latestId - i > 0) recentIds.push(latestId - i);
    }
    
    const processedMovies = await movieSyncService.processMoviesConcurrently(recentIds, 2);
    
    res.status(200).json({
      success: true,
      movies: processedMovies
    });
  } catch (error) {
    next(error);
  }
};

const updatedMovies = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const startDate = req.query.startDate || null; // format: YYYY-MM-DD
    const endDate = req.query.endDate || null; // format: YYYY-MM-DD
    
    const updatedIds = await movieSyncService.getUpdatedMovieIds(page, startDate, endDate);
    
    // Limit to 20 for performance in a single API call
    const limitedIds = updatedIds.slice(0, 20);
    const processedMovies = await movieSyncService.processMoviesConcurrently(limitedIds, 2);
    
    res.status(200).json({
      success: true,
      page,
      hasMore: updatedIds.length > 20,
      movies: processedMovies
    });
  } catch (error) {
    next(error);
  }
};

const movieDetail = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const processedMovie = await movieSyncService.processMovie(tmdbId);
    
    if (!processedMovie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found or rejected by quality checker'
      });
    }
    
    res.status(200).json({
      success: true,
      data: processedMovie
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportMovies,
  latestMovies,
  updatedMovies,
  movieDetail
};
