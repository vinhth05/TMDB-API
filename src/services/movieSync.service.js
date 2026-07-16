const tmdbClient = require('../config/tmdbClient');
const config = require('../config/config');
const movieQualityChecker = require('./movieQualityChecker.service');
const normalizeData = require('../utils/normalizeData');

class MovieSyncService {
  /**
   * Fetches a movie by ID directly from TMDB without caching in RAM.
   * This is crucial to avoid memory leaks during large exports.
   */
  async fetchMovieRaw(tmdbId) {
    const appendList = 'credits,videos,images,release_dates,external_ids';
    const langParam = config.tmdb.defaultLanguage;
    
    try {
      const response = await tmdbClient.get(`/movie/${tmdbId}`, {
        params: { language: langParam, append_to_response: appendList }
      });
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null; // Movie not found, safely ignore
      }
      throw error;
    }
  }

  /**
   * Processes a single movie: fetches it, evaluates quality, and normalizes it.
   * Returns normalized movie if ACCEPT, otherwise null.
   */
  async processMovie(tmdbId) {
    const rawMovie = await this.fetchMovieRaw(tmdbId);
    if (!rawMovie) return null;

    const quality = movieQualityChecker.evaluate(rawMovie);
    
    if (quality.decision !== 'ACCEPT') {
      return null;
    }

    // Normalize
    const normalized = normalizeData.normalizeSyncMovie(rawMovie, quality.score, quality.decision);
    return normalized;
  }

  /**
   * Processes an array of movie IDs with a strict concurrency limit (default 2).
   */
  async processMoviesConcurrently(movieIds, maxConcurrency = 2) {
    const results = [];
    
    // Process in chunks to respect concurrency limit
    for (let i = 0; i < movieIds.length; i += maxConcurrency) {
      const chunk = movieIds.slice(i, i + maxConcurrency);
      const promises = chunk.map(id => this.processMovie(id).catch(err => {
        console.error(`Error processing movie ${id}:`, err.message);
        return null; // Don't crash the whole batch on one error
      }));
      
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults.filter(m => m !== null));
    }
    
    return results;
  }

  /**
   * Fetches recently updated movie IDs.
   * Can pass startDate and endDate (YYYY-MM-DD) to fetch changes within a specific timeframe (max 14 days apart per TMDB docs).
   */
  async getUpdatedMovieIds(page = 1, startDate = null, endDate = null) {
    try {
      const params = { page };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await tmdbClient.get('/movie/changes', { params });
      if (!response.data || !response.data.results) return [];
      return response.data.results.map(r => r.id);
    } catch (error) {
      console.error('Error fetching updated movies:', error.message);
      return [];
    }
  }
}

module.exports = new MovieSyncService();
