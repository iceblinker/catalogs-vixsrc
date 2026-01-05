const { getStreams } = require('../services/streams/streamService');

async function testPipeline() {
    console.log('--- Testing Stream Pipeline ---');

    // Mock Metadata
    const meta = {
        id: 'tt1234567',
        type: 'movie',
        name: 'Test Movie',
        imdb_id: 'tt1234567'
    };

    // Mock Scrapers (we can't easily mock internal requires without proxyquire, so we'll rely on real scrapers returning empty or mock data if we could inject it)
    // For now, we'll run it and see if it crashes, and check the logs.
    // Ideally we should unit test filterer and deduplicator separately.

    console.log('Running getStreams...');
    const streams = await getStreams(meta, 'movie');

    console.log(`Result: ${streams.length} streams.`);
    if (streams.length > 0) {
        console.log('First stream:', streams[0]);
    }

    console.log('--- Pipeline Test Complete ---');
}

testPipeline();
