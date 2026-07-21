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
    strict: process.env.STRICT_QUALITY_CHECK !== 'false' // default to true (strict mode) unless set to 'false'
  }
};
