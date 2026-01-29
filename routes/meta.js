const express = require('express');
const router = express.Router({ mergeParams: true });
const movieRepo = require('../lib/db/repositories/movieRepository');
const tvRepo = require('../lib/db/repositories/tvRepository');
const collectionsCatalog = require('../collectionsCatalog');
const { fullMeta, buildCollectionMeta } = require('../services/metaService');
const cache = require('../lib/cache');

function parseConfig(configStr) {
    if (!configStr) return {};
    return configStr.split('|').reduce((acc, pair) => {
        const [k, v] = pair.split('=');
        if (k && v) acc[k] = v;
        return acc;
    }, {});
}

router.get('/:type/:id.json', async (req, res) => {
    const { type, id, config } = req.params;
    const configObj = parseConfig(config);
    const language = configObj.language || 'it-IT'; // Default for cache key

    // Cache Key (include language/config in key)
    const cacheKey = `meta:${type}:${id}:${language}:${configObj.rpdb_key || ''}`;

    // Try Cache
    const cached = await cache.get(cacheKey);
    if (cached) return res.send({ meta: cached });

    // Collection Meta
    if (id.startsWith('ctmdb.')) {
        const colId = id.replace('ctmdb.', '').replace('collection:', '');
        let collection = collectionsCatalog.getMovieCollections().find(c => String(c.tmdb_id) === colId || String(c.id) === colId);
        if (!collection) collection = collectionsCatalog.getNewReleaseCollections().find(c => String(c.tmdb_id) === colId || String(c.id) === colId);

        if (!collection) return res.status(404).send({ err: 'Meta not found' });
        if (!collection.tmdb_id && collection.id) collection.tmdb_id = collection.id;

        let items;
        if (type === 'series') {
            items = tvRepo.getByCollectionId(collection.id);
        } else {
            items = collectionsCatalog.getCollectionItems(collection.id).filter(row => (row.type === 'movie' || row.type === 'Movie' || row.media_type === 'movie'));
        }
        const meta = buildCollectionMeta(collection, items);

        // Cache and Send
        await cache.set(cacheKey, meta, 3600);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        return res.send({ meta });
    }

    // Standard Meta
    try {
        const { getMeta } = require('../services/metaService');
        const meta = await getMeta(type, id, configObj);

        if (!meta) return res.status(404).send({ err: 'Meta not found' });

        // Cache and Send
        await cache.set(cacheKey, meta, 3600);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.send({ meta });
    } catch (e) {
        console.error(`[MetaRoute] Error: ${e.message}`);
        res.status(500).send({ err: 'Internal Server Error' });
    }


});

module.exports = router;
