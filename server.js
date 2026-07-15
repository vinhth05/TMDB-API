const app = require('./src/app');
const config = require('./src/config/config');
const tmdbLatestMovieJob = require('./src/jobs/tmdbLatestMovie.job');

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`TMDB Integration API is running on port ${PORT}`);
  
  // Start background scheduler jobs
  tmdbLatestMovieJob.startJob();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
