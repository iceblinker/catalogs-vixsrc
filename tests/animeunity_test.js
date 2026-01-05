require('dotenv').config();
const animeunity = require('../services/streams/scrapers/animeunity');

async function test() {
    console.log('Testing AnimeUnity Scraper...');

    // 1. Search
    const query = 'Kimetsu no Yaiba';
    console.log(`Searching for: ${query}`);
    const results = await animeunity.search(query);
    console.log(`Found ${results.length} results`);
    if (results.length > 0) {
        console.log('First 3 results:', JSON.stringify(results.slice(0, 3), null, 2));
    } else {
        console.log('No results found. Exiting.');
        return;
    }

    // 2. Resolve Stream (Episode 1)
    console.log('\nResolving Stream for Episode 1...');
    // Note: searchAndResolve expects (query, type, season, episode)
    // For anime, season is often ignored or handled differently, but we pass 1 for consistency if needed.
    // AnimeUnity usually just cares about the absolute episode number for long runners like One Piece,
    // or season/episode for others.
    // Let's try passing episode '1'.

    const streams = await animeunity.searchAndResolve(query, 'series', 1, 1);
    console.log('Streams:', JSON.stringify(streams, null, 2));
}

test().catch(console.error);
