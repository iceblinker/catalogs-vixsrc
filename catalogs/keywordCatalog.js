// Keyword-based catalog logic (special genres)
// Exports a function that takes (params, db, utils) and returns metas array

module.exports = async function keywordCatalog({ type, id, extra, skip, KEYWORD_CATALOGS, toMetaPreview, fullMeta, log, db }) {
    // Keyword-based catalog logic migrated from index-advanced.js
    // Handles special genres like Animal Horror, Virus & Disease, etc.
    const isSeries = type === 'series';
    const table = isSeries ? 'tv_metadata' : 'movie_metadata';
    const genre = extra.genre;
    if (!genre || !KEYWORD_CATALOGS[genre]) return [];
    const keyword = KEYWORD_CATALOGS[genre];
    let where = `WHERE keywords LIKE ?`;
    let params = [`%${keyword}%`];
    if (extra.search) {
        where += ` AND (title LIKE ? OR original_title LIKE ?)`;
        params.push(`%${extra.search}%`, `%${extra.search}%`);
    }
    const rows = db.prepare(`SELECT * FROM ${table} ${where} LIMIT 100 OFFSET ?`).all(...params, skip);
    return rows.map(r => toMetaPreview(r, type));
};
