const { getDatabase } = require('../lib/db');

const COLLECTION_ID = 107465; // From ctmdb.107465
const IMDB_IDS = [
    "tt1782568",
    "tt2124096",
    "tt3121434",
    "tt3877844",
    "tt4706702",
    "tt5840988",
    "tt6907804",
    "tt9615680",
    "tt16148580",
    "tt22059202",
    "tt28115289",
    "tt32462790",
    "ttx13"
];

function purge() {
    const db = getDatabase();

    console.log('Starting purge...');

    // 1. Delete Collection
    try {
        const info = db.prepare('DELETE FROM collections WHERE id = ?').run(COLLECTION_ID);
        if (info.changes > 0) {
            console.log(`[SUCCESS] Deleted collection ${COLLECTION_ID}`);
        } else {
            console.log(`[INFO] Collection ${COLLECTION_ID} not found`);
        }
    } catch (e) {
        console.error(`[ERROR] Failed to delete collection ${COLLECTION_ID}:`, e.message);
    }

    // 2. Delete Movies by IMDB ID
    const deleteStmt = db.prepare('DELETE FROM movie_metadata WHERE imdb_id = ?');

    for (const imdbId of IMDB_IDS) {
        try {
            const info = deleteStmt.run(imdbId);
            if (info.changes > 0) {
                console.log(`[SUCCESS] Deleted movie with IMDB ID ${imdbId}`);
            } else {
                console.log(`[INFO] Movie with IMDB ID ${imdbId} not found`);
            }
        } catch (e) {
            console.error(`[ERROR] Failed to delete movie ${imdbId}:`, e.message);
        }
    }

    console.log('Purge complete.');
}

purge();
