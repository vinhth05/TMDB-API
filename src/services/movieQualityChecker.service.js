class MovieQualityCheckerService {
  constructor() {
    this.SPAM_KEYWORDS = ['test', 'sample', 'unknown', 'untitled', 'xxx'];
  }

  evaluate(movie) {
    if (!this.isValid(movie)) {
      return { decision: 'REJECT', score: 0 };
    }

    let score = 0;

    // Positive Score Rules
    if (this.hasPoster(movie)) score += 20;
    if (this.hasGoodOverview(movie)) score += 20;
    if (this.hasReleaseDate(movie)) score += 15;
    if (this.hasGenre(movie)) score += 10;
    if (this.hasCast(movie)) score += 10;
    if (this.hasHighPopularity(movie)) score += 10;
    if (this.hasGoodVoteCount(movie)) score += 10;
    if (this.hasImdbId(movie)) score += 5;

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

  isValid(movie) {
    if (!movie) return false;

    // Reject rules
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

    return true;
  }

  hasPoster(movie) {
    return !!movie.poster_path;
  }

  hasGoodOverview(movie) {
    return !!(movie.overview && movie.overview.trim().length > 50);
  }

  hasReleaseDate(movie) {
    return !!movie.release_date;
  }

  hasGenre(movie) {
    return !!(movie.genres && movie.genres.length > 0);
  }

  hasCast(movie) {
    return !!(movie.credits && movie.credits.cast && movie.credits.cast.length > 0);
  }

  hasHighPopularity(movie) {
    return !!(movie.popularity && movie.popularity > 5);
  }

  hasGoodVoteCount(movie) {
    return !!(movie.vote_count && movie.vote_count > 10);
  }

  hasImdbId(movie) {
    return !!(movie.imdb_id || (movie.external_ids && movie.external_ids.imdb_id));
  }
}

module.exports = new MovieQualityCheckerService();
