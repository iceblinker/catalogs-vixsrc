require('dotenv').config();
const animeunity = require('../services/streams/scrapers/animeunity');

async function runTest(name, fn) {
    console.log(`\n=== TEST: ${name} ===`);
    try {
        const start = Date.now();
        await fn();
        console.log(`✅ PASSED (${Date.now() - start}ms)`);
    } catch (e) {
        console.error(`❌ FAILED: ${e.message}`);
        console.error(e.stack);
    }
}

async function main() {
    console.log('Starting Comprehensive AnimeUnity Tests...');

    // 1. Test Series Search & Episode Fetching (Long Runner)
    await runTest('Series: One Piece (Long Runner)', async () => {
        const results = await animeunity.search('One Piece');
        if (!results.length) throw new Error('No results found for One Piece');

        const anime = results[0];
        console.log(`Found: ${anime.title} (ID: ${anime.id})`);

        const episodes = await animeunity.getEpisodes(anime.id);
        console.log(`Fetched ${episodes.length} episodes`);

        if (episodes.length === 0) throw new Error('No episodes fetched');

        // Check if pagination worked
        if (episodes.length > 120) {
            console.log(`✅ Successfully fetched > 120 episodes (${episodes.length})`);
        } else {
            console.warn(`⚠️ Fetched ${episodes.length} episodes. Might be incomplete if series is longer.`);
        }
    });

    // 2. Test Movie Search & Stream
    await runTest('Movie: Your Name (Kimi no Na wa)', async () => {
        const results = await animeunity.search('Kimi no Na wa');
        if (!results.length) throw new Error('No results found for Kimi no Na wa');

        const anime = results[0];
        console.log(`Found: ${anime.title} (ID: ${anime.id})`);

        const episodes = await animeunity.getEpisodes(anime.id);
        console.log(`Fetched ${episodes.length} episodes`);

        if (episodes.length === 0) throw new Error('No episodes fetched');

        // Movies usually have 1 episode
        const episode = episodes[0];
        console.log(`Resolving stream for Ep ${episode.number}...`);

        const streamUrl = await animeunity.getStreamUrl(anime.id, anime.slug, episode.id);
        if (!streamUrl) throw new Error('Failed to extract stream URL');

        console.log(`Stream URL: ${streamUrl}`);
        if (!streamUrl.includes('.m3u8')) throw new Error('Stream URL is not HLS');
    });

    // 3. Test Non-Existent Title
    await runTest('Non-Existent Title', async () => {
        const results = await animeunity.search('ThisAnimeDoesNotExist12345');
        console.log(`Found ${results.length} results`);
        if (results.length > 0) throw new Error('Should not find results');
    });

    // 4. Test Error Handling (Invalid ID)
    await runTest('Error Handling: Invalid ID', async () => {
        const episodes = await animeunity.getEpisodes(99999999);
        console.log(`Fetched ${episodes.length} episodes (Expected 0)`);
        if (episodes.length > 0) throw new Error('Should not find episodes for invalid ID');
    });
}

main().catch(console.error);
