require('dotenv').config();
process.env.VIXSRC_SKIP_LIST_CHECK = 'true';
const vixcloud = require('../services/streams/scrapers/vixcloud');

const config = {
    tmdbApiKey: process.env.TMDB_API_KEY,
    vixDual: true,
    addonBase: 'https://vixsrc.to'
};

async function test() {
    console.log('--- Testing VixCloud Scraper ---');

    // Test Movie: Inception
    const movieImdb = 'tt1375666';
    console.log(`\nTesting Movie: Inception (${movieImdb})`);
    try {
        const streams = await vixcloud.getStreams(movieImdb, 'movie', config);
        console.log(`Found ${streams.length} streams:`);
        streams.forEach(s => console.log(`- ${s.name.replace(/\n/g, ' ')} (${s.streamUrl})`));
    } catch (e) {
        console.error('Error:', e);
    }

    // Test Series: Breaking Bad S1E1
    const seriesImdb = 'tt0903747';
    console.log(`\nTesting Series: Breaking Bad S1E1 (${seriesImdb})`);
    try {
        // For series, the ID passed to getStreams is usually the IMDB ID, and type is 'series'.
        // But my scraper expects "tmdb:..." or "imdb:..." and handles season/episode internally if passed in ID?
        // No, streamService passes `queryId` which is just the show ID.
        // Wait, for series, streamService calls getStreams with `queryId` (show ID).
        // But `vixcloud.js` `getDirectStream` constructs URL with season/episode.
        // How does `vixcloud.js` know the season/episode?
        // In `getUrl`:
        // if (type === 'movie') ...
        // else { ... const obj = getObject(id); ... }
        // `getObject` splits by `:`.
        // So the ID passed to `getStreams` MUST contain season and episode for series.
        // In `streamService.js`, for series, it likely passes `tt123:1:1` or similar?
        // Let's check `streamService.js` again to be sure.
        // But for now I will assume I need to pass `tt0903747:1:1`.

        const streams = await vixcloud.getStreams(`${seriesImdb}:1:1`, 'series', config);
        console.log(`Found ${streams.length} streams:`);
        streams.forEach(s => console.log(`- ${s.name.replace(/\n/g, ' ')} (${s.streamUrl})`));
    } catch (e) {
        console.error('Error:', e);
    }

    // Test User's Movie: Train Dreams (might not exist, but check for errors)
    const trainDreamsImdb = 'tt29768334';
    console.log(`\nTesting Movie: Train Dreams (${trainDreamsImdb})`);
    try {
        const streams = await vixcloud.getStreams(trainDreamsImdb, 'movie', config);
        console.log(`Found ${streams.length} streams:`);
        streams.forEach(s => console.log(`- ${s.name.replace(/\n/g, ' ')} (${s.streamUrl})`));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
