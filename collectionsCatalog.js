// collectionsCatalog.js
// Modular Collections Catalog for Stremio Addon
// Handles grouping movie collections by genre, syncing with TMDB, and updating posters/backgrounds

const { getDatabase } = require('./lib/db');
const axios = require('axios');
const TMDB_API_KEY = process.env.TMDB_API_KEY || 'YOUR_TMDB_API_KEY';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

// const path = require('path');
// const dbPath = process.env.DB_PATH || path.join(__dirname, 'catalog.db');
// const db = new Database(dbPath);

// Ensure collections table has poster/background columns
function ensureCollectionsTable() {
    getDatabase().prepare(`CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY,
        name TEXT,
        genre TEXT
    )`).run();
    // Add columns if missing
    try { getDatabase().prepare('ALTER TABLE collections ADD COLUMN tmdb_id INTEGER').run(); } catch (e) { }
    try { getDatabase().prepare('ALTER TABLE collections ADD COLUMN poster TEXT').run(); } catch (e) { }
    try { getDatabase().prepare('ALTER TABLE collections ADD COLUMN background TEXT').run(); } catch (e) { }
}

// Sync collection posters/backgrounds from TMDB
async function syncCollectionImages() {
    const collections = getDatabase().prepare('SELECT id, tmdb_id FROM collections WHERE poster IS NULL OR background IS NULL').all();
    for (const col of collections) {
        if (!col.tmdb_id) continue;
        try {
            const url = `${TMDB_BASE_URL}/collection/${col.tmdb_id}?api_key=${TMDB_API_KEY}&language=it-IT`;
            const resp = await axios.get(url);
            const { poster_path, backdrop_path } = resp.data;
            getDatabase().prepare('UPDATE collections SET poster = ?, background = ? WHERE id = ?')
                .run(
                    poster_path ? TMDB_IMAGE_BASE + poster_path : null,
                    backdrop_path ? TMDB_IMAGE_BASE + backdrop_path : null,
                    col.id
                );
        } catch (e) {
            console.error('TMDB sync error for collection', col.tmdb_id, e.message);
        }
    }
}

// Get all collections, sorted by popularity (number of movies in collection)
function getMovieCollections() {
    return getDatabase().prepare(`
        SELECT c.*, COUNT(m.tmdb_id) as movie_count
        FROM collections c
        LEFT JOIN movie_metadata m ON m.collection_id = c.id
        GROUP BY c.id
        ORDER BY movie_count DESC
    `).all();
}

// Get all collections, sorted by release date of last movie in collection (descending)
function getNewReleaseCollections() {
    return getDatabase().prepare(`
        SELECT c.*, MAX(m.release_date) as last_release
        FROM collections c
        LEFT JOIN movie_metadata m ON m.collection_id = c.id
        GROUP BY c.id
        ORDER BY last_release DESC
    `).all();
}

// Get a single collection by ID
function getCollectionById(id) {
    return getDatabase().prepare('SELECT * FROM collections WHERE id = ?').get(id);
}

// Get all items (movies) in a collection
function getCollectionItems(id) {
    // Accept both 'ctmdb.NUM' and 'NUM' as input, always use numeric for DB
    const numericId = String(id).replace(/^ctmdb\./, '');
    // DEBUG: Log the collectionId used for lookup
    console.log('[DEBUG] getCollectionItems called with collectionId:', id, 'numericId:', numericId);
    const stmt = getDatabase().prepare('SELECT * FROM movie_metadata WHERE collection_id = ? ORDER BY release_date ASC');
    // DEBUG: Log the SQL query and parameter
    console.log('[DEBUG] SQL:', stmt.source, 'PARAM:', numericId);
    const items = stmt.all(numericId);
    // DEBUG: Log the number of items returned
    console.log('[DEBUG] getCollectionItems returned', items.length, 'items for collectionId:', id);
    return items;
}

module.exports = {
    ensureCollectionsTable,
    syncCollectionImages,
    getMovieCollections,
    getNewReleaseCollections,
    getCollectionById,
    getCollectionItems
};
