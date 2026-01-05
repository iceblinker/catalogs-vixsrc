const express = require('express');
const router = express.Router();
const { getStreams } = require('../services/streams/streamService');
const { createDebridServices } = require('../services/streams/debrid');
const metaService = require('../services/metaService'); // You might need to adjust this path/service
const settings = require('../config/settings');

// Stremio Stream Endpoint
router.get('/:type/:id.json', async (req, res) => {
    const { type, id } = req.params;

    // Only handle movie and series
    if (!['movie', 'series'].includes(type)) {
        return res.json({ streams: [] });
    }

    try {
        // 1. Get Metadata (Title)
        let meta = await metaService.getMeta(type, id);
        if (!meta || !meta.name) {
            console.log(`[StreamRoute] Meta not found for ${id}`);
            return res.json({ streams: [] });
        }

        // 2. Get Streams
        const host = req.headers.host;
        const [imdbId, season, episode] = id.split(':');
        const streams = await getStreams(meta, type, host, season, episode);

        // 3. Cache headers (important for Stremio)
        if (!res.headersSent) {
            res.setHeader('Cache-Control', 'max-age=3600'); // Cache for 1 hour
            res.json({ streams });
        }

    } catch (e) {
        console.error(`[StreamRoute] Error: ${e.message}`);
        if (!res.headersSent) {
            res.json({ streams: [] });
        }
    }
});

// Resolve Endpoint (Debrid/Magnet)
router.get('/resolve/:method/:hash', async (req, res) => {
    const { method, hash } = req.params;
    const { service, magnet } = req.query;

    try {
        if (method === 'p2p') {
            // Just redirect to magnet
            return res.redirect(magnet);
        }

        if (method === 'debrid' && service) {
            const debridServices = createDebridServices();
            let link = null;

            if (service === 'Real-Debrid' && debridServices.realdebrid) {
                const rd = debridServices.realdebrid;
                const added = await rd.addMagnet(magnet);
                if (added && added.id) {
                    await rd.selectFiles(added.id, 'all');
                    const info = await rd.getTorrentInfo(added.id);
                    if (info && info.links && info.links.length > 0) {
                        // Unrestrict the first link (usually the video)
                        const unrestricted = await rd.unrestrictLink(info.links[0]);
                        link = unrestricted.download;
                    }
                }
            }
            else if (service === 'Torbox' && debridServices.torbox) {
                const tb = debridServices.torbox;
                const added = await tb.addMagnet(magnet);
                // Torbox usually returns the torrent info immediately or we need to check status.
                // If cached, it should be ready.
                // Torbox API flow might differ.
                // For now, let's assume we can get a link or it's complex.
                // Simplified: Just redirect to magnet if we fail?
            }
            else if (service === 'AllDebrid' && debridServices.alldebrid) {
                const ad = debridServices.alldebrid;
                const added = await ad.addMagnet(magnet);
                if (added.status === 'success' && added.data.magnets && added.data.magnets.length > 0) {
                    const mag = added.data.magnets[0];
                    if (mag.ready && mag.links && mag.links.length > 0) {
                        const unlocked = await ad.unrestrictLink(mag.links[0].link);
                        link = unlocked.data.link;
                    }
                }
            }

            if (link) {
                return res.redirect(link);
            }
        }

        // Fallback
        res.redirect(magnet);

    } catch (e) {
        console.error(`[StreamRoute] Resolve error: ${e.message}`);
        res.redirect(magnet); // Fallback to P2P
    }
});

module.exports = router;
