const tmdbClient = require('../config/tmdbClient');
const cache = require('../utils/nodeCache');
const config = require('../config/config');

const getLanguageParam = (language) => {
  return language ? language : config.tmdb.defaultLanguage;
};

const getTtl = (type) => {
  if (type === 'search') return config.cache.searchTtl;
  if (type === 'reference') return config.cache.referenceTtl;
  if (type === 'movie') return config.cache.movieTtl;
  return config.cache.ttl; // default
};

// =======================
// SEARCH ENDPOINTS
// =======================
const searchMovies = async (keyword, page = 1, params = {}) => {
  const language = getLanguageParam(params.language);
  const cacheKey = `search_movie_${keyword}_${page}_${language}_${params.region || ''}_${params.includeAdult || false}_${params.year || ''}_${params.primaryReleaseYear || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const response = await tmdbClient.get('/search/movie', {
    params: {
      query: keyword,
      page,
      language,
      region: params.region,
      include_adult: params.includeAdult,
      year: params.year,
      primary_release_year: params.primaryReleaseYear
    },
  });

  cache.set(cacheKey, response.data, getTtl('search'));
  return response.data;
};

const searchKeywords = async (query, page = 1) => {
  const cacheKey = `search_keyword_${query}_${page}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const response = await tmdbClient.get('/search/keyword', { params: { query, page } });
  cache.set(cacheKey, response.data, getTtl('search'));
  return response.data;
};

const searchPeople = async (query, page = 1, language = null, includeAdult = false) => {
  const langParam = getLanguageParam(language);
  const cacheKey = `search_person_${query}_${page}_${langParam}_${includeAdult}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const response = await tmdbClient.get('/search/person', {
    params: { query, page, language: langParam, include_adult: includeAdult }
  });
  cache.set(cacheKey, response.data, getTtl('search'));
  return response.data;
};

// =======================
// MOVIE ENDPOINTS
// =======================
const getMoviePreview = async (tmdbId, language = null) => {
  const langParam = getLanguageParam(language);
  const cacheKey = `preview_${tmdbId}_${langParam}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const appendList = 'credits,videos,images,keywords,similar,release_dates,translations,external_ids,reviews,watch/providers,alternative_titles,changes';
  const response = await tmdbClient.get(`/movie/${tmdbId}`, {
    params: {
      language: langParam,
      append_to_response: appendList,
      include_image_language: `${langParam.split('-')[0]},en,null`
    }
  });

  let movieData = response.data;

  if (langParam === config.tmdb.defaultLanguage && !movieData.overview) {
    try {
      const fallbackRes = await tmdbClient.get(`/movie/${tmdbId}`, { params: { language: config.tmdb.fallbackLanguage } });
      movieData.overview = fallbackRes.data.overview;
      if (!movieData.tagline) movieData.tagline = fallbackRes.data.tagline;
    } catch (e) {
      console.warn(`Fallback to ${config.tmdb.fallbackLanguage} failed for movie ${tmdbId}`);
    }
  }

  cache.set(cacheKey, movieData, getTtl('movie'));
  return movieData;
};

const getMovieBundle = async (tmdbId, language = null) => {
  const langParam = getLanguageParam(language);
  const cacheKey = `bundle_${tmdbId}_${langParam}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const appendList = 'credits,videos,images,keywords,release_dates,translations,alternative_titles,external_ids';
  const response = await tmdbClient.get(`/movie/${tmdbId}`, {
    params: {
      language: langParam,
      append_to_response: appendList,
      include_image_language: `${langParam.split('-')[0]},en,null`
    }
  });

  let movieData = response.data;

  // Fallback for overview and tagline
  if (langParam === config.tmdb.defaultLanguage && (!movieData.overview || !movieData.title)) {
    try {
      const fallbackRes = await tmdbClient.get(`/movie/${tmdbId}`, { params: { language: config.tmdb.fallbackLanguage } });
      if (!movieData.overview) movieData.overview = fallbackRes.data.overview;
      if (!movieData.tagline) movieData.tagline = fallbackRes.data.tagline;
      // We shouldn't fallback title completely unless it's blank, TMDB usually provides it, but just in case
      if (!movieData.title) movieData.title = fallbackRes.data.title;
    } catch (e) {
      console.warn(`Fallback to ${config.tmdb.fallbackLanguage} failed for movie ${tmdbId}`);
    }
  }

  // Also include a cache hit meta field if we want, but cache wrapper usually handles it
  cache.set(cacheKey, movieData, getTtl('movie'));
  return movieData;
};

const getMovieCredits = async (tmdbId, language = null) => {
  const cacheKey = `credits_${tmdbId}_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/credits`, { params: { language: getLanguageParam(language) } });
  cache.set(cacheKey, response.data, getTtl('reference')); // Credits don't change very often
  return response.data;
};

const getMovieVideos = async (tmdbId, language = null) => {
  const cacheKey = `videos_${tmdbId}_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/videos`, { params: { language: getLanguageParam(language) } });
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getMovieImages = async (tmdbId, language = null) => {
  const cacheKey = `images_${tmdbId}_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/images`, {
    params: { language: getLanguageParam(language), include_image_language: `${getLanguageParam(language).split('-')[0]},en,null` }
  });
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getMovieKeywords = async (tmdbId) => {
  const cacheKey = `keywords_${tmdbId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/keywords`);
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getReleaseDates = async (tmdbId) => {
  const cacheKey = `release_dates_${tmdbId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/release_dates`);
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getTranslations = async (tmdbId) => {
  const cacheKey = `translations_${tmdbId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/translations`);
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getAlternativeTitles = async (tmdbId, country = null) => {
  const cacheKey = `alt_titles_${tmdbId}_${country}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/alternative_titles`, { params: { country } });
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getExternalIds = async (tmdbId) => {
  const cacheKey = `ext_ids_${tmdbId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/external_ids`);
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getSimilarMovies = async (tmdbId, language = null, page = 1) => {
  const cacheKey = `similar_${tmdbId}_${language}_${page}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/similar`, { params: { language: getLanguageParam(language), page } });
  cache.set(cacheKey, response.data, getTtl('movie'));
  return response.data;
};

const getRecommendations = async (tmdbId, language = null, page = 1) => {
  const cacheKey = `recommendations_${tmdbId}_${language}_${page}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/movie/${tmdbId}/recommendations`, { params: { language: getLanguageParam(language), page } });
  cache.set(cacheKey, response.data, getTtl('movie'));
  return response.data;
};

// =======================
// DISCOVER / LIST ENDPOINTS
// =======================
const getLatestMovie = async () => {
  // /movie/latest only returns one movie from TMDB
  const response = await tmdbClient.get('/movie/latest');
  return response.data;
};

const discoverMovies = async (params = {}) => {
  const cacheKey = `discover_movies_${JSON.stringify(params)}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get('/discover/movie', { params: { ...params, language: getLanguageParam(params.language) } });
  cache.set(cacheKey, response.data, getTtl('search'));
  return response.data;
};

const getMovieList = async (type, page = 1, language = null, region = null, timeWindow = 'day') => {
  const cacheKey = `list_${type}_${page}_${language}_${region}_${timeWindow}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const validTypes = ['popular', 'upcoming', 'now_playing', 'top_rated', 'trending'];
  if (!validTypes.includes(type)) {
     const err = new Error('Invalid list type');
     err.code = 400;
     throw err;
  }

  let endpoint = `/movie/${type}`;
  if (type === 'trending') {
    endpoint = `/trending/movie/${timeWindow}`;
  }

  const response = await tmdbClient.get(endpoint, {
    params: { page, language: getLanguageParam(language), region }
  });

  cache.set(cacheKey, response.data, getTtl('search'));
  return response.data;
};

// =======================
// PERSON ENDPOINTS
// =======================
const getPersonDetail = async (personId, language = null) => {
  const cacheKey = `person_${personId}_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/person/${personId}`, {
    params: { language: getLanguageParam(language), append_to_response: 'combined_credits' }
  });
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getPersonMovieCredits = async (personId, language = null) => {
  const cacheKey = `person_credits_${personId}_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/person/${personId}/movie_credits`, { params: { language: getLanguageParam(language) } });
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getPersonImages = async (personId) => {
  const cacheKey = `person_images_${personId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/person/${personId}/images`);
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

// =======================
// REFERENCE ENDPOINTS
// =======================
const getGenres = async (language = null) => {
  const cacheKey = `genres_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/genre/movie/list`, { params: { language: getLanguageParam(language) } });
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const getTmdbConfiguration = async () => {
  const cacheKey = `tmdb_configuration`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get('/configuration');
  cache.set(cacheKey, response.data, getTtl('reference'));
  return response.data;
};

const findByExternalId = async (externalId, source, language = null) => {
  const cacheKey = `find_${externalId}_${source}_${language}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const response = await tmdbClient.get(`/find/${externalId}`, {
    params: { external_source: source, language: getLanguageParam(language) }
  });
  cache.set(cacheKey, response.data, getTtl('search'));
  return response.data;
};

module.exports = {
  searchMovies,
  searchKeywords,
  searchPeople,
  getMoviePreview,
  getMovieBundle,
  getMovieCredits,
  getMovieVideos,
  getMovieImages,
  getMovieKeywords,
  getReleaseDates,
  getTranslations,
  getAlternativeTitles,
  getExternalIds,
  getSimilarMovies,
  getRecommendations,
  getLatestMovie,
  discoverMovies,
  getMovieList,
  getPersonDetail,
  getPersonMovieCredits,
  getPersonImages,
  getGenres,
  getTmdbConfiguration,
  findByExternalId
};
