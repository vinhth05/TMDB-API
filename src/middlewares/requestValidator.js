const Joi = require('joi');

const schemas = {
  searchSchema: Joi.object({
    keyword: Joi.string().required().min(1),
    page: Joi.number().integer().min(1).default(1),
    language: Joi.string().optional(),
    region: Joi.string().length(2).optional(),
    includeAdult: Joi.boolean().default(false),
    year: Joi.number().integer().min(1800).max(2100).optional(),
    primaryReleaseYear: Joi.number().integer().min(1800).max(2100).optional()
  }),
  idSchema: Joi.object({
    id: Joi.number().integer().required(),
  }),
  tmdbIdSchema: Joi.object({
    tmdbId: Joi.number().integer().required(),
  }),
  tmdbPersonIdSchema: Joi.object({
    tmdbPersonId: Joi.number().integer().required(),
  }),
  listSchema: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    language: Joi.string().optional(),
    region: Joi.string().length(2).optional(),
    timeWindow: Joi.string().valid('day', 'week').default('day')
  }),
  discoverSchema: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    language: Joi.string().optional(),
    region: Joi.string().length(2).optional(),
    sortBy: Joi.string().valid(
      'popularity.desc', 'popularity.asc', 
      'primary_release_date.desc', 'primary_release_date.asc', 
      'vote_average.desc', 'vote_average.asc', 
      'revenue.desc', 'revenue.asc'
    ).default('popularity.desc'),
    genreIds: Joi.string().optional(),
    excludeGenreIds: Joi.string().optional(),
    releaseDateFrom: Joi.string().isoDate().optional(),
    releaseDateTo: Joi.string().isoDate().optional(),
    year: Joi.number().integer().min(1800).max(2100).optional(),
    minimumVoteAverage: Joi.number().min(0).max(10).optional(),
    minimumVoteCount: Joi.number().integer().min(0).optional(),
    originalLanguage: Joi.string().optional(),
    includeAdult: Joi.boolean().default(false),
    includeVideo: Joi.boolean().default(false)
  }),
  findByExternalIdSchema: Joi.object({
    externalId: Joi.string().required(),
    source: Joi.string().valid('imdb_id', 'wikidata_id', 'facebook_id', 'instagram_id', 'twitter_id').required(),
    language: Joi.string().optional(),
    mediaType: Joi.string().valid('movie', 'tv', 'person').optional()
  })
};

const validate = (schema, source = 'query') => {
  return (req, res, next) => {
    // Determine the actual source
    let dataToValidate = req[source];
    
    // Express parses true/false as strings in query. Let Joi handle it by default,
    // but we can ensure standard object
    
    const { error, value } = schema.validate(dataToValidate, { convert: true });
    if (error) {
      const err = new Error(error.details[0].message);
      err.code = 400;
      return next(err);
    }
    // Update req with validated/default values
    req[source] = value;
    next();
  };
};

module.exports = {
  validate,
  schemas
};
