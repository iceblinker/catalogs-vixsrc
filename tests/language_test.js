const torrentgalaxy = require('../services/streams/scrapers/torrentgalaxy');
const knaben = require('../services/streams/scrapers/knaben');

async function testLanguageQueries() {
    const query = 'Deadpool ITA'; // Popular movie, likely to have Italian release
    console.log(`\n=== Testing Language Query: "${query}" ===`);

    console.log('\n--- TorrentGalaxy ---');
    try {
        const tgStreams = await torrentgalaxy.getStreams(query);
        console.log(`Found ${tgStreams.length} streams.`);
        if (tgStreams.length > 0) {
            console.log('Sample:', tgStreams[0].title);
        }
    } catch (e) {
        console.error('TG Error:', e.message);
    }

    console.log('\n--- Knaben ---');
    try {
        const knStreams = await knaben.getStreams(query);
        console.log(`Found ${knStreams.length} streams.`);
        if (knStreams.length > 0) {
            console.log('Sample:', knStreams[0].title);
        }
    } catch (e) {
        console.error('Knaben Error:', e.message);
    }
}

testLanguageQueries();
