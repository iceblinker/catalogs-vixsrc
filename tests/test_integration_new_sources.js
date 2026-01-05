const streamService = require('../stream-provider/services/streams/streamService');

async function test() {
    console.log('--- Testing StreamService Integration (SolidTorrents) ---');

    const meta = {
        id: '12345', // Dummy ID
        name: 'Inception',
        type: 'movie',
        year: 2010
    };

    try {
        const streams = await streamService.getStreams(meta, 'movie');
        console.log(`Found ${streams.length} total streams.`);

        const solidStreams = streams.filter(s => s.name.includes('SolidTorrents'));
        console.log(`Found ${solidStreams.length} streams from SolidTorrents.`);

        if (solidStreams.length > 0) {
            console.log('Sample SolidTorrents stream:', solidStreams[0]);
        }

        const leetStreams = streams.filter(s => s.name.includes('1337x'));
        console.log(`Found ${leetStreams.length} streams from 1337x.`);

        const tpbStreams = streams.filter(s => s.name.includes('TPB'));
        console.log(`Found ${tpbStreams.length} streams from TPB.`);

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
