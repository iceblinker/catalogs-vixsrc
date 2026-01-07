/**
 * Ensures the database schema is up to date.
 * @param {import('better-sqlite3').Database} db 
 */
function ensureSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS skipped_tmdb_ids (tmdb_id INTEGER PRIMARY KEY, reason TEXT, last_attempt TEXT, catalog_name TEXT);
    CREATE TABLE IF NOT EXISTS movie_metadata (
        tmdb_id INTEGER PRIMARY KEY, imdb_id TEXT, title TEXT, name TEXT, release_year INTEGER,
        first_air_year INTEGER, genres TEXT, rating REAL, director TEXT, cast TEXT, trailers TEXT,
        logo_path TEXT, background_path TEXT, poster_path TEXT, runtime INTEGER, description TEXT,
        keywords TEXT, writers TEXT, countries TEXT, original_title TEXT, popularity REAL, decade TEXT,
        genre_ids TEXT, status TEXT, release_date TEXT, seasons TEXT, last_episode_to_air TEXT,
        next_episode_to_air TEXT, watch_providers TEXT, collection_id INTEGER, collection_name TEXT,
        belongs_to_collection TEXT, adult BOOLEAN, budget INTEGER, revenue INTEGER, tagline TEXT,
        video BOOLEAN, vote_count INTEGER, catalog_names TEXT, primary_catalog TEXT, providers TEXT,
        provider_catalog_names TEXT,
        actual_type TEXT
    );
    CREATE TABLE IF NOT EXISTS tv_metadata (
        tmdb_id INTEGER PRIMARY KEY, imdb_id TEXT, title TEXT, name TEXT, release_year INTEGER,
        first_air_year INTEGER, genres TEXT, rating REAL, director TEXT, cast TEXT, trailers TEXT,
        logo_path TEXT, background_path TEXT, poster_path TEXT, runtime INTEGER, description TEXT,
        keywords TEXT, writers TEXT, countries TEXT, original_title TEXT, popularity REAL, decade TEXT,
        genre_ids TEXT, status TEXT, release_date TEXT, seasons TEXT, last_episode_to_air TEXT,
        next_episode_to_air TEXT, watch_providers TEXT, created_by TEXT, episode_run_time TEXT,
        in_production BOOLEAN, languages TEXT, last_air_date TEXT, networks TEXT, number_of_episodes INTEGER,
        number_of_seasons INTEGER, origin_country TEXT, production_companies TEXT, type TEXT,
        vote_count INTEGER, catalog_names TEXT, primary_catalog TEXT, providers TEXT,
        provider_catalog_names TEXT,
        actual_type TEXT
    );
    CREATE TABLE IF NOT EXISTS collections (id INTEGER PRIMARY KEY, name TEXT, overview TEXT, poster_path TEXT, backdrop_path TEXT, parts TEXT);
    CREATE TABLE IF NOT EXISTS tmdb_cache (
        key TEXT PRIMARY KEY,
        data TEXT,
        timestamp INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_movie_collection ON movie_metadata(collection_id);
    CREATE INDEX IF NOT EXISTS idx_movie_release ON movie_metadata(release_date);
    CREATE INDEX IF NOT EXISTS idx_tv_release ON tv_metadata(release_date);
    CREATE INDEX IF NOT EXISTS idx_tv_last_air ON tv_metadata(last_air_date);
    CREATE INDEX IF NOT EXISTS idx_movie_popularity ON movie_metadata(popularity);
    CREATE INDEX IF NOT EXISTS idx_tv_popularity ON tv_metadata(popularity);
    `);

    // Migrations: Add new columns if missing
    try {
        db.prepare('ALTER TABLE movie_metadata ADD COLUMN provider_catalog_names TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
    try {
        db.prepare('ALTER TABLE movie_metadata ADD COLUMN production_companies TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
    try {
        db.prepare('ALTER TABLE tv_metadata ADD COLUMN provider_catalog_names TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }

    // Updated At / Created At
    try {
        db.prepare('ALTER TABLE movie_metadata ADD COLUMN updated_at TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
    try {
        db.prepare('ALTER TABLE movie_metadata ADD COLUMN created_at TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
    try {
        db.prepare('ALTER TABLE tv_metadata ADD COLUMN updated_at TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
    try {
        db.prepare('ALTER TABLE tv_metadata ADD COLUMN created_at TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }

    // Episodes (Custom Metadata)
    try {
        db.prepare('ALTER TABLE movie_metadata ADD COLUMN episodes TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
    try {
        db.prepare('ALTER TABLE tv_metadata ADD COLUMN episodes TEXT').run();
    } catch (e) { if (!/duplicate/i.test(e.message)) throw e; }
}

module.exports = { ensureSchema };
