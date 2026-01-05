// Collection catalog logic for vixsrc_collections and vixsrc_collection_items
// Exports a function that takes (params, db, utils) and returns metas array

module.exports = async function collectionCatalog({ type, id, extra, skip, toMetaPreview, fullMeta, log, db }) {
    // Collection catalog logic migrated from index-advanced.js
    // Handles vixsrc_collections and vixsrc_collection_items
    if (id === 'vixsrc_collections') {
        // Return a list of available collections
        const rows = db.prepare(`SELECT DISTINCT collection_id, collection_name FROM collection_metadata ORDER BY collection_name`).all();
        return rows.map(r => ({
            id: `collection:${r.collection_id}`,
            name: r.collection_name,
            type: 'series',
            poster: null
        }));
    } else if (id === 'vixsrc_collection_items' && extra.collection_id) {
        // Return items in a specific collection
        const rows = db.prepare(`SELECT * FROM collection_metadata WHERE collection_id = ? LIMIT 100 OFFSET ?`).all(extra.collection_id, skip);
        return rows.map(r => toMetaPreview(r, type));
    }
    return [];
};
