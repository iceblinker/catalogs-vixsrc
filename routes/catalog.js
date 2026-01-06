const express = require('express');
const router = express.Router();
const { getCatalogItems } = require('../services/catalogService');

const querystring = require('querystring');

router.get('/:type/:id/:extra?.json', async (req, res) => {
    try {
        const { type, id } = req.params;

        // Parse extra parameters robustly
        // Problem: req.params.extra is already decoded by Express.
        // If Stremio sends "genre=Sci-Fi%20%26%20Fantasy", Express turns it to "genre=Sci-Fi & Fantasy".
        // querystring.parse then sees "genre=Sci-Fi " and " Fantasy".

        // Solution: Parse from raw URL to preserve encoding structure
        // URL is like: /catalog/movie/vixsrc_movies/genre=Sci-Fi%20%26%20Fantasy.json
        // We want to extract "genre=Sci-Fi%20%26%20Fantasy" purely.

        let extraObj = {};
        const urlParts = req.url.split('/');
        // The extra parameter is the last part before extension, or the last part.
        // Format: /:type/:id/:extra.json
        // parts: ['', 'type', 'id', 'extra.json']

        // Find the part corresponding to extra. It should be after ID.
        // Express routing ensures structure matches. 
        // We can just rely on req.params.id to bail early, then grab the rest.

        // Safer way: match against ID.
        // But extracting "extra" from req.url manually is tricky if Type/ID contain slashes (unlikely).
        // Let's use the fact that we know the structure.

        const rawPath = req.url; // e.g. /movie/vixsrc_movies/genre=Sci-Fi%20%26%20Fantasy.json
        const jsonIndex = rawPath.lastIndexOf('.json');
        const pathNoExt = jsonIndex > -1 ? rawPath.substring(0, jsonIndex) : rawPath;
        const lastSlash = pathNoExt.lastIndexOf('/');

        // The extra part is everything after the last slash of the ID... wait.
        // The ID 'vixsrc_movies' is previous path segment. 
        // /movie/vixsrc_movies/genre=...
        // Finding the segment after ID is safest.

        // HOWEVER, Stremio docs say parameters are `key=value`, usually just one segment.
        // Using `querystring.parse` on the raw path segment (key=value&key2=value2) works IF we decode keys/values AFTER split.
        // But `querystring` decodes automatically.
        // The trick is: Stremio encodes the `&` INSIDE the value as `%26`.
        // `querystring.parse` correctly handles `key=value%26value` -> `key`="value&value".
        // It BREAKS if input is `key=value&value`.

        // So we MUST pass the ENCODED string to querystring.parse.
        // req.params.extra gives DECODED string. Bad.
        // We need the ENCODED extra string.

        // Let's extract it from req.originalUrl or req.url
        // req.url is relative to router mount? No, mostly full path in this setup.
        // Let's iterate segments.

        const parts = req.url.split('/'); // ['', 'movie', 'vixsrc_movies', 'genre=...']
        // We assume 3rd index (index 2? no, index 3 if starting with /) is extra.
        // But just to be robust, let's look for the part containing '='
        // Or simply the last part - extension.

        const extraPart = parts.length > 3 ? parts.slice(3).join('/') : null;
        // Join back just in case extra contained slashes (Stremio doesn't usually do that but possible)

        let rawExtra = extraPart || '';
        rawExtra = rawExtra.replace(/\.json$/, ''); // Remove extension

        if (rawExtra) {
            extraObj = querystring.parse(rawExtra);
        }

        const result = await getCatalogItems(type, id, extraObj);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.send(result);
    } catch (e) {
        console.error(`[Catalog] Error: ${e.message}`);
        res.status(500).send({ metas: [] });
    }
});

module.exports = router;
