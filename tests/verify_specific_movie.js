const { getStreams } = require('../services/streams/streamService');

async function verifyMovie() {
    console.log('--- Verifying Movie: Champagne Problems (2025) ---');

    // Mock Metadata for "Champagne Problems"
    const meta = {
        id: 'tt33053440',
        imdb_id: 'tt33053440',
        tmdb_id: '1323475',
        type: 'movie',
        name: 'Champagne Problems',
        year: 2025
    };

    console.log('Calling getStreams...');
    try {
        const streams = await getStreams(meta, 'movie');

        const response = { streams: streams };
        console.log('\n--- JSON Output ---');
        console.log(JSON.stringify(response, null, 4));
        console.log('-------------------\n');

        // Analysis
        console.log('--- Analysis ---');
        if (!Array.isArray(streams)) {
            console.error('❌ Error: streams is not an array');
        } else {
            console.log(`✅ streams is an array with ${streams.length} items`);

            if (streams.length > 0) {
                const first = streams[0];
                if (first.name && first.description) {
                    console.log('✅ Stream has name and description');
                } else {
                    console.error('❌ Stream missing name or description');
                }

                if (first.url || first.infoHash) {
                    console.log('✅ Stream has url or infoHash');
                } else {
                    console.error('❌ Stream missing url and infoHash');
                }

                if (first.name.includes('🇮🇹') || first.name.includes('🌍')) {
                    console.log('✅ Formatting applied (Flag detected)');
                } else {
                    console.error('❌ Formatting might be missing flag');
                }

                if (first.description.includes('📦') && !first.description.includes('NaN')) {
                    console.log('✅ Size parsing looks correct');
                } else {
                    console.error('❌ Size parsing might be broken (NaN check)');
                }
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verifyMovie();
