const filterer = require('../stream-provider/services/streams/filterer');
const deduplicator = require('../stream-provider/services/streams/deduplicator');

function runTests() {
    console.log('--- Starting Verification Tests ---');

    // Test 1: Italian Filtering
    console.log('\n[Test 1] Italian Filtering');
    const meta = { name: 'Inception', year: 2010 };
    const streams = [
        { title: 'Inception 2010 ITA 1080p BluRay', source: 'SolidTorrents' }, // Should keep
        { title: 'Inception (2010) [1080p] [ITA-ENG]', source: 'TPB' },       // Should keep (Multi)
        { title: 'Inception.2010.1080p.BluRay.x264-SPARKS', source: 'SolidTorrents' }, // Should reject (English implied, no ITA)
        { title: 'Inception 2010 1080p ENG', source: '1337x' },                // Should reject (Explicit ENG)
        { title: 'Inception 2010 720p SUBITA', source: 'SolidTorrents' }       // Should keep (Subbed)
    ];

    const filtered = filterer.filter(streams, meta, 'movie');

    console.log(`Input: ${streams.length} streams`);
    console.log(`Output: ${filtered.length} streams`);

    filtered.forEach(s => console.log(`  - Kept: ${s.title}`));

    const rejected = streams.filter(s => !filtered.includes(s));
    rejected.forEach(s => console.log(`  - Rejected: ${s.title}`));

    // Assertions
    if (filtered.find(s => s.title.includes('SPARKS'))) console.error('FAIL: Kept English SPARKS release');
    if (filtered.find(s => s.title.includes('ENG') && !s.title.includes('ITA'))) console.error('FAIL: Kept English only release');
    if (!filtered.find(s => s.title.includes('ITA'))) console.error('FAIL: Lost Italian release');

    // Test 2: Deduplication
    console.log('\n[Test 2] Deduplication');
    const dupStreams = [
        { title: 'Stream A', infoHash: 'HASH123', seeders: 10, source: 'SolidTorrents' },
        { title: 'Stream A Duplicate', infoHash: 'HASH123', seeders: 50, source: '1337x' }, // Better seeders
        { title: 'Stream B', infoHash: 'HASH456', seeders: 20, source: 'TPB' },
        { title: 'Stream C', url: 'http://stream.com/1', isDirectStream: true }
    ];

    const deduplicated = deduplicator.deduplicate(dupStreams);

    console.log(`Input: ${dupStreams.length} streams`);
    console.log(`Output: ${deduplicated.length} streams`);

    deduplicated.forEach(s => console.log(`  - Result: ${s.title} (Seeders: ${s.seeders || 'N/A'}, Source: ${s.source})`));

    // Assertions
    if (deduplicated.length !== 3) console.error(`FAIL: Expected 3 streams, got ${deduplicated.length}`);
    const hash123 = deduplicated.find(s => s.infoHash === 'HASH123');
    if (hash123.seeders !== 50) console.error(`FAIL: Did not keep better seeders for HASH123 (Got ${hash123.seeders})`);
    if (hash123.source !== '1337x') console.error(`FAIL: Did not update source for HASH123 (Got ${hash123.source})`);

    console.log('\n--- Tests Completed ---');
}

runTests();
