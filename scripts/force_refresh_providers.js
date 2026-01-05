const { getDatabase, closeDatabase } = require('../lib/db');
const { processSingleItem } = require('../services/ingestion/processor');
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
require('dotenv').config();

const db = getDatabase();

function log(msg) {
    console.log(`[Backfill] ${msg}`);
}

async function run() {
    log('Starting Provider Backfill...');

    // 1. Get all IDs
    const movies = movieRepo.getAllIds(); // returns array of tmdb_id
    const tvs = tvRepo.getAllIds();

    log(`Found ${movies.length} movies and ${tvs.length} series to refresh.`);

    // 2. Clear Cache & Reprocess
    // We do this in batches to avoid locking the DB too long or memory issues
    const BATCH = 10;
    const errors = [];

    // processSingleItem handles saving to repo, but we need to verify cache clearing
    const clearCache = (id, type) => {
        try {
            db.prepare('DELETE FROM tmdb_cache WHERE key = ?').run(`tmdb:${type}:${id}`);
        } catch (e) { }
    };

    // --- Movies ---
    // --- Movies ---
    for (let i = 0; i < movies.length; i += BATCH) {
        const chunk = movies.slice(i, i + BATCH);
        log(`Processing Movies ${i + 1}/${movies.length}`);

        const results = await Promise.all(chunk.map(async (id) => {
            clearCache(id, 'movie');
            return await processSingleItem(id, 'movie', log, { log: [], errors: [], already: 0 }, true);
        }));

        const toSave = results.filter(r => r && r.item).map(r => r.item);
        if (toSave.length) {
            movieRepo.saveMany(toSave);
            log(`Saved ${toSave.length} movies.`);
        }
    }

    // --- TV ---
    for (let i = 0; i < tvs.length; i += BATCH) {
        const chunk = tvs.slice(i, i + BATCH);
        log(`Processing TV ${i + 1}/${tvs.length}`);

        const results = await Promise.all(chunk.map(async (id) => {
            clearCache(id, 'tv');
            return await processSingleItem(id, 'tv', log, { log: [], errors: [], already: 0 }, true);
        }));

        const toSave = results.filter(r => r && r.item).map(r => r.item);
        if (toSave.length) {
            tvRepo.saveMany(toSave);
            log(`Saved ${toSave.length} series.`);
        }
    }

    log('Done.');
    closeDatabase();
}

run().catch(e => {
    console.error(e);
    closeDatabase();
});
