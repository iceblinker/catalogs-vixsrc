const express = require('express');
const router = express.Router();
const settings = require('../config/settings');
const fetch = require('node-fetch');

// Helper for RealDebrid
async function resolveRealDebrid(hash, fileIdx) {
    const apiKey = settings.REALDEBRID_API_KEY;
    if (!apiKey) throw new Error('RealDebrid API Key not configured');

    // 1. Add Magnet
    const addUrl = `https://api.real-debrid.com/rest/1.0/torrents/addMagnet`;
    const addRes = await fetch(addUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: new URLSearchParams({ magnet: `magnet:?xt=urn:btih:${hash}` })
    });
    const addData = await addRes.json();
    if (!addData.id) throw new Error('Failed to add torrent to RealDebrid');

    // 2. Select File (or all)
    // If fileIdx is not provided, we might need to select 'all' or guess.
    // For cached content, usually selecting 'all' is instant.
    const selectUrl = `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${addData.id}`;
    await fetch(selectUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: new URLSearchParams({ files: 'all' })
    });

    // 3. Get Torrent Info to find the link
    const infoUrl = `https://api.real-debrid.com/rest/1.0/torrents/info/${addData.id}`;
    const infoRes = await fetch(infoUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    const infoData = await infoRes.json();

    if (!infoData.links || infoData.links.length === 0) throw new Error('No links found in RealDebrid torrent');

    // If fileIdx is provided, try to match it. Otherwise take the largest or first.
    // RealDebrid 'links' array corresponds to 'files' array where selected=1.
    // This mapping can be tricky. For now, let's take the first link or largest file's link.
    const linkToUnrestrict = infoData.links[0];

    // 4. Unrestrict Link
    const unrestrictUrl = `https://api.real-debrid.com/rest/1.0/unrestrict/link`;
    const unrestrictRes = await fetch(unrestrictUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: new URLSearchParams({ link: linkToUnrestrict })
    });
    const unrestrictData = await unrestrictRes.json();

    if (!unrestrictData.download) throw new Error('Failed to unrestrict link');
    return unrestrictData.download;
}

// Helper for TorBox
async function resolveTorBox(hash, fileIdx) {
    const apiKey = settings.TORBOX_API_KEY;
    if (!apiKey) throw new Error('TorBox API Key not configured');

    // TorBox flow: Request -> It returns cached status -> If cached, it might give link or we need to "control" it.
    // Actually TorBox has a simpler "instant" flow for cached items?
    // Let's use the /torrents/controltorrent endpoint or similar.

    // 1. Add Magnet (even if cached, adding it puts it in your list)
    const addUrl = `https://api.torbox.app/v1/api/torrents/createtorrent`;
    const formData = new URLSearchParams();
    formData.append('magnet', `magnet:?xt=urn:btih:${hash}`);
    formData.append('seed', '1');
    formData.append('allow_zip', 'false');

    const addRes = await fetch(addUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
    });
    const addData = await addRes.json();

    // If successful, we need to find the file link.
    // TorBox returns the torrent_id.
    const torrentId = addData.data ? addData.data.torrent_id : null;
    if (!torrentId) throw new Error('Failed to add torrent to TorBox');

    // 2. Get Torrent Info
    // We might need to wait a second if it's "processing" even if cached.
    // But for cached, it should be "completed" or "seeding" instantly.
    const infoUrl = `https://api.torbox.app/v1/api/torrents/mylist?id=${torrentId}`;
    const infoRes = await fetch(infoUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    const infoData = await infoRes.json();

    if (!infoData.data) throw new Error('Failed to get TorBox torrent info');

    // Find the file
    const files = infoData.data.files;
    if (!files || files.length === 0) throw new Error('No files in TorBox torrent');

    // Return the download URL of the first file (or match fileIdx)
    return files[0].url;
}

router.get('/:service/:hash/:fileIdx?', async (req, res) => {
    const { service, hash, fileIdx } = req.params;

    try {
        let downloadUrl;
        if (service === 'realdebrid') {
            downloadUrl = await resolveRealDebrid(hash, fileIdx);
        } else if (service === 'torbox') {
            downloadUrl = await resolveTorBox(hash, fileIdx);
        } else {
            throw new Error('Unknown service');
        }

        // Redirect to the actual video file
        res.redirect(downloadUrl);
    } catch (e) {
        console.error(`[Play] Error resolving ${service} link for ${hash}: ${e.message}`);
        res.status(500).send(`Error: ${e.message}`);
    }
});

module.exports = router;
