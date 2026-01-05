const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { buildUnifiedStreamName, providerLabel } = require('../utils/unifiedNames');
const settings = require('../../../config/settings');

const domains = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../config/domains.json'), 'utf-8'));
const VIXSRC_BASE_URL = `https://${domains.vixsrc}`; // e.g., "https://vixsrc.to"
const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

let IMDB_TO_TMDB_MAP = {};

try {
    const mappingPath = path.join(__dirname, '../../../config/imdbToTmdb.json');
    if (fs.existsSync(mappingPath)) {
        IMDB_TO_TMDB_MAP = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
        console.log(`[IMDB→TMDB] Caricato mapping statico: ${Object.keys(IMDB_TO_TMDB_MAP).length} serie`);
    }
} catch (error) {
    console.warn('[IMDB→TMDB] Impossibile caricare mapping statico:', error);
}

function getStaticTmdbMapping(imdbId, season) {
    const entry = IMDB_TO_TMDB_MAP[imdbId];
    if (!entry) return null;

    if (entry.tmdb_id && !entry.mappings) {
        console.log(`[IMDB→TMDB] Mapping statico semplice trovato: ${imdbId} → TMDB ${entry.tmdb_id} (${entry.title})`);
        return entry.tmdb_id;
    }

    const mapping = entry.mappings?.find(m => m.imdbSeason === season);
    if (mapping) {
        console.log(`[IMDB→TMDB] Mapping statico trovato: ${imdbId} S${season} → TMDB ${mapping.tmdb_id} (${entry.title})`);
        return mapping.tmdb_id;
    }

    return null;
}

function ensurePlaylistM3u8(raw) {
    try {
        if (!raw.includes('/playlist/')) return raw;
        const u = new URL(raw);
        const parts = u.pathname.split('/');
        const idx = parts.indexOf('playlist');
        if (idx === -1 || idx === parts.length - 1) return raw;
        const leaf = parts[idx + 1];
        if (/\.m3u8$/i.test(leaf) || leaf.includes('.')) return raw;
        parts[idx + 1] = leaf + '.m3u8';
        u.pathname = parts.join('/');
        return u.toString();
    } catch { return raw; }
}

function getObject(id) {
    const arr = id.split(':');
    if (arr[0] === 'tmdb') {
        return {
            id: arr[1], // actual TMDB id
            season: arr[2],
            episode: arr[3]
        };
    }
    return {
        id: arr[0], // imdb id
        season: arr[1],
        episode: arr[2]
    };
}

async function getTmdbIdFromImdbId(imdbId, tmdbApiKey, preferredType) {
    const entry = IMDB_TO_TMDB_MAP[imdbId];
    if (entry && entry.tmdb_id && !entry.mappings) {
        console.log(`[IMDB→TMDB] Mapping statico semplice usato: ${imdbId} → TMDB ${entry.tmdb_id} (${entry.title})`);
        return entry.tmdb_id;
    }

    if (!tmdbApiKey) {
        console.error("TMDB_API_KEY is not configured.");
        return null;
    }
    const findUrl = `${TMDB_API_BASE_URL}/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`;
    try {
        const response = await fetch(findUrl);
        if (!response.ok) {
            console.error(`Failed to fetch TMDB ID for ${imdbId}: ${response.status}`);
            return null;
        }
        const data = await response.json();

        const movieResults = data.movie_results || [];
        const tvResults = data.tv_results || [];

        if (preferredType === 'tv' && tvResults.length > 0) {
            console.log(`[IMDB→TMDB] Preferred TV: ${imdbId} → TMDB ${tvResults[0].id} (${tvResults[0].name})`);
            return tvResults[0].id.toString();
        } else if (preferredType === 'movie' && movieResults.length > 0) {
            console.log(`[IMDB→TMDB] Preferred Movie: ${imdbId} → TMDB ${movieResults[0].id} (${movieResults[0].title})`);
            return movieResults[0].id.toString();
        }

        if (movieResults.length > 0) {
            console.log(`[IMDB→TMDB] Fallback Movie: ${imdbId} → TMDB ${movieResults[0].id} (${movieResults[0].title})`);
            return movieResults[0].id.toString();
        } else if (tvResults.length > 0) {
            console.log(`[IMDB→TMDB] Fallback TV: ${imdbId} → TMDB ${tvResults[0].id} (${tvResults[0].name})`);
            return tvResults[0].id.toString();
        }

        console.warn(`No TMDB movie or TV results found for IMDb ID: ${imdbId}`);
        return null;
    } catch (error) {
        console.error(`Error fetching TMDB ID for ${imdbId}:`, error);
        return null;
    }
}

async function getUrl(id, type, config) {
    if (type === 'movie') {
        let tmdbId = null;
        if (id.startsWith('tmdb:')) {
            tmdbId = id.split(':')[1] || null;
        } else {
            const imdbIdForMovie = id;
            tmdbId = await getTmdbIdFromImdbId(imdbIdForMovie, config.tmdbApiKey, 'movie');
        }
        if (!tmdbId) return null;
        return `${VIXSRC_BASE_URL}/movie/${tmdbId}`;
    }

    const rawParts = id.split(':');
    let tmdbSeriesId = null;
    let seasonStr;
    let episodeStr;
    let imdbIdForMapping = null;

    if (rawParts[0] === 'tmdb') {
        tmdbSeriesId = rawParts[1] || null;
        seasonStr = rawParts[2];
        episodeStr = rawParts[3];
    } else {
        const obj = getObject(id);
        imdbIdForMapping = obj.id;
        seasonStr = obj.season;
        episodeStr = obj.episode;

        const seasonNum = Number(seasonStr);
        if (!isNaN(seasonNum) && imdbIdForMapping) {
            const staticTmdbId = getStaticTmdbMapping(imdbIdForMapping, seasonNum);
            if (staticTmdbId) {
                tmdbSeriesId = staticTmdbId;
                seasonStr = "1";
                console.log(`[IMDB→TMDB] Usato mapping statico: ${imdbIdForMapping} S${seasonNum} → TMDB ${staticTmdbId} S1 (serie TMDB separata)`);
            }
        }

        if (!tmdbSeriesId) {
            tmdbSeriesId = await getTmdbIdFromImdbId(obj.id, config.tmdbApiKey, 'tv');
        }
    }
    if (!tmdbSeriesId) return null;
    const seasonNum = Number(seasonStr);
    const episodeNum = Number(episodeStr);
    if (isNaN(seasonNum) || isNaN(episodeNum)) {
        console.warn(`Invalid season/episode in id ${id}`);
        return null;
    }

    return `${VIXSRC_BASE_URL}/tv/${tmdbSeriesId}/${seasonNum}/${episodeNum}`;
}

async function getMovieTitle(imdbOrTmdbId, tmdbApiKey) {
    let tmdbId = null;
    if (imdbOrTmdbId.startsWith('tmdb:')) {
        tmdbId = imdbOrTmdbId.split(':')[1] || null;
    } else {
        tmdbId = await getTmdbIdFromImdbId(imdbOrTmdbId, tmdbApiKey, 'movie');
    }
    if (!tmdbId) return null;
    const movieDetailsUrl = `${TMDB_API_BASE_URL}/movie/${tmdbId}?api_key=${tmdbApiKey}&language=it`;
    try {
        const response = await fetch(movieDetailsUrl);
        if (!response.ok) {
            console.error(`Error fetching movie title for TMDB ID ${tmdbId}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.title || null;
    } catch (error) {
        console.error("Error fetching movie title:", error);
        return null;
    }
}

async function getSeriesTitle(imdbOrTmdbComposite, tmdbApiKey) {
    let tmdbId = null;
    if (imdbOrTmdbComposite.startsWith('tmdb:')) {
        const parts = imdbOrTmdbComposite.split(':');
        tmdbId = parts[1] || null;
    } else {
        tmdbId = await getTmdbIdFromImdbId(imdbOrTmdbComposite.split(':')[0], tmdbApiKey, 'tv');
    }
    if (!tmdbId) return null;
    const seriesDetailsUrl = `${TMDB_API_BASE_URL}/tv/${tmdbId}?api_key=${tmdbApiKey}&language=it`;
    try {
        const response = await fetch(seriesDetailsUrl);
        if (!response.ok) {
            console.error(`Error fetching series title for TMDB ID ${tmdbId}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.name || null;
    } catch (error) {
        console.error("Error fetching series title:", error);
        return null;
    }
}

// 2. Get VixSrc Site Version (Anti-bot protection)
async function getSiteVersion() {
    try {
        const res = await fetch(`${VIXSRC_BASE_URL}/richiedi-un-titolo`, {
            headers: { "Referer": `${VIXSRC_BASE_URL}/`, "Origin": VIXSRC_BASE_URL }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const data = $("div#app").attr("data-page");
        if (data) return JSON.parse(data).version;
    } catch (e) { console.error("[VixSrc] Version fetch failed", e); }
    return "0.0.0";
}

async function getDirectStream(url, id, type, config) {
    try {
        console.log(`[VixSrc] Fetching page: ${url}`);

        // Fetch Site Version first
        const version = await getSiteVersion();
        console.log(`[VixSrc] Site Version: ${version}`);

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Referer": `${VIXSRC_BASE_URL}/`,
                "x-inertia": "true",
                "x-inertia-version": version
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`[VixSrc] Content not found (404): ${url}`);
                return null;
            }
            throw new Error(`Page request failed: ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 4. Extract Player Data (Guide Method)
        const script = $("body script").filter((_, el) => {
            const c = $(el).html() || "";
            return c.includes("'token':") && c.includes("'expires':");
        }).first().html();

        if (!script) {
            console.warn('[VixSrc] No player script found (content might be missing or blocked).');
            // Fallback to old method just in case
            const masterPlaylistMatch = html.match(/window\.masterPlaylist\s*=\s*({[\s\S]*?})\s*window\./);
            if (masterPlaylistMatch) {
                console.log('[VixSrc] Fallback: Found window.masterPlaylist');
                // ... (Old logic could go here, but let's stick to the guide first)
            }
            return null;
        }

        const token = script.match(/'token':\s*'(\w+)'/)?.[1];
        const expires = script.match(/'expires':\s*'(\d+)'/)?.[1];
        const serverUrl = script.match(/url:\s*'([^']+)'/)?.[1];

        if (!token || !expires || !serverUrl) {
            console.warn("[VixSrc] Failed to parse token/expires/url.");
            return null;
        }

        // 5. Build Final URL
        let finalUrl = serverUrl;
        if (finalUrl.includes('/playlist/') && !finalUrl.endsWith('.m3u8')) {
            finalUrl = finalUrl.replace(/\/playlist\/([^\/]+)$/, '/playlist/$1.m3u8');
        }

        // Manually construct query to ensure specific order: token, expires, h
        const u = new URL(finalUrl);
        const params = new URLSearchParams();
        // params.set('b', '1'); // Removed as per user request
        params.set('token', token);
        params.set('expires', expires);

        let qualityLabel = "HD";
        if (script.includes("window.canPlayFHD = true")) {
            params.set('h', '1');
            qualityLabel = "FHD";
        }
        u.search = params.toString();

        console.log(`[VixSrc] Extracted Playlist URL: ${u.toString()} (${qualityLabel})`);

        // Get Title
        let baseTitle = type === 'movie' ?
            await getMovieTitle(id, config.tmdbApiKey) :
            await getSeriesTitle(id, config.tmdbApiKey);

        if (!baseTitle) {
            baseTitle = $("title").text().trim().replace(" - VixSrc", "");
        }

        let determinedName;
        if (baseTitle) {
            determinedName = `🎬 ${baseTitle}`;
            if (type !== 'movie') {
                const obj = getObject(id);
                determinedName += ` (S${obj.season}E${obj.episode})`;
            }
            determinedName += `\n🗣 [ITA]\n🌐 Proxy (OFF) [${qualityLabel}]`;
        } else {
            determinedName = `🎬 VixSrc Stream\n🗣 [ITA]\n🌐 Proxy (OFF) [${qualityLabel}]`;
        }

        return {
            name: determinedName,
            url: u.toString(),
            referer: url, // Important: Stremio needs the page URL as referer
            source: 'VixSrc',
            isDirectStream: true,
            behaviorHints: {
                bingeGroup: 'vixsrc-direct',
                notWebReady: true,
                proxyHeaders: {
                    request: {
                        "Referer": `${VIXSRC_BASE_URL}/`
                    }
                }
            }
        };

    } catch (error) {
        console.error(`[VixSrc] Error extracting stream: ${error.message}`, error);
        return null;
    }
}

async function getStreamContent(type, id, season, episode) {
    console.log(`[VixSrc] Processing ${type} (${id})`);

    // Use global settings instead of passed config
    const config = {
        tmdbApiKey: settings.TMDB_API_KEY
    };

    const targetUrl = await getUrl(id, type, config);
    if (!targetUrl) {
        console.warn(`[VixSrc] Could not generate target URL for ${id}`);
        return null;
    }

    const streams = [];

    // Direct Stream
    const directStream = await getDirectStream(targetUrl, id, type, config);
    if (directStream) {
        streams.push(directStream);
    }

    return streams;
}

module.exports = {
    getStreams: getStreamContent
};
