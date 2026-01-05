const knaben = require('../services/streams/scrapers/knaben');

async function runTest() {
    console.log('=== Testing Knaben Scraper ===');

    try {
        const query = '1080p';
        console.log(`Searching for: ${query}`);

        const streams = await knaben.getStreams(query);

        console.log(`Found ${streams.length} streams`);

        if (streams.length > 0) {
            console.log('First result:', streams[0]);

            if (!streams[0].infoHash) {
                throw new Error('Stream missing infoHash');
            }

            console.log('✅ Test Passed');
        } else {
            console.warn('⚠️ No results found');
        }

    } catch (e) {
        console.error('❌ Test Failed:', e);
    }
}

runTest();
