const express = require('express');
const router = express.Router();
const { getCatalogItems } = require('../services/catalogService');

const querystring = require('querystring');

router.get('/:type/:id/:extra?.json', async (req, res) => {
    try {
        const { type, id, extra } = req.params;
        // Parse extra parameters from path (e.g. "genre=Action&skip=20")
        // If extra is undefined, use empty object
        // Fix: Escape '+' to '%2B' so querystring doesn't treat it as space (e.g. "Apple TV+")
        const extraObj = extra ? querystring.parse(extra.replace(/\+/g, '%2B')) : {};

        const result = await getCatalogItems(type, id, extraObj);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.send(result);
    } catch (e) {
        console.error(`[Catalog] Error: ${e.message}`);
        res.status(500).send({ metas: [] });
    }
});

module.exports = router;
