require('dotenv').config();
const { getDatabase } = require('../lib/db');
const { ensureSchema } = require('../lib/db/schema');
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
const { processSingleItem } = require('../services/ingestion/processor');

// Regex for Asian characters
const isAsian = (text) => /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);

async function backfill() {
    const db = getDatabase();
    ensureSchema(db);
    console.log('[Backfill] Starting Metadata Backfill...');

    const hasMissingData = (m) => {
        const descBad = (m.description || '').length < 20;
        const titleAsian = isAsian(m.title);
        const keysMissing = !m.keywords || m.keywords === '[]' || m.keywords === 'null';
        const provMissing = !m.providers || m.providers === '[]' || m.providers === 'null';
        const prodMissing = !m.production_companies || m.production_companies === '[]' || m.production_companies === 'null';
        return descBad || titleAsian || keysMissing || provMissing || prodMissing;
    };

    // 1. Find candidates (Movies)
    // Note: ensureSchema guarantees columns exist
    const allMovies = db.prepare('SELECT tmdb_id, title, description, keywords, providers, production_companies FROM movie_metadata ORDER BY popularity DESC').all();
    const movieCandidates = allMovies.filter(hasMissingData).map(m => m.tmdb_id);

    // 2. Find candidates (TV)
    const allTv = db.prepare('SELECT tmdb_id, name as title, description, keywords, providers, production_companies FROM tv_metadata ORDER BY popularity DESC').all();
    const tvCandidates = allTv.filter(hasMissingData).map(t => t.tmdb_id);

    console.log(`[Backfill] Found candidates -> Movies: ${movieCandidates.length}, TV: ${tvCandidates.length}`);

    if (movieCandidates.length === 0 && tvCandidates.length === 0) {
        console.log('[Backfill] No items need backfilling.');
        return;
    }

    const BATCH_SIZE = 1;
    const log = console.log;
    const st = { movie: 0, tv: 0, errors: [], log: [] };

    // --- Process Movies ---
    if (movieCandidates.length > 0) {
        console.log(`[Backfill] Processing ${movieCandidates.length} Movies...`);
        for (let i = 0; i < movieCandidates.length; i += BATCH_SIZE) {
            const chunk = movieCandidates.slice(i, i + BATCH_SIZE);
            console.log(`[Backfill] Movie Batch ${i + 1}/${movieCandidates.length}`);

            const results = await Promise.all(chunk.map(id => processSingleItem(id, 'movie', log, st, true)));

            const toSave = results.filter(r => r && r.type === 'movie').map(r => r.item);
            if (toSave.length) {
                movieRepo.saveMany(toSave);
                st.movie += toSave.length;
            }
        }
    }

    // --- Process TV ---
    if (tvCandidates.length > 0) {
        console.log(`[Backfill] Processing ${tvCandidates.length} TV Shows...`);
        for (let i = 0; i < tvCandidates.length; i += BATCH_SIZE) {
            const chunk = tvCandidates.slice(i, i + BATCH_SIZE);
            console.log(`[Backfill] TV Batch ${i + 1}/${tvCandidates.length}`);

            const results = await Promise.all(chunk.map(id => processSingleItem(id, 'tv', log, st, true)));

            const toSave = results.filter(r => r && r.type === 'tv').map(r => r.item);
            if (toSave.length) {
                tvRepo.saveMany(toSave);
                st.tv += toSave.length;
            }
        }
    }

    console.log(`[Backfill] Complete! Updated: Movies=${st.movie}, TV=${st.tv}`);
}

backfill().catch(err => console.error(err));
