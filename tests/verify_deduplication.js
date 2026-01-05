const streamService = require('../services/streams/streamService');

async function verifyDeduplication() {
    const meta = {
        name: 'Deadpool',
        id: 'tt1431045', // Deadpool
        imdb_id: 'tt1431045'
    };
    const type = 'movie';
    const host = 'localhost';
    const season = undefined;
    const episode = undefined;

    console.log(`\n=== Verifying Deduplication ===`);
    console.log(`Searching for: ${meta.name}`);

    try {
        const streams = await streamService.getStreams(meta, type, host, season, episode);
        console.log(`\nFinal Result Count: ${streams.length}`);

        // Check for duplicate infoHashes
        const infoHashes = streams.map(s => s.infoHash).filter(Boolean);
        const uniqueInfoHashes = new Set(infoHashes);

        if (infoHashes.length !== uniqueInfoHashes.size) {
            console.error('❌ Test Failed: Duplicate infoHashes found!');
            console.log(`Total InfoHashes: ${infoHashes.length}`);
            console.log(`Unique InfoHashes: ${uniqueInfoHashes.size}`);
        } else {
            console.log('✅ Test Passed: No duplicate infoHashes found.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verifyDeduplication();
