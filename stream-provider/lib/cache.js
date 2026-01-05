const Redis = require('ioredis');
const { REDIS_URL } = require('../config/settings');

let client = null;
let isRedisAvailable = false;

// Initialize Redis connection if URL is provided
if (REDIS_URL) {
    client = new Redis(REDIS_URL, {
        retryStrategy: (times) => {
            // Retry with exponential backoff, max 5 seconds
            return Math.min(times * 50, 5000);
        },
        maxRetriesPerRequest: 1, // Fail fast for individual requests
        enableOfflineQueue: false // Don't queue commands if disconnected
    });

    client.on('connect', () => {
        console.log('[Cache] Redis connected');
        isRedisAvailable = true;
    });

    client.on('error', (err) => {
        console.error('[Cache] Redis error:', err.message);
        isRedisAvailable = false;
    });
} else {
    console.log('[Cache] No REDIS_URL provided, using in-memory fallback (not implemented for persistence)');
}

/**
 * Get value from cache
 * @param {string} key 
 * @returns {Promise<any|null>} Parsed value or null
 */
async function get(key) {
    if (!isRedisAvailable || !client) return null;
    try {
        const data = await client.get(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        // console.error(`[Cache] Get error for ${key}:`, e.message);
        return null;
    }
}

/**
 * Set value in cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 */
async function set(key, value, ttlSeconds = 3600) {
    if (!isRedisAvailable || !client) return;
    try {
        const str = JSON.stringify(value);
        await client.set(key, str, 'EX', ttlSeconds);
    } catch (e) {
        // console.error(`[Cache] Set error for ${key}:`, e.message);
    }
}

/**
 * Delete value from cache
 * @param {string} key 
 */
async function del(key) {
    if (!isRedisAvailable || !client) return;
    try {
        await client.del(key);
    } catch (e) {
        // console.error(`[Cache] Del error for ${key}:`, e.message);
    }
}

module.exports = { get, set, del };
