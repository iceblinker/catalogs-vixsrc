const { getDatabase, closeDatabase } = require('../lib/db');
const { SPECIAL_GENRE_CONFIG } = require('../config/constants');

function backfill(table, type) {
    console.log(`\n--- Backfilling ${table} (${type}) ---`);
    const db = getDatabase();
    const rows = db.prepare(`SELECT tmdb_id, title, genres, keywords, rating FROM ${table}`).all();
    let updatedCount = 0;

    const stmt = db.prepare(`UPDATE ${table} SET genres = ? WHERE tmdb_id = ?`);

    for (const row of rows) {
        let genres = [];
        try {
            genres = JSON.parse(row.genres || '[]');
        } catch (e) { continue; }

        let keywords = [];
        try {
            keywords = JSON.parse(row.keywords || '[]');
        } catch (e) { continue; }

        const keywordStrings = keywords.map(k => (k.name || '').toLowerCase());
        let changed = false;

        for (const [specialGenre, config] of Object.entries(SPECIAL_GENRE_CONFIG)) {
            // Skip if rating not met
            if (config.minRating && (row.rating || 0) < config.minRating) continue;

            // Check validTypes
            if (config.validTypes && !config.validTypes.includes(type)) continue;

            // Check requiredGenres
            if (config.requiredGenres) {
                const currentGenreNames = genres.map(g => g.name || g);
                const hasRequired = config.requiredGenres.some(req => currentGenreNames.includes(req));
                if (!hasRequired) continue;
            }

            // Check keywords
            const hasKeyword = config.keywords.some(k => keywordStrings.some(ks => ks.includes(k.toLowerCase())));

            if (hasKeyword) {
                // Check extra exclusions
                if (config.extraExclusions) {
                    const genreNames = genres.map(g => (g.name || g).toLowerCase());
                    const hasExcluded = config.extraExclusions.some(ex => genreNames.some(gn => gn.includes(ex.toLowerCase())));
                    if (hasExcluded) continue;
                }

                // Check if already present
                if (!genres.some(g => (g.name || g) === specialGenre)) {
                    genres.push({ id: 0, name: specialGenre });
                    changed = true;
                    // console.log(`[${type}] Adding "${specialGenre}" to "${row.title}"`);
                }
            }
        }

        if (changed) {
            stmt.run(JSON.stringify(genres), row.tmdb_id);
            updatedCount++;
            if (updatedCount % 100 === 0) process.stdout.write('.');
        }
    }
    console.log(`\nUpdated ${updatedCount} rows in ${table}.`);
}

function run() {
    try {
        backfill('movie_metadata', 'movie');
        backfill('tv_metadata', 'tv');
    } catch (e) {
        console.error(e);
    } finally {
        closeDatabase();
    }
}

run();
