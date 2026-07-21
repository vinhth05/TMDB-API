const config = require('../config/config');

class MovieQualityCheckerService {
  constructor() {
    this.SPAM_KEYWORDS = [
      'test', 'sample', 'unknown', 'untitled', 'xxx', 'sex', 'erotic', 'erotica', 
      'softcore', 'pink film', 'adult content', '極楽', '情事', '花びら', 'ぬくもり',
      '형수', '처제', '도우미', '야한', '무삭제', '섹스', '마님'
    ];
  }

  evaluate(movie, options = {}) {
    const isStrict = options.strict !== undefined 
      ? options.strict 
      : (config.qualityCheck && config.qualityCheck.strict !== undefined ? config.qualityCheck.strict : true);

    if (!this.isValid(movie, isStrict)) {
      return { decision: 'REJECT', score: 0 };
    }

    if (!isStrict) {
      // In export mode, require poster_path and either backdrop_path or vote_count >= 5 to filter out obscure B-movies/erotica
      if (!movie.poster_path) {
        return { decision: 'REJECT', score: 0 };
      }
      if (!movie.backdrop_path && (movie.vote_count || 0) < 5) {
        return { decision: 'REJECT', score: 0 };
      }
      return { decision: 'ACCEPT', score: 100 };
    }

    // Quality Score Rules (Strict Mode)
    // Base score is 35 because isValid already guarantees: poster (15), runtime (10), releaseDate (10)
    let score = 35;

    if (this.hasBackdrop(movie)) score += 5;
    if (this.hasGoodOverview(movie)) score += 15;
    if (this.hasGenres(movie)) score += 5;
    if (this.hasCast(movie)) score += 10;
    if (this.hasDirector(movie)) score += 5;
    if (this.hasProductionCompany(movie)) score += 5;
    if (this.hasImdbId(movie)) score += 10;
    if (this.hasTrailer(movie)) score += 5;
    if (this.hasPopularity(movie)) score += 5;
    if (this.hasVoteCount(movie)) score += 5;

    // Maximum score 100
    score = Math.min(score, 100);

    // Decision Logic
    let decision = 'REJECT';
    if (score >= 70) {
      decision = 'ACCEPT';
    } else if (score >= 40) {
      decision = 'HOLD';
    }

    return { decision, score };
  }

  isValid(movie, isStrict = false) {
    if (!movie) return false;

    // Reject adult content
    if (movie.adult === true) return false;
    
    // Missing title
    if (!movie.title && !movie.original_title) return false;
    
    // Invalid TMDB data
    if (!movie.id) return false;

    // Spam keywords
    const titleToCheck = (movie.title || movie.original_title).toLowerCase();
    for (const keyword of this.SPAM_KEYWORDS) {
      if (titleToCheck.includes(keyword)) {
        return false;
      }
    }

    if (isStrict) {
      // Missing poster and backdrop required only in strict mode
      if (!movie.poster_path && !movie.backdrop_path) return false;
    }

    return true;
  }

  hasBackdrop(movie) { return !!movie.backdrop_path; }
  hasGoodOverview(movie) { return !!(movie.overview && movie.overview.trim().length > 100); }
  hasGenres(movie) { return !!(movie.genres && movie.genres.length > 0); }
  hasCast(movie) { return !!(movie.credits && movie.credits.cast && movie.credits.cast.length > 0); }
  hasDirector(movie) { return !!(movie.credits && movie.credits.crew && movie.credits.crew.some(c => c.job === 'Director')); }
  hasProductionCompany(movie) { return !!(movie.production_companies && movie.production_companies.length > 0); }
  hasImdbId(movie) { return !!(movie.imdb_id || (movie.external_ids && movie.external_ids.imdb_id)); }
  hasTrailer(movie) { return !!(movie.videos && movie.videos.results && movie.videos.results.some(v => v.type === 'Trailer')); }
  hasPopularity(movie) { return !!(movie.popularity && movie.popularity > 5); }
  hasVoteCount(movie) { return !!(movie.vote_count && movie.vote_count > 100); }
}

module.exports = new MovieQualityCheckerService();
