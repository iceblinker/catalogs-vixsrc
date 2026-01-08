#!/usr/bin/env node
/*  update-vixsrc-catalog.js  – enriches VixSrc IDs with Italian TMDB data
    Features: verbose log, movie↔tv fallback, keyword catalogs, full ISO dates, collections
    Triggers specialgenres-catalog-fetch.js at start to update special genres from streamingunity
*/

require('dotenv').config();
console.log('SCRIPT STARTED');
console.log('TMDB_API_KEY present:', !!process.env.TMDB_API_KEY);

const fs = require('fs');
const path = require('path');

// --- Centralized Config ---
const {
    TMDB_API_KEY,
    UPDATE_LOG_FILE,
    UPDATE_HISTORY_PATH,
    UPDATE_STATUS_PATH,
    CATALOG_NAME,
    CACHE_NUOVI_EPISODI,
    CACHE_MOVIE_COLLECTIONS,
    CACHE_NEW_RELEASES
} = require('./config/settings');

// --- Repositories & DB ---
const { getDatabase, closeDatabase } = require('./lib/db');
const { ensureSchema } = require('./lib/db/schema');
const movieRepo = require('./lib/db/repositories/movieRepository');
const tvRepo = require('./lib/db/repositories/tvRepository');
const skippedRepo = require('./lib/db/repositories/skippedRepository');

// --- Services ---
// const { updateSpecialGenres } = require('./services/ingestion/specialGenres');
const { harmonize } = require('./services/ingestion/harmonizer');
const { fetchTMDB } = require('./services/ingestion/tmdbClient');
const { fetchVixIds } = require('./services/ingestion/vixsrcClient');
const { processList, mapCommon } = require('./services/ingestion/processor');
const { buildCollectionMeta } = require('./services/metaService');
const collectionsCatalog = require('./stream-provider/collectionsCatalog');
const { fork } = require('child_process');

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!TMDB_API_KEY) throw new Error('TMDB_API_KEY missing');

const CURRENT_CATALOG = CATALOG_NAME;
const LOG_FILE = UPDATE_LOG_FILE;

const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, line + '\n');
    } catch (e) {
        if (e.code === 'EBUSY') {
            // Silently ignore file lock errors
        } else {
            throw e;
        }
    }
};

// Initialize DB and Schema
const db = getDatabase();
try {
    console.log('Running ensureSchema...');
    ensureSchema(db);
    console.log('ensureSchema done.');
} catch (e) {
    console.error('ensureSchema FAILED:', e);
    process.exit(1);
}

/* ---------- MAIN UPDATE -------------------------------------------- */
async function updateCatalog() {
    // --- EPISODE BACKFILL LOGIC ---
    log('[Backfill]  Fetching VixSrc episode list for backfill …');
    let backfillAdded = 0, backfillSkipped = 0, backfillErrors = 0;
    try {
        const res = await fetch('https://vixsrc.to/api/list/episode/?lang=it', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`VixSrc ${res.status} ${res.statusText}`);
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('Body is not array');
        let ids = body.map(o => o.tmdb_id).filter(id => id !== null && id !== undefined);
        ids = Array.from(new Set(ids));
        log(`[Backfill]  ${ids.length} unique episode TMDB IDs fetched`);
        const existingTv = new Set(tvRepo.getAllIds().map(id => id.toString()));
        for (const id of ids) {
            if (existingTv.has(id.toString())) {
                backfillSkipped++;
                continue;
            }
            await sleep(333);
            // Use fetchTMDB from service
            const details = await fetchTMDB(id, 'tv', log);
            if (!details || !details.details) { backfillErrors++; continue; }
            try {
                // Use mapCommon from service
                const item = mapCommon(details.details, details.details.credits?.crew || [], 'tv');
                tvRepo.save(item);
                backfillAdded++;
                log(`[Backfill]  ADDED  ${item.title}  (ID: ${id})`);
            } catch (err) {
                backfillErrors++;
                log(`[Backfill]  SQL ERROR ${id}: ${err.message}`);
            }
        }
        log(`[Backfill]  END  added:${backfillAdded}  skipped:${backfillSkipped}  errors:${backfillErrors}`);
    } catch (err) {
        log(`[Backfill]  FATAL: ${err.message}`);
    }
    const start = Date.now();
    log('[Update]  START');
    const status = { started: new Date().toISOString(), status: 'running' };
    fs.writeFileSync(UPDATE_STATUS_PATH, JSON.stringify(status, null, 2));

    const existingMovies = new Set(movieRepo.getAllIds().map(id => id.toString()));
    const existingTv = new Set(tvRepo.getAllIds().map(id => id.toString()));
    const existing = new Set([...existingMovies, ...existingTv]);

    log('[Update]  Fetching VixSrc lists …');
    const movieIds = await fetchVixIds('https://vixsrc.to/api/list/movie/?lang=it', existing, log);
    const tvIds = await fetchVixIds('https://vixsrc.to/api/list/tv/?lang=it', existing, log);
    const epIds = await fetchVixIds('https://vixsrc.to/api/list/episode/?lang=it', existing, log);

    // Always cache 200 unique episode TMDB IDs from the VixSrc episode endpoint (raw, before any filtering)
    try {
        const res = await fetch('https://vixsrc.to/api/list/episode/?lang=it', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`VixSrc ${res.status} ${res.statusText}`);
        const body = await res.json();
        if (!Array.isArray(body)) throw new Error('Body is not array');
        let rawEpIds = body.map(o => o.tmdb_id).filter(id => id !== null && id !== undefined);
        rawEpIds = Array.from(new Set(rawEpIds)).slice(0, 200);
        const nuoviEpisodiCachePath = CACHE_NUOVI_EPISODI;
        fs.writeFileSync(nuoviEpisodiCachePath, JSON.stringify({ ids: rawEpIds, timestamp: new Date().toISOString() }, null, 2));
        if (rawEpIds.length === 0) {
            log('[Update]  WARNING: Nuovi Episodi cache written but is empty!');
        } else {
            log(`[Update]  Nuovi Episodi cache written with ${rawEpIds.length} ids: [${rawEpIds.join(', ')}]`);
        }
    } catch (e) {
        log(`[Update]  ERROR writing Nuovi Episodi cache: ${e.message}`);
    }

    log(`[Update]  Processing ${movieIds.length} movies, ${tvIds.length} series, ${epIds.length} episodes`);
    const mStats = movieIds.length ? await processList(movieIds, 'movie', log) : {};
    const tStats = tvIds.length ? await processList(tvIds, 'tv', log) : {};
    const eStats = epIds.length ? await processList(epIds, 'tv', log) : {};

    // Gather skipped IDs from all processList runs
    const skippedIds = [];
    for (const stats of [mStats, tStats, eStats]) {
        if (stats && stats.log) {
            for (const entry of stats.log) {
                if (entry.result && entry.result.startsWith('skipped_404')) {
                    skippedIds.push(entry.tmdbId);
                }
            }
        }
    }

    const stats = {
        timestamp: new Date().toISOString(),
        duration: ((Date.now() - start) / 1000).toFixed(2) + 's',
        catalog: CURRENT_CATALOG,
        addedMovies: (mStats.movie || 0) + (eStats.movie || 0),
        addedTv: (tStats.tv || 0) + (eStats.tv || 0),
        skipped: (mStats.skipped || 0) + (tStats.skipped || 0) + (eStats.skipped || 0),
        already: (mStats.already || 0) + (tStats.already || 0) + (eStats.already || 0),
        errors: [...(mStats.errors || []), ...(tStats.errors || []), ...(eStats.errors || [])],
        log: [...(mStats.log || []), ...(tStats.log || []), ...(eStats.log || [])]
    };
    if (skippedIds.length > 0) {
        log(`[Update]  Skipped TMDB IDs (not found in tv or movie): [${skippedIds.join(', ')}]`);
    }
    log(`[Update]  END  duration:${stats.duration}  added-movie:${stats.addedMovies}  added-tv:${stats.addedTv}  skipped:${stats.skipped}  already:${stats.already}  errors:${stats.errors.length}`);

    // BYPASS UPDATE HISTORY LOGIC TO PREVENT ENOENT CRASH
    // const hist = JSON.parse(fs.readFileSync(UPDATE_HISTORY_PATH, 'utf8') || '[]');
    // fs.writeFileSync(UPDATE_HISTORY_PATH, JSON.stringify([stats, ...hist].slice(0, 50), null, 2));
    log('[Update] History update bypassed to prevent crash.');

    fs.writeFileSync(UPDATE_STATUS_PATH, JSON.stringify({ ...status, status: 'success', completed: new Date().toISOString() }, null, 2));

    // --- Write collection catalog caches for instant loading ---
    try {
        // Movie Collections (by popularity)
        const collections = collectionsCatalog.getMovieCollections();
        const allMovies = movieRepo.find('collection_id IS NOT NULL', [], 100000);
        const moviesByCollection = {};
        for (const movie of allMovies) {
            if (!moviesByCollection[movie.collection_id]) moviesByCollection[movie.collection_id] = [];
            moviesByCollection[movie.collection_id].push(movie);
        }
        const metas = collections.map(col => {
            const items = moviesByCollection[col.id] || [];
            return buildCollectionMeta(col, items);
        });
        fs.writeFileSync(CACHE_MOVIE_COLLECTIONS, JSON.stringify({ metas }, null, 2));
        log(`[Cache] cache-moviecollections.json written (${metas.length} collections)`);

        // New Releases in Collections (by last movie release)
        const newReleases = collectionsCatalog.getNewReleaseCollections();
        const metas2 = newReleases.map(col => {
            const items = moviesByCollection[col.id] || [];
            return buildCollectionMeta(col, items);
        });
        fs.writeFileSync(CACHE_NEW_RELEASES, JSON.stringify({ metas: metas2 }, null, 2));
        log(`[Cache] cache-newreleases.json written (${metas2.length} collections)`);
    } catch (e) {
        log(`[Cache] ERROR writing collection caches: ${e.message}`);
    }
    fs.writeFileSync(UPDATE_STATUS_PATH, JSON.stringify({ ...status, status: 'success', completed: new Date().toISOString() }, null, 2));
}

/* ---------- ENTRY ---------------------------------------------------- */

// Harmonize streamingunity metadata
// Trigger Stealth Scraper first, then harmonize, then update catalog
log('[StealthScraper] Starting StreamingUnity scrape...');
const { runAllScrapers } = require('./services/ingestion/streamingUnityScraper');

runAllScrapers(log)
    .then(() => {
        log('[StealthScraper] Done.');
        log('[Harmonize] Starting harmonization...');
        return Promise.all([
            harmonize('movie_metadata', 'movie', log),
            harmonize('tv_metadata', 'tv', log)
        ]);
    })
    .then(() => {
        log('[Harmonize] Done.');
        return updateCatalog();
    })
    .catch(err => {
        log(`[FATAL] ${err.message}`);
        fs.writeFileSync(UPDATE_STATUS_PATH, JSON.stringify({ status: 'failed', error: err.message, completed: new Date().toISOString() }, null, 2));
        process.exit(1);
    })
    .finally(() => closeDatabase());