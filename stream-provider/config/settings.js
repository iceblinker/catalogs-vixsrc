require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

module.exports = {
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    DB_PATH: process.env.DB_PATH || path.join(ROOT_DIR, 'catalog.db'),
    LOG_FILE: path.join(ROOT_DIR, 'addon.log'),
    UPDATE_LOG_FILE: path.join(ROOT_DIR, 'update.log'),
    UPDATE_HISTORY_PATH: path.join(ROOT_DIR, 'update-history.json'),
    UPDATE_STATUS_PATH: path.join(ROOT_DIR, 'update-status.json'),

    // Redis
    REDIS_URL: process.env.REDIS_URL || null,

    // StreamingUnity Credentials
    STREAMINGUNITY_XSRF_TOKEN: process.env.STREAMINGUNITY_XSRF_TOKEN,
    STREAMINGUNITY_SESSION: process.env.STREAMINGUNITY_SESSION,

    // Cache Files
    CACHE_SERIES_COLLECTIONS: path.join(ROOT_DIR, 'cache-seriescollections.json'),
    CACHE_MOVIE_COLLECTIONS: path.join(ROOT_DIR, 'cache-moviecollections.json'),
    // API Configuration
    DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '100', 10),
    MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '500', 10),
    SEARCH_MIN_LENGTH: parseInt(process.env.SEARCH_MIN_LENGTH || '2', 10),
    SEARCH_MAX_RESULTS: parseInt(process.env.SEARCH_MAX_RESULTS || '200', 10),
    MAX_SIZE_GB: parseFloat(process.env.MAX_SIZE_GB || '10'),
    EXCLUDE_REGEX: (process.env.EXCLUDE_REGEX || '').split(',').filter(Boolean).map(r => {
        const pattern = r.trim();
        // If it's a simple alphanumeric word, wrap in word boundaries to avoid partial matches (e.g. CAM matching Dreamcatcher)
        if (/^[a-zA-Z0-9]+$/.test(pattern)) {
            return new RegExp(`\\b${pattern}\\b`, 'i');
        }
        return new RegExp(pattern, 'i');
    }),

    // Performance Configuration
    CACHE_NOVITA_MOVIES: path.join(ROOT_DIR, 'novita-movies-stremio.json'),
    CACHE_TRENDING_MOVIES: path.join(ROOT_DIR, 'trending-movies-stremio.json'),
    CACHE_TRENDING_SERIES: path.join(ROOT_DIR, 'trending-series-stremio.json'),
    CACHE_NOVITA_SERIES: path.join(ROOT_DIR, 'novita-series-stremio.json'),
    CACHE_NUOVI_EPISODI: path.join(ROOT_DIR, 'cache-nuovi-episodi.json'),
    CACHE_NEW_RELEASES: path.join(ROOT_DIR, 'cache-new-releases.json'),

    KEYWORD_CATALOG: process.env.KEYWORD_CATALOG || '',
    CATALOG_NAME: process.env.CATALOG_NAME || 'default',
    TMDB_CACHE_PRUNE_MISSES: parseInt(process.env.TMDB_CACHE_PRUNE_MISSES || '5', 10),
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_ROTATE_SIZE: parseInt(process.env.LOG_ROTATE_SIZE || (5 * 1024 * 1024), 10),

    // Debrid Services
    REALDEBRID_API_KEY: process.env.REALDEBRID_API_KEY,
    TORBOX_API_KEY: process.env.TORBOX_API_KEY,
    TORBOX_STREMIO_CONFIG: process.env.TORBOX_STREMIO_CONFIG || process.env.TORBOX_API_KEY, // Fallback to API Key if not set
    ALLDEBRID_API_KEY: process.env.ALLDEBRID_API_KEY,

    // MediaFlow
    MEDIAFLOW_URL: process.env.MEDIAFLOW_URL,
    MEDIAFLOW_PASSWORD: process.env.MEDIAFLOW_PASSWORD,

    // Scrapers
    JACKETT_URL: process.env.JACKETT_URL,
    JACKETT_API_KEY: process.env.JACKETT_API_KEY,
    REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_API_KEYS: [
        process.env.GOOGLE_API_KEY,
        process.env.GOOGLE_API_KEY_1,
        process.env.GOOGLE_API_KEY_2,
        process.env.GOOGLE_API_KEY_3
    ].filter(Boolean),

    // AI Configuration
    AI_PROVIDER: process.env.AI_PROVIDER || 'google', // 'google' or 'ollama'
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3',

    ROOT_DIR
};
