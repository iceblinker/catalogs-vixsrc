const Redis = require('ioredis');
const { REDIS_URL } = require('../config/settings');

let client = null;
let isRedisAvailable = false;

// In-memory fallback
const localCache = new Map();
const LOCAL_TTL_MS = 3600 * 1000; // Default 1 hour fallback

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
        // console.error('[Cache] Redis error:', err.message);
        isRedisAvailable = false;
    });
} else {
    console.log('[Cache] No REDIS_URL provided, using in-memory fallback');
}

/**
 * Get value from cache (Redis -> Local Fallback)
 * @param {string} key 
 * @returns {Promise<any|null>} Parsed value or null
 */
async function get(key) {
    // Try Redis first
    if (isRedisAvailable && client) {
        try {
            const data = await client.get(key);
            if (data) return JSON.parse(data);
        } catch (e) {
            // Redis failed, fall through to local
        }
    }

    // Fallback to local memory
    const local = localCache.get(key);
    if (local) {
        if (Date.now() < local.expiry) {
            return local.value;
        } else {
            localCache.delete(key);
        }
    }
    return null;
}

/**
 * Set value in cache (Redis + Local Fallback)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 */
async function set(key, value, ttlSeconds = 3600) {
    // Set in Redis
    if (isRedisAvailable && client) {
        try {
            const str = JSON.stringify(value);
            await client.set(key, str, 'EX', ttlSeconds);
        } catch (e) {
            // Redis set failed
        }
    }

    // Always set in local memory as backup
    localCache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}

/**
 * Delete value from cache
 * @param {string} key 
 */
async function del(key) {
    if (isRedisAvailable && client) {
        try {
            await client.del(key);
        } catch (e) {
            // Redis del failed
        }
    }
    localCache.delete(key);
}

module.exports = { get, set, del };
