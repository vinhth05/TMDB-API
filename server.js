const app = require('./src/app');
const config = require('./src/config/config');
const tmdbLatestMovieJob = require('./src/jobs/tmdbLatestMovie.job');
const tmdbExportDownloadJob = require('./src/jobs/tmdbExportDownload.job');

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`TMDB Integration API is running on port ${PORT}`);
  
  // Start background scheduler jobs
  tmdbLatestMovieJob.startJob();
  tmdbExportDownloadJob.startJob();
});

// Handle unhandled promise rejections safely without exiting the server
process.on('unhandledRejection', (err) => {
  console.error(`[UnhandledRejection] Error: ${err ? err.message || err : 'Unknown error'}`);
});
