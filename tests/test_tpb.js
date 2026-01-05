const tpb = require('../services/streams/scrapers/tpb');

async function test() {
    console.log('--- Testing TPB Scraper ---');

    const query = 'Big Buck Bunny';
    console.log(`Searching for: ${query}`);

    try {
        const streams = await tpb.getStreams(query);
        console.log(`Found ${streams.length} streams:`);
        streams.forEach(s => {
            console.log(`- ${s.title}`);
            console.log(`  Size: ${s.size}, Seeders: ${s.seeders}`);
            console.log(`  Magnet: ${s.magnet.substring(0, 50)}...`);
        });
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
