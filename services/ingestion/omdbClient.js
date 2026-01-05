const { OMDB_API_KEY } = require('../../config/settings');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function fetchFromOMDB(imdbId, log = console.log) {
    if (!OMDB_API_KEY || !imdbId) return null;

    const url = `http://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            log(`[OMDB] Error ${res.status} for ${imdbId}`);
            return null;
        }
        const data = await res.json();
        if (data.Response === 'False') {
            log(`[OMDB] Error: ${data.Error} for ${imdbId}`);
            return null;
        }
        return data; // Returns full OMDB object
    } catch (e) {
        log(`[OMDB] Exception for ${imdbId}: ${e.message}`);
        return null;
    }
}

/**
 * Extracts ratings from OMDB response
 * @param {Object} data OMDB response object
 * @returns {Array} Array of rating objects [{ source: 'Rotten Tomatoes', value: '85%' }]
 */
function extractRatings(data) {
    if (!data || !data.Ratings) return [];
    return data.Ratings.map(r => ({
        source: r.Source,
        value: r.Value
    }));
}

/**
 * Extracts description if available and longer than current
 * @param {Object} data OMDB response object
 * @param {string} currentDesc Current description to compare against
 * @returns {string|null} Better description or null
 */
function extractBetterDescription(data, currentDesc) {
    if (!data || !data.Plot || data.Plot === 'N/A') return null;

    // Simple heuristic: If OMDB plot is significantly longer or if current is empty
    if (!currentDesc || (data.Plot.length > currentDesc.length + 50)) {
        return data.Plot;
    }
    return null;
}

module.exports = { fetchFromOMDB, extractRatings, extractBetterDescription };
