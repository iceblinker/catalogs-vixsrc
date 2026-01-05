const ilCorsaroNero = require('../services/streams/scrapers/ilcorsaronero');

async function test() {
    console.log('Testing IlCorsaroNero Scraper...');
    const query = 'Inception';
    console.log(`Searching for: ${query}`);

    try {
        const results = await ilCorsaroNero.search(query, 'movie');
        console.log(`Found ${results.length} results.`);

        if (results.length > 0) {
            console.log('First result:', JSON.stringify(results[0], null, 2));
        } else {
            console.log('No results found. This might be due to network issues or site changes.');
        }
    } catch (e) {
        console.error('Scraper error:', e);
    }
}

test();
