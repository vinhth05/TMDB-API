const config = require('../config/config');

class MovieQualityCheckerService {
  /**
   * Evaluates a raw or bundle TMDB movie object against Hard Filter rules and Quality Scoring.
   * Returns a complete approval payload.
   * 
   * @param {Object} movie TMDB raw or bundle movie object
   * @param {Object} options Options override (e.g. { strict: true })
   * @returns {Object} Evaluation result { approved, approvalStatus, qualityScore, reasons, decision, score }
   */
  evaluate(movie, options = {}) {
    const hardConfig = config.qualityCheck.hardFilter;
    const thresholdConfig = config.qualityCheck.thresholds;
    const weightConfig = config.qualityCheck.weights;

    const reasons = [];

    if (!movie) {
      reasons.push('Movie object is null or undefined');
      return this._buildResult(false, 'REJECTED', 0, reasons);
    }

    // ==========================================
    // 1. HARD FILTER (Gatekeeper)
    // ==========================================
    if (!movie.id) {
      reasons.push('Missing TMDB ID');
    }

    if (!movie.title && !movie.original_title) {
      reasons.push('Missing movie title');
    }

    if (movie.adult === true) {
      reasons.push('Adult content (adult: true)');
    }

    // Spam keyword check
    const titleToCheck = (movie.title || movie.original_title || '').toLowerCase();
    const spamKeywords = hardConfig.spamKeywords || [];
    for (const keyword of spamKeywords) {
      if (keyword && titleToCheck.includes(keyword.toLowerCase())) {
        reasons.push(`Title contains blacklisted keyword '${keyword}'`);
        break;
      }
    }

    // Status check
    if (movie.status && hardConfig.allowedStatuses && hardConfig.allowedStatuses.length > 0) {
      if (!hardConfig.allowedStatuses.includes(movie.status)) {
        reasons.push(`Invalid status '${movie.status}' (Allowed: ${hardConfig.allowedStatuses.join(', ')})`);
      }
    }

    // Release date check
    if (hardConfig.requireReleaseDate && !movie.release_date) {
      reasons.push('Missing release date');
    }

    // Runtime check (if runtime is provided in details)
    if (movie.runtime !== undefined && movie.runtime !== null) {
      if (movie.runtime < hardConfig.minRuntime) {
        reasons.push(`Runtime too short (${movie.runtime} mins < ${hardConfig.minRuntime} mins minimum)`);
      }
    }

    // Image checks
    if (hardConfig.requirePoster && !movie.poster_path) {
      reasons.push('Missing poster image');
    }

    if (hardConfig.requireBackdrop && !movie.backdrop_path) {
      reasons.push('Missing backdrop image');
    }

    // Overview check
    const overviewText = movie.overview ? movie.overview.trim() : '';
    if (overviewText.length < hardConfig.minOverviewLength) {
      reasons.push(`Overview missing or too short (${overviewText.length} chars < ${hardConfig.minOverviewLength} chars minimum)`);
    }

    // Genres check
    const genresList = movie.genres || (movie.genre_ids ? movie.genre_ids : []);
    if (hardConfig.requireGenres && (!genresList || genresList.length === 0)) {
      reasons.push('No genres specified');
    }

    // Production companies check (if detail object)
    if (hardConfig.requireProductionCompany && movie.production_companies !== undefined) {
      if (!movie.production_companies || movie.production_companies.length === 0) {
        reasons.push('No production company specified');
      }
    }

    // Original language check
    if (hardConfig.requireOriginalLanguage && !movie.original_language) {
      reasons.push('Missing original language');
    }

    // If any Hard Filter rule failed -> REJECTED immediately
    if (reasons.length > 0) {
      this._logEvaluation(movie.id, movie.title || movie.original_title, 'REJECTED', 0, reasons);
      return this._buildResult(false, 'REJECTED', 0, reasons);
    }

    // ==========================================
    // 2. QUALITY SCORING (0 - 100)
    // ==========================================
    let score = weightConfig.baseScore || 35;

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
    if (this.hasVietnameseLocalization(movie)) score += weightConfig.localization || 10;

    // Cap score at 100
    score = Math.min(score, 100);

    // ==========================================
    // 3. APPROVAL DECISION
    // ==========================================
    let approvalStatus = 'REJECTED';
    let approved = false;

    if (score >= thresholdConfig.autoApproved) {
      approvalStatus = 'AUTO_APPROVED';
      approved = true;
    } else if (score >= thresholdConfig.needsReview) {
      approvalStatus = 'NEEDS_REVIEW';
      approved = false; // Needs manual review before being synced/approved
      reasons.push(`Quality score (${score}) requires manual review (${thresholdConfig.needsReview}-${thresholdConfig.autoApproved - 1})`);
    } else {
      approvalStatus = 'REJECTED';
      approved = false;
      reasons.push(`Quality score (${score}) is below minimum threshold (${thresholdConfig.needsReview})`);
    }

    this._logEvaluation(movie.id, movie.title || movie.original_title, approvalStatus, score, reasons);

    return this._buildResult(approved, approvalStatus, score, reasons);
  }

  /**
   * Helper to format evaluation result object for both new and legacy consumers.
   */
  _buildResult(approved, approvalStatus, qualityScore, reasons) {
    let decision = 'REJECT';
    if (qualityScore >= 70 || approvalStatus === 'AUTO_APPROVED') {
      decision = 'ACCEPT';
    } else if (qualityScore >= 40 || approvalStatus === 'NEEDS_REVIEW') {
      decision = 'HOLD';
    }

    return {
      approved,
      approvalStatus,
      qualityScore,
      reasons,
      // Backwards compatibility fields
      decision,
      score: qualityScore
    };
  }

  /**
   * Structured logger for evaluation results.
   */
  _logEvaluation(tmdbId, title, status, score, reasons) {
    const timestamp = new Date().toISOString();
    const reasonText = reasons.length > 0 ? ` - Reasons: [${reasons.join(' | ')}]` : '';
    console.log(`[QualityChecker] ${timestamp} | TMDB ID: ${tmdbId} | Title: "${title || 'N/A'}" | Status: ${status} | Score: ${score}${reasonText}`);
  }

  // ==========================================
  // HELPER EVALUATION METHODS
  // ==========================================
  hasBackdrop(movie) { return !!movie.backdrop_path; }
  hasGoodOverview(movie) { return !!(movie.overview && movie.overview.trim().length >= (config.qualityCheck.hardFilter.minOverviewLength || 50)); }
  hasGenres(movie) { 
    const list = movie.genres || movie.genre_ids;
    return !!(list && list.length > 0); 
  }
  hasCast(movie) { 
    const minCast = config.qualityCheck.weights.castMinCount || 5;
    return !!(movie.credits && movie.credits.cast && movie.credits.cast.length >= minCast); 
  }
  hasDirector(movie) { 
    return !!(movie.credits && movie.credits.crew && movie.credits.crew.some(c => c.job === 'Director')); 
  }
  hasProductionCompany(movie) { 
    return !!(movie.production_companies && movie.production_companies.length > 0); 
  }
  hasImdbId(movie) { 
    return !!(movie.imdb_id || (movie.external_ids && movie.external_ids.imdb_id)); 
  }
  hasTrailer(movie) { 
    return !!(movie.videos && movie.videos.results && movie.videos.results.some(v => v.type === 'Trailer')); 
  }
  hasVietnameseLocalization(movie) {
    if (movie.translations && movie.translations.translations) {
      return movie.translations.translations.some(t => t.iso_639_1 === 'vi');
    }
    return false;
  }
  hasPopularity(movie) { 
    const minPop = config.qualityCheck.weights.popularityMin || 5.0;
    return !!(movie.popularity && movie.popularity >= minPop); 
  }
  hasVoteCount(movie) { 
    const minVotes = config.qualityCheck.weights.voteCountMin || 50;
    return !!(movie.vote_count && movie.vote_count >= minVotes); 
  }
}

module.exports = new MovieQualityCheckerService();
