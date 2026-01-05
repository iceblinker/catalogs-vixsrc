const toonitalia = require('../services/streams/scrapers/toonitalia');

async function verifyToonItalia() {
    const query = 'Deadpool';
    console.log(`\n=== Verifying ToonItalia Scraper ===`);
    console.log(`Searching for: ${query}`);

    try {
        const streams = await toonitalia.getStreams(query);
        console.log(`\nFound ${streams.length} streams.`);

        if (streams.length > 0) {
            console.log('Sample Stream:');
            console.log(streams[0]);
            console.log('✅ Test Passed: Streams found.');
        } else {
            console.warn('⚠️ Test Failed: No streams found.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verifyToonItalia();
