const streamService = require('../services/streams/streamService');

async function verifyFormatting() {
    const meta = {
        name: 'Breaking Bad',
        id: 'tt0903747', // Breaking Bad
        imdb_id: 'tt0903747'
    };
    const type = 'series';
    const host = 'localhost';
    const season = 1;
    const episode = 1;

    console.log(`\n=== Verifying Formatting ===`);
    console.log(`Searching for: ${meta.name}`);

    try {
        const streams = await streamService.getStreams(meta, type, host, season, episode);
        console.log(`\nFinal Result Count: ${streams.length}`);

        if (streams.length > 0) {
            console.log('\n--- Sample Streams (Top 5) ---');
            streams.slice(0, 5).forEach((s, i) => {
                console.log(`\n[Stream ${i + 1}]`);
                console.log(`Name:        ${s.name.replace(/\n/g, '\\n')}`);
                console.log(`Description: ${s.description.replace(/\n/g, '\\n')}`);
                console.log(`Raw Title:   ${s.title}`);
                if (s.behaviorHints) {
                    console.log(`Hints:       ${JSON.stringify(s.behaviorHints)}`);
                }
            });

            const zileanStreams = streams.filter(s => s.source === 'Zilean');
            console.log(`\n--- Zilean Streams (${zileanStreams.length}) ---`);
            if (zileanStreams.length > 0) {
                console.log('Sample Zilean Stream:');
                console.log(JSON.stringify(zileanStreams[0], null, 2));
            }

            const bingeStreams = streams.filter(s => s.behaviorHints && s.behaviorHints.bingeGroup);
            console.log(`\n--- BingeGroup Check ---`);
            console.log(`Streams with bingeGroup: ${bingeStreams.length} / ${streams.length}`);
            if (bingeStreams.length > 0) {
                console.log('Sample BingeGroup:', bingeStreams[0].behaviorHints.bingeGroup);
            } else {
                console.warn('⚠️ No bingeGroup found!');
            }
        } else {
            console.warn('⚠️ No streams found.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verifyFormatting();
