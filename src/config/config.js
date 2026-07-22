const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '9001', 10),
  tmdb: {
    baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    imageBase: process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p',
    imageSize: process.env.TMDB_IMAGE_SIZE || 'original',
    defaultLanguage: process.env.TMDB_DEFAULT_LANGUAGE || 'vi-VN',
    fallbackLanguage: process.env.TMDB_FALLBACK_LANGUAGE || 'en-US',
    timeout: 10000,
    token: process.env.TMDB_TOKEN,
    exportBaseUrl: 'http://files.tmdb.org/p/exports',
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
    searchTtl: parseInt(process.env.CACHE_SEARCH_TTL || '600', 10),
    movieTtl: parseInt(process.env.CACHE_MOVIE_TTL || '3600', 10),
    referenceTtl: parseInt(process.env.CACHE_REFERENCE_TTL || '86400', 10)
  },
  security: {
    apiKey: process.env.API_KEY || 'lorafilm-secret-key'
  },
  qualityCheck: {
    strict: process.env.STRICT_QUALITY_CHECK !== 'false', // default to true (strict mode) unless set to 'false'
    hardFilter: {
      minRuntime: parseInt(process.env.FILTER_MIN_RUNTIME || '45', 10),
      minOverviewLength: parseInt(process.env.FILTER_MIN_OVERVIEW_LENGTH || '0', 10),
      allowedStatuses: (process.env.FILTER_ALLOWED_STATUSES || 'Released,Upcoming').split(','),
      requirePoster: process.env.FILTER_REQUIRE_POSTER !== 'false',
      requireBackdrop: process.env.FILTER_REQUIRE_BACKDROP === 'true',
      requireGenres: process.env.FILTER_REQUIRE_GENRES === 'true',
      requireProductionCompany: process.env.FILTER_REQUIRE_PRODUCTION_COMPANY === 'true',
      requireOriginalLanguage: process.env.FILTER_REQUIRE_ORIGINAL_LANGUAGE === 'true',
      spamKeywords: (process.env.FILTER_SPAM_KEYWORDS || 'test,sample,unknown,untitled,xxx,sex,erotic,erotica,softcore,pink film,adult content,極楽,情事,花びら,ぬくもり,형수,처제,도우미,야한,무삭제,섹스,마님').split(',')
    },
    thresholds: {
      autoApproved: parseInt(process.env.SCORE_THRESHOLD_AUTO_APPROVED || '80', 10),
      needsReview: parseInt(process.env.SCORE_THRESHOLD_NEEDS_REVIEW || '60', 10)
    },
    weights: {
      baseScore: parseInt(process.env.SCORE_WEIGHT_BASE || '35', 10),
      imdbId: parseInt(process.env.SCORE_WEIGHT_IMDB || '10', 10),
      trailer: parseInt(process.env.SCORE_WEIGHT_TRAILER || '10', 10),
      director: parseInt(process.env.SCORE_WEIGHT_DIRECTOR || '10', 10),
      cast: parseInt(process.env.SCORE_WEIGHT_CAST || '10', 10),
      castMinCount: parseInt(process.env.SCORE_MIN_CAST_COUNT || '1', 10),
      productionCompany: parseInt(process.env.SCORE_WEIGHT_PRODUCTION_COMPANY || '5', 10),
      localization: parseInt(process.env.SCORE_WEIGHT_LOCALIZATION || '10', 10),
      popularityMin: parseFloat(process.env.SCORE_MIN_POPULARITY || '5.0'),
      popularityBonus: parseInt(process.env.SCORE_WEIGHT_POPULARITY || '5', 10),
      voteCountMin: parseInt(process.env.SCORE_MIN_VOTE_COUNT || '50', 10),
      voteCountBonus: parseInt(process.env.SCORE_WEIGHT_VOTE_COUNT || '10', 10)
    }
  }
};
