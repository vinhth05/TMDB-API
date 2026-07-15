const tmdbService = require('./tmdbService');
const nodeCache = require('../utils/nodeCache');

class TmdbLatestMovieCacheService {
  constructor() {
    this.movies = [];
    this.maxLimit = 20;
    this.lastCheckedMovieId = null;
  }

  addMovie(movie) {
    if (this.exists(movie.tmdbId)) return;

    movie.source = 'VERIFIED';
    this.movies.push(movie);
    
    this.movies.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.tmdbId - a.tmdbId;
    });
    
    if (this.movies.length > this.maxLimit) {
      this.movies = this.movies.slice(0, this.maxLimit);
    }
  }

  getMovies() {
    return this.movies;
  }

  exists(movieId) {
    return this.movies.some(m => m.tmdbId === movieId);
  }

  getLatestMovies(limit = 10) {
    const validLimit = Math.min(Math.max(1, limit), this.maxLimit);
    return this.movies.slice(0, validLimit);
  }

  clear() {
    this.movies = [];
    this.lastCheckedMovieId = null;
  }

  setLastCheckedMovieId(id) {
    this.lastCheckedMovieId = id;
  }

  getLastCheckedMovieId() {
    return this.lastCheckedMovieId;
  }

  async fetchFutureMoviesFallback() {
    const cacheKey = 'future_fallback_movies';
    let futureMovies = nodeCache.get(cacheKey);

    if (!futureMovies) {
      try {
        console.log('[Future Fallback] Refreshing future movies cache...');
        
        const today = new Date();
        const futureDate = new Date();
        futureDate.setFullYear(today.getFullYear() + 2);
        const formatDate = (date) => date.toISOString().split('T')[0];

        const response = await tmdbService.discoverMovies({
          'primary_release_date.gte': formatDate(today),
          'primary_release_date.lte': formatDate(futureDate),
          sortBy: 'popularity.desc',
          page: 1
        });
        
        futureMovies = (response.results || []).map(m => ({
          tmdbId: m.id,
          title: m.title || m.original_title,
          originalTitle: m.original_title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          overview: m.overview,
          releaseDate: m.release_date,
          popularity: m.popularity,
          voteAverage: m.vote_average,
          qualityScore: null,
          source: 'FUTURE'
        }));
        
        // TTL 12 hours (43200 seconds)
        nodeCache.set(cacheKey, futureMovies, 43200);
      } catch (error) {
        console.error('[Future Fallback] Error fetching future movies:', error.message);
        futureMovies = [];
      }
    }
    
    return futureMovies || [];
  }

  async getMergedLatestTop10() {
    // Standardize verified movies format
    const verified = [...this.movies].map(m => ({
      tmdbId: m.tmdbId,
      title: m.title,
      originalTitle: m.originalTitle || m.title,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      overview: m.overview,
      releaseDate: m.releaseDate,
      popularity: m.popularity,
      voteAverage: m.voteAverage,
      qualityScore: m.score,
      source: 'VERIFIED'
    }));

    let future = [];
    if (verified.length < this.maxLimit) {
      future = await this.fetchFutureMoviesFallback();
    }

    const merged = [...verified];
    
    const verifiedIds = new Set(verified.map(m => m.tmdbId));

    for (const um of future) {
      if (merged.length >= this.maxLimit) break;
      if (!verifiedIds.has(um.tmdbId)) {
        merged.push(um);
        verifiedIds.add(um.tmdbId);
      }
    }

    const finalMerged = merged.slice(0, this.maxLimit);

    // Xếp theo releaseDate từ tương lai xa nhất tới hiện tại (DESC)
    finalMerged.sort((a, b) => {
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });

    return finalMerged;
  }
}

module.exports = new TmdbLatestMovieCacheService();
