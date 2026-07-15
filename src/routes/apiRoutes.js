const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movieController');
const { validate, schemas } = require('../middlewares/requestValidator');
const verifyApiKey = require('../middlewares/authMiddleware');

// =======================
// HEALTH CHECK
// =======================
router.get('/health', movieController.getHealthStatus);

// =======================
// PUBLIC ENDPOINTS (Legacy/Current aliases)
// =======================
// Search movies
router.get('/api/search', validate(schemas.searchSchema), movieController.search);

// Search keywords (for autocomplete/suggestions)
router.get('/api/search/keyword', validate(schemas.searchSchema), movieController.searchKeywords);

// Get movie preview (aggregates multiple TMDB endpoints)
router.get('/api/preview/:id', validate(schemas.idSchema, 'params'), movieController.preview);

// Standalone endpoints for movie details
router.get('/api/movie/:id/credits', validate(schemas.idSchema, 'params'), movieController.credits);
router.get('/api/movie/:id/videos', validate(schemas.idSchema, 'params'), movieController.videos);
router.get('/api/movie/:id/images', validate(schemas.idSchema, 'params'), movieController.images);

// Get person details
router.get('/api/person/:id', validate(schemas.idSchema, 'params'), movieController.person);

// Get genres
router.get('/api/genres', movieController.genres);

// Movie Lists
router.get('/api/tmdb/movies/latest-top20', movieController.getLatestTop20);
router.get('/api/tmdb/verified-movies', movieController.getVerifiedMovies); // NEW Verified Movie API
router.get('/api/popular', validate(schemas.listSchema), movieController.movieList);
router.get('/api/upcoming', validate(schemas.listSchema), movieController.movieList);
router.get('/api/now-playing', validate(schemas.listSchema), movieController.movieList);
router.get('/api/top-rated', validate(schemas.listSchema), movieController.movieList);

// =======================
// PROTECTED / IMPORT ENDPOINTS
// =======================
router.use('/api/import', verifyApiKey);

// -----------------------
// Search Endpoints
// -----------------------
router.get('/api/import/search', validate(schemas.searchSchema), movieController.search);
router.get('/api/import/search/keyword', validate(schemas.searchSchema), movieController.searchKeywords);
router.get('/api/import/search/suggestions', validate(schemas.searchSchema), movieController.searchSuggestions);

// -----------------------
// Movie Endpoints (Legacy Singular)
// -----------------------
router.get('/api/import/preview/:id', validate(schemas.idSchema, 'params'), movieController.preview);
router.get('/api/import/movie/:id/credits', validate(schemas.idSchema, 'params'), movieController.credits);
router.get('/api/import/movie/:id/videos', validate(schemas.idSchema, 'params'), movieController.videos);
router.get('/api/import/movie/:id/images', validate(schemas.idSchema, 'params'), movieController.images);

// -----------------------
// Movie Endpoints (Canonical Plural)
// -----------------------
router.get('/api/import/movies/:tmdbId/preview', validate(schemas.tmdbIdSchema, 'params'), movieController.preview);
router.get('/api/import/movies/:tmdbId/bundle', validate(schemas.tmdbIdSchema, 'params'), movieController.bundle);
router.get('/api/import/movies/:tmdbId/credits', validate(schemas.tmdbIdSchema, 'params'), movieController.credits);
router.get('/api/import/movies/:tmdbId/videos', validate(schemas.tmdbIdSchema, 'params'), movieController.videos);
router.get('/api/import/movies/:tmdbId/images', validate(schemas.tmdbIdSchema, 'params'), movieController.images);
router.get('/api/import/movies/:tmdbId/keywords', validate(schemas.tmdbIdSchema, 'params'), movieController.keywords);
router.get('/api/import/movies/:tmdbId/release-dates', validate(schemas.tmdbIdSchema, 'params'), movieController.releaseDates);
router.get('/api/import/movies/:tmdbId/translations', validate(schemas.tmdbIdSchema, 'params'), movieController.translations);
router.get('/api/import/movies/:tmdbId/alternative-titles', validate(schemas.tmdbIdSchema, 'params'), movieController.alternativeTitles);
router.get('/api/import/movies/:tmdbId/external-ids', validate(schemas.tmdbIdSchema, 'params'), movieController.externalIds);
router.get('/api/import/movies/:tmdbId/similar', validate(schemas.tmdbIdSchema, 'params'), validate(schemas.listSchema), movieController.similar);
router.get('/api/import/movies/:tmdbId/recommendations', validate(schemas.tmdbIdSchema, 'params'), validate(schemas.listSchema), movieController.recommendations);

// -----------------------
// Discover & Lists
// -----------------------
router.get('/api/import/discover/movies', validate(schemas.discoverSchema), movieController.discover);
router.get('/api/import/movies/popular', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/movies/upcoming', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/movies/now-playing', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/movies/top-rated', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/movies/trending', validate(schemas.listSchema), movieController.movieList);

// Legacy List Aliases
router.get('/api/import/popular', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/upcoming', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/now-playing', validate(schemas.listSchema), movieController.movieList);
router.get('/api/import/top-rated', validate(schemas.listSchema), movieController.movieList);

// -----------------------
// People Endpoints
// -----------------------
router.get('/api/import/people/search', validate(schemas.searchSchema), movieController.personSearch);
router.get('/api/import/people/:tmdbPersonId', validate(schemas.idSchema, 'params'), movieController.person); // using id schema but parameter is different? let's use idSchema for all people routes if id is not specifically tmdbPersonId
// Wait, idSchema validates req.params.id. I should define a schema for tmdbPersonId or just use id and rename parameter.
// Let's use id for the param name to keep schemas simple, but we can override params manually or define tmdbPersonIdSchema.
// Since we used tmdbPersonId in controller, we need a tmdbPersonIdSchema or we change param back to id. Let's fix this in the router mapping.

// We will use :id for person endpoints to match idSchema, then controller uses req.params.id or req.params.tmdbPersonId
router.get('/api/import/people/:tmdbPersonId', validate(schemas.tmdbPersonIdSchema, 'params'), movieController.person);
router.get('/api/import/people/:tmdbPersonId/movie-credits', validate(schemas.tmdbPersonIdSchema, 'params'), movieController.personMovieCredits);
router.get('/api/import/people/:tmdbPersonId/images', validate(schemas.tmdbPersonIdSchema, 'params'), movieController.personImages);

// Legacy person alias
router.get('/api/import/person/:id', validate(schemas.idSchema, 'params'), movieController.person);

// -----------------------
// Reference Endpoints
// -----------------------
router.get('/api/import/genres', movieController.genres);
router.get('/api/import/configuration', movieController.configuration);
router.get('/api/import/find', validate(schemas.findByExternalIdSchema), movieController.findByExternalId);

module.exports = router;
