const ilCorsaroNero = require('./scrapers/ilcorsaronero');
const animeunity = require('./scrapers/animeunity');
const torrentgalaxy = require('./scrapers/torrentgalaxy');
const knaben = require('./scrapers/knaben');
const debridio = require('./scrapers/debridio');
const zilean = require('./scrapers/zilean');
const torbox = require('./scrapers/torbox');
const guardaserie = require('./scrapers/guardaserie');
const eurostreaming = require('./scrapers/eurostreaming');
const animesaturn = require('./scrapers/animesaturn');
const animeworld = require('./scrapers/animeworld');
const vixcloud = require('./scrapers/vixcloud');
const lordchannel = require('./scrapers/lordchannel'); // New
const tpb = require('./scrapers/tpb');
const filterer = require('./filterer');
const deduplicator = require('./deduplicator');
const { checkAllDebridCaches } = require('./debrid');
const settings = require('../../config/settings');
const { parseReleaseInfo } = require('./utils/releaseParser');
const { parseSize } = require('./utils/sizeParser');
const { formatTorboxStream } = require('./utils/streamWrapper');

async function getStreams(meta, type, host, season, episode) {
    let query = meta.name;
    let isCollection = false;
    let collectionItem = null;

    // Handle Collections (ctmdb.)
    if (meta.id && meta.id.startsWith('ctmdb.')) {
        isCollection = true;
        if (meta.videos && season && episode) {
            collectionItem = meta.videos.find(v => v.season == season && v.episode == episode);
            if (collectionItem) {
                query = collectionItem.title || collectionItem.name;
                console.error(`[StreamService] Collection detected: "${meta.name}". Resolved S${season}E${episode} to movie: "${query}" (ID: ${collectionItem.realId})`);
                type = 'movie';
                season = undefined;
                episode = undefined;
            } else {
                console.error(`[StreamService] Collection item not found for S${season}E${episode}`);
            }
        }
    }

    console.error(`[StreamService] Searching for: ${query} (${type}) ${season ? `S${season}E${episode}` : ''}`);

    try {
        // 1. Run Scrapers
        const itaQuery = `${query} ITA`;
        console.error('[StreamService] Step 1: Initializing scrapers...');

        // Helper to wrap promise with timeout
        const withTimeout = (promise, ms, name) => {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(`Timed out after ${ms}ms`));
                }, ms);
            });

            return Promise.race([promise, timeoutPromise])
                .then(result => {
                    clearTimeout(timeoutId);
                    return result;
                })
                .catch(err => {
                    clearTimeout(timeoutId);
                    console.error(`[StreamService] Scraper ${name} failed or timed out: ${err.message}`);
                    return []; // Return empty array on failure/timeout so we don't block others
                });
        };

        const SCRAPER_TIMEOUT = 6000; // 6 seconds (Optimized for speed)

        let scrapers = [];
        try {
            scrapers = [
                withTimeout(ilCorsaroNero.search(query, type), SCRAPER_TIMEOUT, 'IlCorsaroNero'),
                withTimeout(animeunity.searchAndResolve(query, type, season, episode), SCRAPER_TIMEOUT, 'AnimeUnity'),
                // ToonItalia Removed
                withTimeout(torrentgalaxy.getStreams(itaQuery), SCRAPER_TIMEOUT, 'TorrentGalaxy'),
                withTimeout(knaben.getStreams(itaQuery), SCRAPER_TIMEOUT, 'Knaben'),
                // SolidTorrents Removed
                // 1337x Removed
                withTimeout(tpb.getStreams(itaQuery), SCRAPER_TIMEOUT, 'TPB'),
                withTimeout(debridio.getStreams(type, meta.imdb_id || `tt${meta.id}`), SCRAPER_TIMEOUT, 'DebridIO'),
                withTimeout(zilean.getStreams(query), SCRAPER_TIMEOUT, 'Zilean'),
                withTimeout(torbox.getStreams(query), SCRAPER_TIMEOUT, 'TorBox'),
                withTimeout(guardaserie.search(query, type, season, episode), SCRAPER_TIMEOUT, 'Guardaserie'),
                withTimeout(eurostreaming.search(query, type, season, episode), SCRAPER_TIMEOUT, 'Eurostreaming'),
                withTimeout(animesaturn.search(query, type, season, episode), SCRAPER_TIMEOUT, 'AnimeSaturn'),
                withTimeout(animeworld.search(query, type, season, episode), SCRAPER_TIMEOUT, 'AnimeWorld'),
                withTimeout(vixcloud.getStreams(type, meta.imdb_id || meta.id, season, episode), SCRAPER_TIMEOUT, 'VixCloud'),
                withTimeout(lordchannel.search(query, type, season, episode), SCRAPER_TIMEOUT, 'LordChannel') // New, High Priority
            ];
        } catch (e) {
            console.error(`[StreamService] Error initializing scrapers: ${e.message}`);
            return [];
        }

        // Early Exit Configuration
        const TARGET_4K = 2;
        const TARGET_1080P = 3;
        const MIN_STREAMS_TO_EXIT = 5; // Minimum total streams to consider exiting early

        let allResults = [];
        let completedScrapers = 0;
        let hasExited = false;

        // Wrap scrapers to handle their own completion
        const wrappedScrapers = scrapers.map((promise, index) => {
            return promise.then(results => {
                if (hasExited) return []; // If we already exited, ignore this result

                completedScrapers++;
                const newStreams = results.flat();
                allResults.push(...newStreams);

                // Check if we have enough streams to exit early
                const count4k = allResults.filter(s => (s.name && s.name.includes('2160p')) || (s.title && s.title.includes('2160p'))).length;
                const count1080p = allResults.filter(s => (s.name && s.name.includes('1080p')) || (s.title && s.title.includes('1080p'))).length;

                if (!hasExited && count4k >= TARGET_4K && count1080p >= TARGET_1080P) {
                    console.error(`[StreamService] Early exit! Found enough streams (${count4k} 4K, ${count1080p} 1080p).`);
                    hasExited = true;
                    // We can't really "cancel" the other promises, but we can proceed immediately.
                }
            });
        });

        // Wait for EITHER all to finish OR the early exit condition
        // We poll the status or use a race, but since we want to aggregate, 
        // a simple way is to wait for a "signal" or all promises.
        // Actually, since we modified the promises to update a shared state, 
        // we can just wait for all of them BUT we want to return *early*.

        // Better approach: Create a "ExitTrigger" promise that resolves when condition is met
        const checkCondition = () => {
            const count4k = allResults.filter(s => (s.name && s.name.includes('2160p')) || (s.title && s.title.includes('2160p'))).length;
            const count1080p = allResults.filter(s => (s.name && s.name.includes('1080p')) || (s.title && s.title.includes('1080p'))).length;
            return count4k >= TARGET_4K && count1080p >= TARGET_1080P;
        };

        const waitForEarlyExit = new Promise(resolve => {
            const interval = setInterval(() => {
                if (hasExited || completedScrapers === scrapers.length) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });

        // We also need to ensure we don't wait forever if scrapers hang (though they have timeouts)
        await Promise.race([
            Promise.all(wrappedScrapers), // Wait for all (normal case)
            waitForEarlyExit // Wait for early exit signal
        ]);

        if (allResults.length === 0) {
            console.error('[StreamService] No streams found.');
            return [];
        }
        console.error(`[StreamService] Step 1 Complete. Found ${allResults.length} raw streams.`);

        // 2. Normalize (Ensure common fields)
        let normalizedStreams = allResults.map(s => ({
            name: s.name,
            title: s.title || s.name,
            infoHash: s.infoHash,
            fileIdx: s.fileIdx,
            seeders: s.seeders,
            size: s.size,
            website: s.website,
            uploadDate: s.uploadDate,
            resolution: s.resolution,
            quality: s.quality,
            url: s.url,
            behaviorHints: s.behaviorHints || {},
            isDirectStream: s.isDirectStream || false,
            cached: s.cached || false,
            source: s.source || 'unknown',
            magnet: s.magnet
        }));

        // 3. Filter
        console.error('[StreamService] Step 3: Filtering...');
        let filteredStreams = filterer.filter(normalizedStreams, meta, type);

        // 4. Deduplicate
        console.error('[StreamService] Step 4: Deduplicating...');
        let deduplicatedStreams = deduplicator.deduplicate(filteredStreams);

        // 5. Check Debrid Caches
        console.error('[StreamService] Step 5: Checking Debrid Cache...');
        const torrentStreams = deduplicatedStreams.filter(s => s.infoHash && !s.isDirectStream);
        const directStreams = deduplicatedStreams.filter(s => s.isDirectStream);

        const hasDebrid = settings.REALDEBRID_API_KEY || settings.TORBOX_API_KEY;

        if (torrentStreams.length > 0 && hasDebrid) {
            console.error(`[StreamService] Checking ${torrentStreams.length} torrents for debrid cache...`);
            const hashes = torrentStreams.map(s => s.infoHash);
            try {
                const { results } = await checkAllDebridCaches(hashes);
                if (results) {
                    torrentStreams.forEach(s => {
                        if (results.realdebrid && results.realdebrid[s.infoHash]) s.cached = true;
                        if (results.torbox && results.torbox[s.infoHash]) s.cached = true;
                    });
                }
            } catch (e) {
                console.error(`[StreamService] Debrid check failed: ${e.message}`);
            }
        }

        let finalStreams = [...directStreams, ...torrentStreams];

        // 6. Sort Streams
        console.error('[StreamService] Step 6: Sorting...');
        finalStreams.sort((a, b) => {
            // 1. VixSrc / Direct Streams
            if (a.isDirectStream && !b.isDirectStream) return -1;
            if (!a.isDirectStream && b.isDirectStream) return 1;

            // 2. Cached Streams
            if (a.cached && !b.cached) return -1;
            if (!a.cached && b.cached) return 1;

            // 3. Resolution
            const getRes = (s) => {
                const name = (s.name || '').toLowerCase();
                const title = (s.title || '').toLowerCase();
                if (name.includes('4k') || title.includes('4k') || name.includes('2160p')) return 2160;
                if (name.includes('1080p') || title.includes('1080p')) return 1080;
                if (name.includes('720p') || title.includes('720p')) return 720;
                if (name.includes('480p') || title.includes('480p')) return 480;
                return 0;
            };
            const resA = getRes(a);
            const resB = getRes(b);
            if (resA !== resB) return resB - resA;

            // 4. P2P / Seeders
            if (a.seeders !== undefined && b.seeders !== undefined) {
                return b.seeders - a.seeders;
            }

            return 0;
        });

        // 7. Format Display
        console.error('[StreamService] Step 7: Formatting...');

        // Determine Base URL (fallback to localhost if not set)
        const BASE_URL = settings.BASE_URL || 'http://localhost:3000';

        finalStreams = finalStreams.map(s => {
            try {
                // Clean name to remove newlines
                s.name = (s.name || '').replace(/\n/g, ' ').trim();

                // We use s.title (filename) for parsing info, but we WON'T send it to Stremio
                // because AIOStreams doesn't use it and it might cause display issues.
                const filename = (s.title || s.name || '').split('\n')[0].trim();
                const info = parseReleaseInfo(filename);
                const sizeBytes = parseSize(s.size);

                // Determine Status
                let statusIcon = '';
                let statusText = '';
                // Check if we will wrap this stream in TorBox
                const willWrapTorbox = settings.TORBOX_STREMIO_CONFIG && s.infoHash;

                if (s.isDirectStream) {
                    statusIcon = '⚡';
                    statusText = 'Direct Stream';
                } else if (s.cached) {
                    statusIcon = '🚀';
                    statusText = 'Cached Debrid';
                } else if (willWrapTorbox) {
                    statusIcon = '🚀'; // It acts like cached/debrid
                    statusText = 'TorBox Proxy';
                } else if (s.infoHash) {
                    statusIcon = '⚠️';
                    statusText = 'P2P - VPN Required';
                } else {
                    statusIcon = '❓';
                    statusText = 'External';
                }

                // Determine Resolution
                // If s.resolution is missing, try to extract it from the filename
                if (!s.resolution) {
                    const nameLower = (s.name || '').toLowerCase();
                    const titleLower = (filename || '').toLowerCase();
                    if (nameLower.includes('2160p') || titleLower.includes('2160p') || nameLower.includes('4k') || titleLower.includes('4k')) s.resolution = '2160p';
                    else if (nameLower.includes('1080p') || titleLower.includes('1080p')) s.resolution = '1080p';
                    else if (nameLower.includes('720p') || titleLower.includes('720p')) s.resolution = '720p';
                    else if (nameLower.includes('480p') || titleLower.includes('480p') || titleLower.includes('dvdrip')) s.resolution = '480p';
                }

                // Determine Resolution Icon
                let resIcon = '';
                if (s.resolution === '2160p') resIcon = '🌟 4K';
                else if (s.resolution === '1080p') resIcon = '✨ FHD';
                else if (s.resolution === '720p') resIcon = '💫 HD';
                else if (s.resolution === '480p') resIcon = '🪐 SD';
                else resIcon = s.resolution || '📺';

                // Determine Flag
                const isItalian = info.languages.some(l => l.includes('ITA')) || (s.name && s.name.includes('ITA'));
                const flag = isItalian ? '🇮🇹' : '🌍';

                // Build Name (Line 1)
                let provider = s.source || 'Unknown';
                if (provider === 'unknown' || provider === 'Unknown') {
                    // Try to infer from bingeGroup or just say 'Torrent'
                    if (s.behaviorHints && s.behaviorHints.bingeGroup && s.behaviorHints.bingeGroup.includes('ilcorsaronero')) {
                        provider = 'CorsaroNero'; // Infer from bingeGroup
                    } else {
                        provider = 'Torrent';
                    }
                }

                const resolutionTag = s.resolution ? `[${s.resolution}]` : ''; // Omit if unknown

                // Format: [1080p] 🇮🇹 🚀 Provider
                s.name = `${resolutionTag} ${flag} ${statusIcon} ${provider}`.trim();

                // Build Description (Custom Format)
                // 1. Title Line: Movie Name + S/E (if series)
                let titleLine = `🎬 ${meta.name}`;
                if (season && episode) titleLine += ` S${season}E${episode}`;

                // 2. Year Line
                const yearLine = meta.year ? `📅 ${meta.year}` : '';

                // 3. Tech Line (Quality, Codec, Visual)
                const techLine = [
                    info.quality !== 'HD' ? `💿 ${info.quality}` : '',
                    info.codec ? `🎞️ ${info.codec}` : '',
                    info.visual.length > 0 ? `📺 ${info.visual.join(' ')}` : ''
                ].filter(Boolean).join(' • ');

                // 4. Audio Line
                const audioLine = info.audio.length > 0 ? `🔊 ${info.audio.join(' ')}` : '';

                // 5. Language Line (Mapped)
                const langMap = {
                    'ITA': 'Italian', 'ENG': 'English', 'FRE': 'French', 'SPA': 'Spanish',
                    'GER': 'German', 'POR': 'Portuguese', 'RUS': 'Russian', 'JPN': 'Japanese',
                    'KOR': 'Korean', 'CHI': 'Chinese', 'HIN': 'Hindi', 'LAT': 'Latino',
                    'POL': 'Polish', 'UKR': 'Ukrainian', 'TUR': 'Turkish'
                };
                const mappedLanguages = info.languages.map(l => {
                    // l is like "🇮🇹 ITA"
                    const code = l.split(' ')[1] || l;
                    return langMap[code] || code;
                }).join(' | ');
                const langLine = mappedLanguages ? `🌐 ${mappedLanguages}` : '';

                // 6. Stats Line (Size, Seeders, Status)
                // Format: 📦 5.63 GB 🌱 4 🔍 TorBox Proxy
                const sizeStr = sizeBytes > 0 ? `📦 ${(sizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB` : '';
                const seedersStr = s.seeders !== undefined ? `🌱 ${s.seeders}` : '';
                const statusStr = `🔍 ${statusText}`;

                const statsLine = [sizeStr, seedersStr, statusStr].filter(Boolean).join(' ');

                // Combine all lines
                s.description = [titleLine, yearLine, techLine, audioLine, langLine, statsLine]
                    .filter(line => line && line.trim().length > 0)
                    .join('\n');

                // Autoplay / Binge Group Logic
                if (type === 'series' || isCollection) {
                    const langTag = isItalian ? 'ita' : 'eng';
                    const qualityTag = (s.resolution || 'unknown').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    const providerTag = provider.toLowerCase().replace(/[^a-z0-9]/g, '');

                    s.behaviorHints = {
                        ...s.behaviorHints,
                        bingeGroup: `vixsrc|${meta.id}|${qualityTag}|${langTag}|${providerTag}`
                    };
                }

                // Generate Play URL
                if (s.cached && s.infoHash && !willWrapTorbox) {
                    // Standard Debrid Cache (Real-Debrid via our /play route)
                    const service = 'realdebrid';
                    s.url = `${BASE_URL}/play/${service}/${s.infoHash}/${s.fileIdx || 0}`;
                    delete s.infoHash;
                    delete s.fileIdx;
                } else if (willWrapTorbox) {
                    // TorBox Wrapper Logic
                    const context = {
                        imdbId: meta.imdb_id || `tt${meta.id}`,
                        type: type,
                        season: season,
                        episode: episode
                    };
                    const torrentData = {
                        infoHash: s.infoHash,
                        magnet: s.magnet || `magnet:?xt=urn:btih:${s.infoHash}`,
                        title: filename, // Use clean filename
                        size: sizeBytes,
                        filename: filename
                    };

                    const wrapped = formatTorboxStream(torrentData, context, settings.TORBOX_STREMIO_CONFIG);

                    s.url = wrapped.url;
                    // Merge behaviorHints but REMOVE notWebReady if it was set by wrapper
                    s.behaviorHints = { ...s.behaviorHints, ...wrapped.behaviorHints };
                    if (s.behaviorHints.notWebReady) delete s.behaviorHints.notWebReady;

                    delete s.infoHash; // Disable P2P
                    delete s.fileIdx;
                    delete s.sources;
                } else if (s.infoHash) {
                    // Add sources for P2P streams
                    const { TRACKERS } = require('../../config/constants');
                    s.sources = [
                        ...TRACKERS.map(t => `tracker:${t}`),
                        `dht:${s.infoHash}`
                    ];
                }

                // Remove 'title' field to match AIOStreams format and prevent display issues
                delete s.title;

                return s;
            } catch (e) {
                console.error(`[StreamService] Error formatting stream: ${e.message}`, s);
                return s;
            }
        });

        console.error(`[StreamService] Done. Returning ${finalStreams.length} streams.`);
        return finalStreams;
    } catch (e) {
        console.error(`[StreamService] CRITICAL ERROR: ${e.message}`);
        console.error(e.stack);
        return [];
    }
}

module.exports = { getStreams };
