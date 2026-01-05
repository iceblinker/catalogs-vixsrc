const axios = require('axios');
const UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function get(url, headers = {}) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': UserAgent,
                ...headers
            },
            timeout: 10000,
            validateStatus: (status) => status < 500 // Resolve 404s etc as valid response (or handle logic?) 
            // Better: throw on error so scraper knows
        });
        return response.data; // Old request.js likely returned HTML content directly
    } catch (error) {
        console.error(`[Request] Failed to fetch ${url}: ${error.message}`);
        throw error;
    }
}

module.exports = { get };
