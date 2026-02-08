require('dotenv').config();
const { getDatabase, closeDatabase } = require('../lib/db');
const { ensureSchema } = require('../lib/db/schema');
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
const { processSingleItem } = require('../services/ingestion/processor');
const { harmonize } = require('../services/ingestion/harmonizer');
const aiCatalogUpdater = require('./ai-catalog-updater');
const collectionsCatalog = require('../stream-provider/collectionsCatalog');
const { buildCollectionMeta } = require('../services/metaService');
const { CACHE_MOVIE_COLLECTIONS, CACHE_NEW_RELEASES } = require('../config/settings');
const fs = require('fs');

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

        // Check for English genres that should be Italian
        // We check for raw strings in the genres JSON or array
        let hasEnglishGenre = false;
        try {
            const gStr = typeof m.genres === 'string' ? m.genres : JSON.stringify(m.genres || []);
            hasEnglishGenre = gStr.includes("Action") || gStr.includes("Comedy") || gStr.includes("Adventure") ||
                gStr.includes("Animation") || gStr.includes("Science Fiction") || gStr.includes("Family");
        } catch (e) { }

        return descBad || titleAsian || keysMissing || provMissing || prodMissing || hasEnglishGenre;
    };

    // 1. Find candidates (Movies)
    // Note: ensureSchema guarantees columns exist
    const allMovies = db.prepare('SELECT tmdb_id, title, description, genres, keywords, providers, production_companies FROM movie_metadata ORDER BY popularity DESC').all();
    const movieCandidates = allMovies.filter(hasMissingData).map(m => m.tmdb_id);

    // 2. Find candidates (TV)
    const allTv = db.prepare('SELECT tmdb_id, name as title, description, genres, keywords, providers, production_companies FROM tv_metadata ORDER BY popularity DESC').all();
    const tvCandidates = allTv.filter(hasMissingData).map(t => t.tmdb_id);

    console.log(`[Backfill] Found candidates -> Movies: ${movieCandidates.length}, TV: ${tvCandidates.length}`);

    if (movieCandidates.length === 0 && tvCandidates.length === 0) {
        console.log('[Backfill] No items need backfilling.');
        // Even if no backfill, run harmonization/AI/collections to be safe? 
        // Let's just fall through to the end logic to ensure consistency.
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

    // Run Harmonization to ensure descriptions are translated
    console.log('[Backfill] Running Harmonization to force Italian translations...');
    await harmonize('movie_metadata', 'movie', console.log);
    await harmonize('tv_metadata', 'tv', console.log);
    console.log('[Backfill] Harmonization Complete.');

    // Run AI Catalog Update
    console.log('[Backfill] Running AI Catalog Update (Animal Terror, Virus, etc.)...');
    await aiCatalogUpdater.run();
    console.log('[Backfill] AI Catalog Update Complete.');

    // Regenerate Collection Caches
    console.log('[Backfill] Regenerating Collection Caches...');
    try {
        // Movie Collections (by popularity)
        const collections = collectionsCatalog.getMovieCollections();
        // Re-fetch all movies to ensure we have latest data
        const allMoviesRefresh = movieRepo.find('collection_id IS NOT NULL', [], 100000);
        const moviesByCollection = {};
        for (const movie of allMoviesRefresh) {
            if (!moviesByCollection[movie.collection_id]) moviesByCollection[movie.collection_id] = [];
            moviesByCollection[movie.collection_id].push(movie);
        }
        const metas = collections.map(col => {
            const items = moviesByCollection[col.id] || [];
            return buildCollectionMeta(col, items);
        });
        fs.writeFileSync(CACHE_MOVIE_COLLECTIONS, JSON.stringify({ metas }, null, 2));
        console.log(`[Backfill] cache-moviecollections.json written (${metas.length} collections)`);

        // New Releases in Collections
        const newReleases = collectionsCatalog.getNewReleaseCollections();
        const metas2 = newReleases.map(col => {
            const items = moviesByCollection[col.id] || [];
            return buildCollectionMeta(col, items);
        });
        fs.writeFileSync(CACHE_NEW_RELEASES, JSON.stringify({ metas: metas2 }, null, 2));
        console.log(`[Backfill] cache-newreleases.json written (${metas2.length} collections)`);

    } catch (e) {
        console.error(`[Backfill] ERROR writing collection caches: ${e.message}`);
    }
}

backfill().then(() => {
    closeDatabase();
    process.exit(0);
}).catch(err => {
    console.error(err);
    closeDatabase();
    process.exit(1);
});
