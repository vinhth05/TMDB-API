const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('./config');

// Use standard Agents with keepAlive to reuse TCP connections efficiently without socket family restrictions
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const tmdbClient = axios.create({
  baseURL: config.tmdb.baseUrl,
  timeout: config.tmdb.timeout,
  httpAgent,
  httpsAgent,
  headers: {
    Accept: 'application/json',
    Authorization: `Bearer ${config.tmdb.token}`,
    'Accept-Encoding': 'gzip,deflate,compress'
  }
});

// Response interceptor for smart retry logic on network errors, 5xx, or 429 rate limits
tmdbClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config: reqConfig, response } = error;
    
    if (!reqConfig) {
      return Promise.reject(error);
    }

    reqConfig._retryCount = reqConfig._retryCount || 0;
    
    // Allow up to 3 retries on network/server/rate-limit errors
    if (reqConfig._retryCount < 3) {
      reqConfig._retryCount++;
      const isRateLimit = response && response.status === 429;
      const delay = isRateLimit ? 1500 : 500 * reqConfig._retryCount;

      console.warn(`[TMDB Client] Retrying request to ${reqConfig.url} (Attempt ${reqConfig._retryCount}/3) after ${delay}ms due to: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return tmdbClient(reqConfig);
    }
    
    return Promise.reject(error);
  }
);

module.exports = tmdbClient;
