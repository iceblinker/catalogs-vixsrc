
const { getDatabase, closeDatabase } = require('../lib/db');
const { processSingleItem } = require('../services/ingestion/processor');
const tvRepo = require('../lib/db/repositories/tvRepository');
require('dotenv').config();

const db = getDatabase();

function log(msg) {
    console.log(`[FixTV] ${msg}`);
}

async function fixTvProviders() {
    log('Scanning for TV series missing providers...');

    // Find IDs where providers is null/empty or '[]'
    const rows = db.prepare(`
        SELECT tmdb_id FROM tv_metadata 
        WHERE providers IS NULL 
           OR providers = '' 
           OR providers = '[]'
           OR watch_providers IS NULL
           OR watch_providers LIKE '%{}%'
    `).all();

    log(`Found ${rows.length} series to fix.`);

    if (rows.length === 0) return;

    const ids = rows.map(r => r.tmdb_id);

    // Clear cache helper
    const clearCache = (id) => {
        try {
            db.prepare('DELETE FROM tmdb_cache WHERE key = ?').run(`tmdb:tv:${id}`);
        } catch (e) { }
    };

    let count = 0;
    // Sequential Loop
    for (const id of ids) {
        count++;
        // Log every 10 items
        if (count % 10 === 0) log(`Processing ${count}/${ids.length}`);

        try {
            clearCache(id);
            const res = await processSingleItem(id, 'tv', log, { log: [], errors: [], already: 0 }, true);

            if (res && res.item && res.type === 'tv') {
                tvRepo.save(res.item);
                // log(`Saved ${res.item.title}`); 
            }
        } catch (e) {
            log(`Error processing ${id}: ${e.message}`);
        }

        // Small delay to be nice to CPU/API
        await new Promise(r => setTimeout(r, 100));
    }

    log('Done fixing TV providers.');
    closeDatabase();
}

fixTvProviders();
