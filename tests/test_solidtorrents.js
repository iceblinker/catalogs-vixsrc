const solidtorrents = require('../services/streams/scrapers/solidtorrents');

async function test() {
    console.log('--- Testing SolidTorrents Scraper ---');

    const query = 'Inception ITA';
    console.log(`Searching for: ${query}`);

    try {
        const streams = await solidtorrents.getStreams(query);
        console.log(`Found ${streams.length} streams:`);
        streams.forEach(s => {
            console.log(`- ${s.title}`);
            console.log(`  Size: ${s.size}, Seeders: ${s.seeders}`);
            console.log(`  Magnet: ${s.magnet}`);
        });
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
