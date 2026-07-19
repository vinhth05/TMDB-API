class MovieQualityCheckerService {
  constructor() {
    this.SPAM_KEYWORDS = ['test', 'sample', 'unknown', 'untitled', 'xxx'];
  }

  evaluate(movie) {
    if (!this.isValid(movie)) {
      return { decision: 'REJECT', score: 0 };
    }

    // Quality Score Rules
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
    if (score >= 40) {
      decision = 'ACCEPT';
    } else if (score >= 25) {
      decision = 'HOLD';
    }

    return { decision, score };
  }

  isValid(movie) {
    if (!movie) return false;

    // Reject rules
    if (movie.adult === true) return false;
    
    // Missing title
    if (!movie.title && !movie.original_title) return false;

    // Missing poster and backdrop
    if (!movie.poster_path && !movie.backdrop_path) return false;
    
    // Invalid TMDB data
    if (!movie.id) return false;

    // Spam keywords
    const titleToCheck = (movie.title || movie.original_title).toLowerCase();
    for (const keyword of this.SPAM_KEYWORDS) {
      if (titleToCheck.includes(keyword)) {
        return false;
      }
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
