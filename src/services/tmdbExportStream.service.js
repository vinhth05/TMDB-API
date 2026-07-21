const zlib = require('zlib');
const readline = require('readline');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const config = require('../config/config');

const DATA_DIR = path.join(__dirname, '../../data');
const LOCAL_EXPORT_FILE = path.join(DATA_DIR, 'movie_ids.json.gz');
const SORTED_EXPORT_FILE = path.join(DATA_DIR, 'movie_ids_sorted.json.gz');

class TmdbExportStreamService {
  
  /**
   * Generates the export file date string (MM_DD_YYYY).
   * TMDB daily exports usually generated around 8 AM UTC.
   */
  getExportDateString(date = new Date()) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}_${day}_${year}`;
  }

  /**
   * Downloads the TMDB export file and saves it locally.
   * Includes an auto-retry mechanism for network failures.
   */
  async downloadExportFile(maxRetries = 3) {
    let date = new Date();
    
    // Check if the sorted export file exists and was downloaded today
    if (fs.existsSync(SORTED_EXPORT_FILE)) {
      const stats = fs.statSync(SORTED_EXPORT_FILE);
      const mtime = stats.mtime;
      if (
        mtime.getDate() === date.getDate() &&
        mtime.getMonth() === date.getMonth() &&
        mtime.getFullYear() === date.getFullYear()
      ) {
        console.log(`[TMDB Export Stream] Export file already downloaded and sorted today (${mtime.toISOString().split('T')[0]}). Skipping download.`);
        return;
      }
    }

    let attempt = 0;
    
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (attempt <= maxRetries) {
      try {
        await this._downloadFile(date);
        console.log(`[TMDB Export Stream] Export file successfully downloaded to ${LOCAL_EXPORT_FILE}`);
        await this.sortExportFile();
        return; // Success, exit the loop
      } catch (error) {
        // If it's a 404/403, we fallback to yesterday's date ONCE
        if (error.status === 404 || error.status === 403) {
          console.warn(`[TMDB Export Stream] Export for today (${this.getExportDateString(date)}) not found. Falling back to yesterday.`);
          date.setDate(date.getDate() - 1);
          try {
            await this._downloadFile(date);
            console.log(`[TMDB Export Stream] Yesterday's export file successfully downloaded to ${LOCAL_EXPORT_FILE}`);
            await this.sortExportFile();
            return; // Success on yesterday's file
          } catch (fallbackError) {
            error = fallbackError; // If fallback also fails (e.g. network drops), we let the retry catch it
          }
        }

        attempt++;
        if (attempt > maxRetries) {
          throw error; // Give up after maxRetries
        }

        console.warn(`[TMDB Export Stream] Download failed: ${error.message}. Retrying attempt ${attempt}/${maxRetries} in 5 seconds...`);
        await wait(5000); // Wait 5 seconds before retrying
      }
    }
  }

  _downloadFile(date) {
    return new Promise((resolve, reject) => {
      const dateString = this.getExportDateString(date);
      const url = `${config.tmdb.exportBaseUrl}/movie_ids_${dateString}.json.gz`;
      
      console.log(`[TMDB Export Stream] Fetching daily export from: ${url}`);
      const protocol = url.startsWith('https') ? https : http;
      
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      protocol.get(url, (res) => {
        // TMDB uses AWS S3 which returns 403 Forbidden instead of 404 when a file doesn't exist
        if (res.statusCode === 404 || res.statusCode === 403) {
          return reject({ status: 404, message: 'Export not found or not yet generated for today' });
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to fetch TMDB export: ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(LOCAL_EXPORT_FILE);

        pipeline(
          res,
          fileStream,
          (err) => {
            if (err) {
              fs.unlink(LOCAL_EXPORT_FILE, () => reject(err));
            } else {
              resolve();
            }
          }
        );
      }).on('error', (err) => {
        fs.unlink(LOCAL_EXPORT_FILE, () => reject(err));
      });
    });
  }

  /**
   * Sorts the raw downloaded export file by Popularity DESCENDING (most popular first), then by TMDB ID DESCENDING.
   * Optimized for low-spec VPS (2GB RAM, 2 CPUs, 10GB SSD):
   * - Uses fast JSON.parse for accuracy (reads id and popularity)
   * - Stream chunks output to gzip with optimal compression level
   * - Deletes raw file after sorting to save ~27MB disk space
   */
  async sortExportFile() {
    const sourceFile = fs.existsSync(LOCAL_EXPORT_FILE) 
      ? LOCAL_EXPORT_FILE 
      : (fs.existsSync(SORTED_EXPORT_FILE) ? SORTED_EXPORT_FILE : null);

    if (!sourceFile) {
      throw new Error('Export file not found to sort');
    }
    console.log('[TMDB Export Stream] Sorting TMDB export file by Popularity DESCENDING (most popular first)...');
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const fileStream = fs.createReadStream(sourceFile);
      const gunzip = zlib.createGunzip();
      const rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });

      const items = [];
      fileStream.pipe(gunzip);

      rl.on('line', (line) => {
        if (!line) return;
        try {
          const parsed = JSON.parse(line);
          if (parsed && typeof parsed.id === 'number') {
            items.push({
              id: parsed.id,
              popularity: typeof parsed.popularity === 'number' ? parsed.popularity : 0,
              line
            });
          }
        } catch (e) {}
      });

      rl.on('close', () => {
        // Sort DESCENDING: Highest popularity first, then highest TMDB ID first
        items.sort((a, b) => {
          if (b.popularity !== a.popularity) {
            return b.popularity - a.popularity;
          }
          return b.id - a.id;
        });

        const tempSortedFile = SORTED_EXPORT_FILE + '.tmp';
        const outStream = fs.createWriteStream(tempSortedFile);
        const gzip = zlib.createGzip({ level: 6 });
        gzip.pipe(outStream);

        const CHUNK_SIZE = 10000;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          const chunk = items.slice(i, i + CHUNK_SIZE).map(item => item.line).join('\n') + '\n';
          gzip.write(chunk);
        }
        gzip.end();

        outStream.on('finish', () => {
          if (fs.existsSync(SORTED_EXPORT_FILE) && sourceFile !== SORTED_EXPORT_FILE) {
            try { fs.unlinkSync(SORTED_EXPORT_FILE); } catch (e) {}
          }
          if (sourceFile !== SORTED_EXPORT_FILE) {
            fs.renameSync(tempSortedFile, SORTED_EXPORT_FILE);
          } else {
            // Overwrite existing SORTED_EXPORT_FILE safely
            fs.unlinkSync(SORTED_EXPORT_FILE);
            fs.renameSync(tempSortedFile, SORTED_EXPORT_FILE);
          }
          
          // Delete raw export file to save disk space on VPS (10GB SSD limit)
          if (fs.existsSync(LOCAL_EXPORT_FILE)) {
            try {
              fs.unlinkSync(LOCAL_EXPORT_FILE);
              console.log('[TMDB Export Stream] Deleted raw export file to save ~27MB disk space');
            } catch (e) {}
          }

          const elapsed = Date.now() - startTime;
          console.log(`[TMDB Export Stream] Successfully sorted ${items.length} items by Popularity DESCENDING in ${elapsed}ms`);
          
          // Help V8 GC reclaim RAM immediately
          items.length = 0;
          resolve();
        });

        outStream.on('error', reject);
        gzip.on('error', reject);
      });

      rl.on('error', reject);
      gunzip.on('error', reject);
      fileStream.on('error', reject);
    });
  }

  /**
   * Reads from the locally downloaded and sorted file.
   */
  async getMovieIds(cursor = 0, limit = 20) {
    if (!fs.existsSync(SORTED_EXPORT_FILE)) {
      if (fs.existsSync(LOCAL_EXPORT_FILE)) {
        console.log('[TMDB Export Stream] Sorted export file not found. Sorting existing raw export file...');
        await this.sortExportFile();
      } else {
        console.log('[TMDB Export Stream] Local export file not found. Automatically downloading and sorting before streaming...');
        await this.downloadExportFile();
      }
    }
    console.log(`[TMDB Export Stream] Reading sorted export file (POPULARITY DESCENDING) from cursor: ${cursor}, limit: ${limit}`);
    return await this._streamExportLocal(cursor, limit);
  }

  _streamExportLocal(cursor, limit) {
    return new Promise((resolve, reject) => {
      const targetFile = fs.existsSync(SORTED_EXPORT_FILE) ? SORTED_EXPORT_FILE : LOCAL_EXPORT_FILE;
      const fileStream = fs.createReadStream(targetFile);
      const gunzip = zlib.createGunzip();
      
      // Prevent Z_BUF_ERROR when we intentionally destroy the stream early
      gunzip.on('error', (err) => {
        if (fileStream.destroyed && err.code === 'Z_BUF_ERROR') {
          return; // Ignore
        }
        reject(err);
      });

      fileStream.pipe(gunzip);

      const rl = readline.createInterface({
        input: gunzip,
        crlfDelay: Infinity
      });

      let currentLine = 0;
      const results = [];
      let hasMore = true;
      let isResolved = false;

      rl.on('line', (line) => {
        if (currentLine >= cursor && currentLine < cursor + limit) {
          try {
            const parsed = JSON.parse(line);
            results.push(parsed.id);
          } catch (e) {
            console.warn('Failed to parse line:', line);
          }
        }
        currentLine++;

        if (!isResolved && currentLine >= cursor + limit) {
          // We got all we need, abort to save CPU
          isResolved = true;
          hasMore = true;
          rl.close();
          fileStream.destroy(); // Stop reading the file early
          resolve({ ids: results, hasMore, totalRead: currentLine - cursor });
        }
      });

      rl.on('close', () => {
        // If we reach here without aborting, we hit the end of the file
        if (!isResolved) {
          isResolved = true;
          hasMore = false;
          resolve({ ids: results, hasMore, totalRead: currentLine - cursor });
        }
      });

      rl.on('error', (err) => {
        reject(err);
      });
      
      fileStream.on('error', (err) => {
        reject(err);
      });
    });
  }
}

module.exports = new TmdbExportStreamService();
