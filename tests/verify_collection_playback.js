const { getStreams } = require('../services/streams/streamService');

async function verifyCollectionPlayback() {
    // Mock Meta for a Collection (e.g., Maneater Collection)
    // We simulate what metaService.getMeta returns for a collection
    const mockMeta = {
        id: 'ctmdb.123',
        name: 'Maneater Collection',
        type: 'series', // Stremio treats it as series
        videos: [
            {
                id: 'ctmdb.123:1:1',
                title: 'Grizzly Rage',
                season: 1,
                episode: 1,
                realId: 13954 // TMDB ID for Grizzly Rage
            },
            {
                id: 'ctmdb.123:1:2',
                title: 'Maneater',
                season: 1,
                episode: 2,
                realId: 13955 // TMDB ID for Maneater
            }
        ]
    };

    console.log('=== Verifying Collection Playback ===');

    // Test Case 1: Request Episode 1 (Grizzly Rage)
    console.log('\n--- Test Case 1: Episode 1 (Grizzly Rage) ---');
    const streams1 = await getStreams(mockMeta, 'series', 'localhost', 1, 1);
    console.log(`Found ${streams1.length} streams.`);
    if (streams1.length > 0) {
        console.log('First Stream Name:', streams1[0].name);
        console.log('First Stream Desc:', streams1[0].description);
    }

    // Test Case 2: Request Episode 2 (Maneater)
    console.log('\n--- Test Case 2: Episode 2 (Maneater) ---');
    const streams2 = await getStreams(mockMeta, 'series', 'localhost', 1, 2);
    console.log(`Found ${streams2.length} streams.`);
    if (streams2.length > 0) {
        console.log('First Stream Name:', streams2[0].name);
        console.log('First Stream Desc:', streams2[0].description);

        // Verify BingeGroup
        const bingeGroup = streams2[0].behaviorHints?.bingeGroup;
        console.log('BingeGroup:', bingeGroup);
        if (bingeGroup && bingeGroup.includes('ctmdb.123')) {
            console.log('✅ BingeGroup is correct (linked to Collection ID)');
        } else {
            console.error('❌ BingeGroup is incorrect');
        }
    }
}

verifyCollectionPlayback();
