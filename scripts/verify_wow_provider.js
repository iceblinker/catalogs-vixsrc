require('dotenv').config();
const { fetchTMDB } = require('../services/ingestion/tmdbClient');
const { getDatabase } = require('../lib/db');

// Initialize DB
getDatabase();

async function runVerify() {
    console.log('Verifying WOW Presents Plus logic...');

    // RuPaul's Drag Race ID: 6357
    const tvId = 6357;

    // Clear cache to force fresh fetch with new logic
    const db = getDatabase();
    db.prepare("DELETE FROM tmdb_cache WHERE key = 'tmdb:tv:6357'").run();
    console.log('Cleared cache for TV 6357.');

    console.log(`Fetching TV Show ID ${tvId} (RuPaul's Drag Race)...`);

    const result = await fetchTMDB(tvId, 'tv');

    if (!result) {
        console.error('Failed to fetch data.');
        process.exit(1);
    }

    const providers = result.details.providers || [];

    // Write title to file
    const fs = require('fs');
    const titleFound = result.details.name || result.details.title || 'UNKNOWN';
    fs.writeFileSync('title_found.txt', `Title: ${titleFound}\nProviders: ${JSON.stringify(providers)}`);

    console.log('Providers found:', providers);

    if (providers.includes('WOW Presents Plus')) {
        console.log('SUCCESS: "WOW Presents Plus" is present!');
    } else {
        console.error('FAILURE: "WOW Presents Plus" is MISSING.');
        process.exit(1);
    }
}

runVerify();
