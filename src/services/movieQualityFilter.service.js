const config = require('../config/config');

class MovieQualityFilterService {
  isValidMovie(movie, options = {}) {
    if (!movie) return false;
    if (!movie.title && !movie.original_title) return false;
    if (movie.adult === true) return false;

    const isStrict = options.strict !== undefined 
      ? options.strict 
      : (config.qualityCheck && config.qualityCheck.strict !== undefined ? config.qualityCheck.strict : true);
    if (!isStrict) {
      return true;
    }

    if (!movie.poster_path || !movie.backdrop_path) return false;
    if (!movie.overview || movie.overview.trim() === '') return false;
    if (movie.vote_count < 5) return false;
    if (movie.popularity < 2) return false;

    // Filter out shorts or episodes (if runtime is available, it must be >= 40 mins)
    if (movie.runtime && movie.runtime > 0 && movie.runtime < 40) return false;

    let score = 0;
    
    if (movie.poster_path) score += 20;
    if (movie.overview && movie.overview.trim() !== '') score += 20;
    if (movie.vote_count >= 10) score += 20;
    if (movie.popularity >= 5) score += 20;
    if (movie.release_date && movie.release_date.trim() !== '') score += 20;

    return score >= 60;
  }
}

module.exports = new MovieQualityFilterService();
