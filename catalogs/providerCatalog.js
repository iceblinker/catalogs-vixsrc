// Provider catalog logic for vixsrc_provider_movie and vixsrc_provider_series
// Exports a function that takes (params, db, utils) and returns metas array

module.exports = async function providerCatalog({ type, id, extra, skip, TMDB_SERIES_GENRE_MAP, PROVIDER_CATALOG_MAP, toMetaPreview, fullMeta, log, db }) {
    // Provider catalog logic migrated from index-advanced.js
    // Handles vixsrc_provider_movie and vixsrc_provider_series
    const isSeries = type === 'series';
    const table = isSeries ? 'tv_metadata' : 'movie_metadata';
    const provider = extra.provider;
    if (!provider) return [];
    let where = `WHERE providers LIKE '%${provider}%'`;
    let params = [];
    if (extra.genre) {
        if (TMDB_SERIES_GENRE_MAP && TMDB_SERIES_GENRE_MAP[extra.genre]) {
            where += ` AND genres LIKE ?`;
            params.push(`%${TMDB_SERIES_GENRE_MAP[extra.genre]}%`);
        } else {
            where += ` AND genres LIKE ?`;
            params.push(`%${extra.genre}%`);
        }
    }
    if (extra.search) {
        where += ` AND (title LIKE ? OR original_title LIKE ?)`;
        params.push(`%${extra.search}%`, `%${extra.search}%`);
    }
    const rows = db.prepare(`SELECT * FROM ${table} ${where} LIMIT 100 OFFSET ?`).all(...params, skip);
    return rows.map(r => toMetaPreview(r, type));
};
