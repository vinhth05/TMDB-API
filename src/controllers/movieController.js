const tmdbService = require('../services/tmdbService');
const normalizeData = require('../utils/normalizeData');
const tmdbClient = require('../config/tmdbClient');
const cache = require('../utils/nodeCache');
const config = require('../config/config');
const latestCache = require('../services/tmdbLatestMovieCache.service');

const buildResponse = (data, meta = null, pagination = null) => {
  const response = {
    success: true,
    data,
  };
  if (pagination) response.pagination = pagination;
  if (meta) {
    response.meta = { ...meta, timestamp: new Date().toISOString() };
  } else {
    response.meta = { timestamp: new Date().toISOString() };
  }
  return response;
};

const getHealthStatus = async (req, res, next) => {
  try {
    let tmdbStatus = 'DISCONNECTED';
    try {
      await tmdbClient.get('/configuration');
      tmdbStatus = 'CONNECTED';
    } catch (error) {
      console.error('TMDB connection error:', error.message);
    }
    const cacheStatus = cache ? 'OK' : 'ERROR';

    res.status(200).json({
      status: 'UP',
      tmdb: tmdbStatus,
      cache: cacheStatus
    });
  } catch (error) {
    next(error);
  }
};

// =======================
// SEARCH ENDPOINTS
// =======================
const search = async (req, res, next) => {
  try {
    const { keyword, page, language, region, includeAdult, year, primaryReleaseYear } = req.query;
    const data = await tmdbService.searchMovies(keyword, page, { language, region, includeAdult, year, primaryReleaseYear });
    
    const formattedResults = data.results.map(normalizeData.normalizeMovieSearchItem);
    const pagination = normalizeData.normalizePagination(data);

    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

const searchSuggestions = async (req, res, next) => {
  try {
    const { keyword, page, language } = req.query;
    const data = await tmdbService.searchMovies(keyword, page, { language });
    
    const formattedResults = data.results.map(movie => ({
      tmdbId: movie.id,
      title: movie.title,
      releaseYear: movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : null,
      posterThumbnailUrl: normalizeData.getImageUrl(movie.poster_path, 'w185')
    }));

    res.status(200).json(buildResponse(formattedResults));
  } catch (error) {
    next(error);
  }
};

const searchKeywords = async (req, res, next) => {
  try {
    const { keyword, page } = req.query;
    const data = await tmdbService.searchKeywords(keyword, page);
    
    const formattedResults = data.results.map(k => ({
      tmdbKeywordId: k.id,
      name: k.name
    }));
    const pagination = normalizeData.normalizePagination(data);

    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

const personSearch = async (req, res, next) => {
  try {
    const { keyword, page, language, includeAdult } = req.query; // reusing keyword param
    const data = await tmdbService.searchPeople(keyword, page, language, includeAdult);
    
    const formattedResults = data.results.map(normalizeData.normalizePersonSearchItem);
    const pagination = normalizeData.normalizePagination(data);

    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

// =======================
// MOVIE ENDPOINTS
// =======================
const preview = async (req, res, next) => {
  try {
    const id = req.params.tmdbId || req.params.id; // Support both canonical and alias
    const { language } = req.query;
    const rawData = await tmdbService.getMoviePreview(id, language);
    const normalized = normalizeData.normalizeMoviePreview(rawData);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const bundle = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const { language } = req.query;
    const rawData = await tmdbService.getMovieBundle(tmdbId, language);
    const normalized = normalizeData.normalizeMovieBundle(rawData, language);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const credits = async (req, res, next) => {
  try {
    const id = req.params.tmdbId || req.params.id;
    const { language } = req.query;
    const rawData = await tmdbService.getMovieCredits(id, language);
    const normalized = normalizeData.normalizeCredits(rawData);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const videos = async (req, res, next) => {
  try {
    const id = req.params.tmdbId || req.params.id;
    const { language } = req.query;
    const rawData = await tmdbService.getMovieVideos(id, language);
    const normalized = normalizeData.normalizeVideos(rawData, language);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const images = async (req, res, next) => {
  try {
    const id = req.params.tmdbId || req.params.id;
    const { language } = req.query;
    const rawData = await tmdbService.getMovieImages(id, language);
    const normalized = normalizeData.normalizeImages(rawData, language);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const keywords = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const rawData = await tmdbService.getMovieKeywords(tmdbId);
    const normalized = normalizeData.normalizeKeywords(rawData);
    res.status(200).json(buildResponse({ keywords: normalized }));
  } catch (error) {
    next(error);
  }
};

const releaseDates = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const { preferredCountry } = req.query;
    const rawData = await tmdbService.getReleaseDates(tmdbId);
    const normalized = normalizeData.normalizeReleaseDates(rawData, preferredCountry || 'VN');
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const translations = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const rawData = await tmdbService.getTranslations(tmdbId);
    const normalized = normalizeData.normalizeTranslations(rawData);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const alternativeTitles = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const { country } = req.query;
    const rawData = await tmdbService.getAlternativeTitles(tmdbId, country);
    const normalized = normalizeData.normalizeAlternativeTitles(rawData);
    res.status(200).json(buildResponse({ titles: normalized }));
  } catch (error) {
    next(error);
  }
};

const externalIds = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const rawData = await tmdbService.getExternalIds(tmdbId);
    const normalized = normalizeData.normalizeExternalIds(rawData);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const similar = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const { language, page } = req.query;
    const data = await tmdbService.getSimilarMovies(tmdbId, language, page);
    const formattedResults = data.results.map(normalizeData.normalizeMovieSearchItem);
    const pagination = normalizeData.normalizePagination(data);
    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

const recommendations = async (req, res, next) => {
  try {
    const { tmdbId } = req.params;
    const { language, page } = req.query;
    const data = await tmdbService.getRecommendations(tmdbId, language, page);
    const formattedResults = data.results.map(normalizeData.normalizeMovieSearchItem);
    const pagination = normalizeData.normalizePagination(data);
    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

// =======================
// DISCOVER / LIST ENDPOINTS
// =======================
const getLatestTop20 = async (req, res, next) => {
  try {
    const data = await latestCache.getMergedLatestTop10();

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const getVerifiedMovies = async (req, res, next) => {
  try {
    let limit = 10;
    if (req.query.limit) {
      limit = parseInt(req.query.limit, 10);
      if (isNaN(limit) || limit < 1) limit = 10;
      if (limit > 20) limit = 20; // Requirement: Maximum 20
    }
    
    const data = latestCache.getLatestMovies(limit);

    // Follow existing project response format
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

const discover = async (req, res, next) => {
  try {
    const params = {
      page: req.query.page,
      language: req.query.language,
      region: req.query.region,
      sort_by: req.query.sortBy,
      with_genres: req.query.genreIds,
      without_genres: req.query.excludeGenreIds,
      'primary_release_date.gte': req.query.releaseDateFrom,
      'primary_release_date.lte': req.query.releaseDateTo,
      year: req.query.year,
      'vote_average.gte': req.query.minimumVoteAverage,
      'vote_count.gte': req.query.minimumVoteCount,
      with_original_language: req.query.originalLanguage,
      include_adult: req.query.includeAdult,
      include_video: req.query.includeVideo
    };

    // Remove undefined
    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const data = await tmdbService.discoverMovies(params);
    const formattedResults = data.results.map(normalizeData.normalizeMovieSearchItem);
    const pagination = normalizeData.normalizePagination(data);

    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

const movieList = async (req, res, next) => {
  try {
    const { page, language, region, timeWindow } = req.query;
    const type = req.path.split('/').pop().replace('-', '_'); // e.g. popular, top-rated -> top_rated
    
    const data = await tmdbService.getMovieList(type, page, language, region, timeWindow);
    const formattedResults = data.results.map(normalizeData.normalizeMovieSearchItem);
    const pagination = normalizeData.normalizePagination(data);

    res.status(200).json(buildResponse(formattedResults, null, pagination));
  } catch (error) {
    next(error);
  }
};

// =======================
// PERSON ENDPOINTS
// =======================
const person = async (req, res, next) => {
  try {
    const id = req.params.tmdbPersonId || req.params.id;
    const { language } = req.query;
    const data = await tmdbService.getPersonDetail(id, language);
    const normalized = normalizeData.normalizePersonDetail(data);
    res.status(200).json(buildResponse(normalized));
  } catch (error) {
    next(error);
  }
};

const personMovieCredits = async (req, res, next) => {
  try {
    const { tmdbPersonId } = req.params;
    const { language } = req.query;
    const data = await tmdbService.getPersonMovieCredits(tmdbPersonId, language);
    
    // Normalize simple list
    const cast = (data.cast || []).map(normalizeData.normalizeMovieSearchItem);
    const crew = (data.crew || []).map(normalizeData.normalizeMovieSearchItem);
    
    res.status(200).json(buildResponse({ cast, crew }));
  } catch (error) {
    next(error);
  }
};

const personImages = async (req, res, next) => {
  try {
    const { tmdbPersonId } = req.params;
    const data = await tmdbService.getPersonImages(tmdbPersonId);
    
    const profiles = (data.profiles || []).map(img => ({
      path: img.file_path,
      url: normalizeData.getImageUrl(img.file_path),
      width: img.width,
      height: img.height,
      aspectRatio: img.aspect_ratio,
      voteAverage: img.vote_average,
      voteCount: img.vote_count
    }));

    res.status(200).json(buildResponse({ profiles }));
  } catch (error) {
    next(error);
  }
};

// =======================
// REFERENCE ENDPOINTS
// =======================
const genres = async (req, res, next) => {
  try {
    const { language } = req.query;
    const data = await tmdbService.getGenres(language);
    
    // Convert to target format
    const formattedGenres = (data.genres || []).map(g => ({
      tmdbGenreId: g.id,
      name: g.name,
      mappingStatus: 'UNMAPPED' // As requested by prompt
    }));

    res.status(200).json(buildResponse({ genres: formattedGenres }));
  } catch (error) {
    next(error);
  }
};

const configuration = async (req, res, next) => {
  try {
    const data = await tmdbService.getTmdbConfiguration();
    const formattedConfig = {
      images: {
        secureBaseUrl: data.images.secure_base_url,
        posterSizes: data.images.poster_sizes,
        backdropSizes: data.images.backdrop_sizes,
        profileSizes: data.images.profile_sizes,
        logoSizes: data.images.logo_sizes
      },
      changeKeys: data.change_keys
    };
    res.status(200).json(buildResponse(formattedConfig));
  } catch (error) {
    next(error);
  }
};

const findByExternalId = async (req, res, next) => {
  try {
    const { externalId, source, language, mediaType } = req.query;
    const data = await tmdbService.findByExternalId(externalId, source, language);
    
    const response = {
      movies: (data.movie_results || []).map(normalizeData.normalizeMovieSearchItem),
      people: (data.person_results || []).map(normalizeData.normalizePersonSearchItem),
      tvShows: data.tv_results || [],
      tvEpisodes: data.tv_episode_results || [],
      tvSeasons: data.tv_season_results || []
    };

    // Filter by mediaType if provided
    if (mediaType === 'movie') {
       res.status(200).json(buildResponse({ movies: response.movies }));
       return;
    } else if (mediaType === 'person') {
       res.status(200).json(buildResponse({ people: response.people }));
       return;
    }

    res.status(200).json(buildResponse(response));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealthStatus,
  search,
  searchSuggestions,
  searchKeywords,
  personSearch,
  preview,
  bundle,
  credits,
  videos,
  images,
  keywords,
  releaseDates,
  translations,
  alternativeTitles,
  externalIds,
  similar,
  recommendations,
  getLatestTop20,
  getVerifiedMovies,
  discover,
  movieList,
  person,
  personMovieCredits,
  personImages,
  genres,
  configuration,
  findByExternalId
};
