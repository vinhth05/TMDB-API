const cron = require('node-cron');
const tmdbExportStream = require('../services/tmdbExportStream.service');

/**
 * Job to automatically download the TMDB daily export file.
 * TMDB usually updates the export files around 8:00 AM UTC (15:00 UTC+7).
 * We will schedule this to run at 8:30 AM UTC (15:30 UTC+7) every day to be safe.
 */
const startJob = () => {
  // '30 8 * * *' means 08:30 AM every day (server time UTC)
  // If your server is on UTC+7, this runs at 15:30 VN time.
  // Adjust the cron expression if your server timezone is different.
  cron.schedule('30 8 * * *', async () => {
    console.log(`[JOB] Starting daily TMDB export download: ${new Date().toISOString()}`);
    try {
      await tmdbExportStream.downloadExportFile();
      console.log(`[JOB] Successfully downloaded TMDB export for today.`);
    } catch (error) {
      console.error(`[JOB] Failed to download TMDB export: ${error.message}`);
    }
  });
  
  // console.log('TMDB Export Download cron job scheduled for 08:30 server time daily.');
};

module.exports = {
  startJob
};
