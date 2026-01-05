const Buffer = require('buffer').Buffer;

/**
 * Utility to format streams for Debrid providers.
 * @param {Object} torrentData - The torrent information.
 * @param {string} torrentData.infoHash - The 40-char SHA1 hash.
 * @param {string} torrentData.magnet - The full magnet link.
 * @param {string} torrentData.title - The display title (e.g., "Movie (2023) 1080p").
 * @param {number} torrentData.size - File size in bytes.
 * @param {string} torrentData.filename - The filename (e.g., "movie.mkv").
 * @param {Object} context - Context about the request.
 * @param {string} context.imdbId - The IMDB ID (e.g., "tt123456").
 * @param {string} context.type - "movie" or "series".
 * @param {number|null} context.season - Season number (optional).
 * @param {number|null} context.episode - Episode number (optional).
 * @param {string} userConfigId - The user's configuration string/UUID for the service.
 */

// 1. TORBOX FORMATTER
function formatTorboxStream(torrentData, context, userConfigId) {
    // 1. Construct the Payload Array
    // Format: [InfoHash, "torrent", Magnet, QueryID, Season, Episode, AbsEp, CustomFilename]
    const queryId = `imdb_id:${context.imdbId}`;

    // Construct a magnet if the scraper didn't provide one (though infoHash is sufficient for TorBox)
    const magnet = torrentData.magnet || `magnet:?xt=urn:btih:${torrentData.infoHash}`;

    const payload = [
        torrentData.infoHash,
        "torrent",
        magnet,
        queryId,
        context.season || null,  // Season (null if movie)
        context.episode || null, // Episode (null if movie)
        false,                   // Absolute Episode (usually false)
        null                     // Custom Filename
    ];

    // 2. Base64 Encode the payload
    const jsonString = JSON.stringify(payload);
    const base64Data = Buffer.from(jsonString, 'utf8').toString('base64');

    // 3. Construct the URL
    // Pattern: https://stremio.torbox.app/{config}/new-stream-url/{base64}/{filename}
    // We encode the filename to ensure it's URL safe
    // CRITICAL: We MUST also encode the base64 data because standard base64 can contain '/' 
    // which breaks the URL path structure.
    const safeBase64 = encodeURIComponent(base64Data);
    const safeFilename = encodeURIComponent(torrentData.filename || torrentData.title || "video.mkv");
    const streamUrl = `https://stremio.torbox.app/${userConfigId}/new-stream-url/${safeBase64}/${safeFilename}`;

    // 4. Return the Stremio Stream Object parts
    return {
        url: streamUrl,
        behaviorHints: {
            notWebReady: true,
            bingeGroup: `ilcorsaronero|torbox|${torrentData.infoHash}`,
            videoSize: torrentData.size,
            filename: torrentData.filename || torrentData.title
        }
    };
}

// 2. REAL-DEBRID FORMATTER (Direct API Approach)
function formatRealDebridStream(resolvedHttpLink, torrentData) {
    return {
        url: resolvedHttpLink, // This MUST be the direct generated link from RD API
        behaviorHints: {
            notWebReady: false, // RD links are usually web-ready
            bingeGroup: `ilcorsaronero|rd|${torrentData.infoHash}`,
            videoSize: torrentData.size,
            filename: torrentData.filename || torrentData.title
        }
    };
}

module.exports = { formatTorboxStream, formatRealDebridStream };
