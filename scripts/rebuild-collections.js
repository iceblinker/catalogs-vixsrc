require('dotenv').config();
const { getDatabase } = require('../lib/db');
const collectionRepo = require('../lib/db/repositories/collectionRepository');
const { saveCollectionIfMissing } = require('../services/ingestion/tmdbClient');

const db = getDatabase();

async function rebuildCollections() {
    console.log('[Rebuild] Starting collection rebuild...');

    // 1. Get all distinct collection IDs from movie_metadata
    const rows = db.prepare('SELECT DISTINCT collection_id FROM movie_metadata WHERE collection_id IS NOT NULL').all();
    const allCollectionIds = rows.map(r => r.collection_id).filter(id => id);

    console.log(`[Rebuild] Found ${allCollectionIds.length} unique collection IDs in movie_metadata.`);

    // 2. Check which ones are missing from collections table
    let missingCount = 0;
    let successCount = 0;
    let failCount = 0;

    for (const id of allCollectionIds) {
        const exists = collectionRepo.exists(id);
        if (!exists) {
            missingCount++;
            console.log(`[Rebuild] Collection ${id} is MISSING. Fetching from TMDB...`);
            try {
                // Pass a minimal object with just ID, saveCollectionIfMissing will fetch the rest
                await saveCollectionIfMissing({ id: id }, console.log);
                successCount++;
                // Slight delay to be nice to TMDB
                await new Promise(r => setTimeout(r, 200));
            } catch (err) {
                console.error(`[Rebuild] Failed to fetch/save collection ${id}: ${err.message}`);
                failCount++;
            }
        }
    }

    console.log(`[Rebuild] Finished.`);
    console.log(`[Rebuild] Total IDs: ${allCollectionIds.length}`);
    console.log(`[Rebuild] Missing:   ${missingCount}`);
    console.log(`[Rebuild] Refetched: ${successCount}`);
    console.log(`[Rebuild] Failed:    ${failCount}`);
}

rebuildCollections().catch(console.error);
