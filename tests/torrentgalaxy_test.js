const torrentgalaxy = require('../services/streams/scrapers/torrentgalaxy');

async function runTest() {
    console.log('=== Testing TorrentGalaxy Scraper ===');

    try {
        const query = '1080p';
        console.log(`Searching for: ${query}`);

        const streams = await torrentgalaxy.getStreams(query);

        console.log(`Found ${streams.length} streams`);

        if (streams.length > 0) {
            console.log('First result:', streams[0]);

            if (!streams[0].magnet && !streams[0].infoHash) {
                throw new Error('Stream missing magnet or infoHash');
            }

            console.log('✅ Test Passed');
        } else {
            console.warn('⚠️ No results found (might be expected if site is down or query is bad)');
        }

    } catch (e) {
        console.error('❌ Test Failed:', e);
    }
}

runTest();
