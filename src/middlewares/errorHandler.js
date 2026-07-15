// Not found error handler
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.code = 'NOT_FOUND';
  error.statusCode = 404;
  next(error);
};

// General error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Internal Server Error';

  if (err.statusCode) {
    statusCode = err.statusCode;
  }
  
  if (err.code && typeof err.code === 'string') {
    errorCode = err.code;
  } else if (err.code === 400) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

  // Handle Axios/TMDB errors
  if (err.response) {
    statusCode = err.response.status;
    const tmdbMessage = err.response.data?.status_message || message;
    message = tmdbMessage;

    switch (statusCode) {
      case 401:
        errorCode = 'TMDB_UNAUTHORIZED';
        break;
      case 403:
        errorCode = 'TMDB_FORBIDDEN';
        break;
      case 404:
        errorCode = 'TMDB_RESOURCE_NOT_FOUND';
        break;
      case 429:
        errorCode = 'TMDB_RATE_LIMITED';
        break;
      case 502:
      case 503:
        errorCode = 'TMDB_UNAVAILABLE';
        break;
      case 504:
        errorCode = 'TMDB_TIMEOUT';
        break;
      default:
        if (statusCode >= 500) {
          errorCode = 'TMDB_BAD_RESPONSE';
        }
        break;
    }
  } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
    statusCode = 504;
    errorCode = 'TMDB_TIMEOUT';
  }

  res.status(statusCode).json({
    success: false,
    errorCode,
    message,
    details: null,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  notFound,
  errorHandler,
};
