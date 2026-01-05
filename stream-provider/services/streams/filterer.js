const fuzzball = require('fuzzball');
const settings = require('../../config/settings');
const { parseSize } = require('./utils/sizeParser');

class StreamFilterer {
    constructor() {
        this.excludedRegex = settings.EXCLUDE_REGEX || [];
        this.maxSizeGB = settings.MAX_SIZE_GB || 0;
    }

    filter(streams, meta, type) {
        const start = Date.now();
        const initialCount = streams.length;

        const filtered = streams.filter(stream => {
            // 1. Basic Validity
            if (!stream.title && !stream.name) return false;
            const nameToCheck = (stream.title || stream.name || '').toUpperCase();
            const actual = (stream.title || stream.name || '').trim();

            // 2. Regex Exclusion
            if (this.excludedRegex.length > 0) {
                for (const regex of this.excludedRegex) {
                    if (regex.test(nameToCheck)) return false;
                }
            }

            // 3. Size Limit (Max Size from Settings)
            if (this.maxSizeGB > 0 && stream.size) {
                const maxBytes = this.maxSizeGB * 1024 * 1024 * 1024;
                const sizeBytes = parseSize(stream.size);
                if (sizeBytes > maxBytes) return false;
            }

            // 3.1. Minimum Size Limit (To filter out fake/sample files)
            const sizeBytes = parseSize(stream.size);
            const MIN_MOVIE_SIZE = 200 * 1024 * 1024; // 200 MB
            const MIN_EPISODE_SIZE = 50 * 1024 * 1024; // 50 MB

            if (sizeBytes > 0) {
                if (type === 'movie' && sizeBytes < MIN_MOVIE_SIZE) {
                    // console.error(`[Filter] Rejecting movie stream too small: ${stream.size} ("${actual}")`);
                    return false;
                }
                if (type === 'series' && sizeBytes < MIN_EPISODE_SIZE) {
                    // console.error(`[Filter] Rejecting series stream too small: ${stream.size} ("${actual}")`);
                    return false;
                }
            }

            // 3.2. Resolution Filtering (Eliminate 480p and 720p)
            // We want to keep only 1080p and 4K/2160p.
            // Check for explicit resolution tags.
            const is480p = /\b(480p|SD)\b/i.test(actual) || /\b(dvdrip|xvid|divx)\b/i.test(actual);
            const is720p = /\b(720p|HD)\b/i.test(actual) && !/\b(1080p|2160p|4k)\b/i.test(actual); // Ensure it's not "HD 1080p"

            if (is480p || is720p) {
                // console.error(`[Filter] Rejecting low resolution stream: "${actual}"`);
                return false;
            }

            // 4. Strict Title Matching (Fuzzy)
            if (meta.name) {
                const expected = meta.name;

                // Use token_set_ratio for flexibility (handles word reordering)
                const score = fuzzball.token_set_ratio(expected, actual);

                // Threshold: 80% seems reasonable for "Strict" but allowing minor variations
                if (score < 80) {
                    // console.error(`[Filter] Rejecting "${actual}" (Score: ${score} vs "${expected}")`);
                    return false;
                }

                // 5. Year Check (if available in meta and stream)
                if (meta.year) {
                    const yearMatch = actual.match(/\b(19|20)\d{2}\b/);
                    if (yearMatch) {
                        const streamYear = parseInt(yearMatch[0]);
                        // Allow +/- 1 year deviation
                        if (Math.abs(streamYear - meta.year) > 1) {
                            // console.error(`[Filter] Rejecting "${actual}" (Year mismatch: ${streamYear} vs ${meta.year})`);
                            return false;
                        }
                    }
                }

                // 6. Language Preference (Italian)
                // If we are searching for ITA content, we should downgrade or filter out non-ITA content
                // unless it's a multi-language release.
                const isItalian = /\b(ITA|ITALIAN|ITALIANO)\b/i.test(actual);
                const isMulti = /\b(MULTI|DUAL|TRIPLE)\b/i.test(actual);
                const isSubbed = /\b(SUB|SUBS|SUBITA|VOST)\b/i.test(actual);

                // If the stream is NOT Italian and NOT Multi, and we are in strict mode (implied for this addon),
                // we might want to filter it. However, some releases might not have "ITA" in the title but are still valid.
                // For now, let's just log it or maybe use it for sorting later.
                // Ideally, we want to ENFORCE Italian for the new scrapers.
                if (!isItalian && !isMulti && !isSubbed) {
                    // Check if it's from a source that MIGHT return non-ITA content (like SolidTorrents)
                    if (stream.source === 'SolidTorrents' || stream.source === '1337x' || stream.source === 'TPB') {
                        // STRICT MODE: If it's a global source and doesn't have ITA/Multi/Sub tags, REJECT IT.
                        // This prevents "Inception.2010.SPARKS" (English) from showing up.
                        // console.error(`[Filter] Rejecting non-Italian stream from global source: "${actual}"`);
                        return false;
                    }
                }

                // 7. Strict Type Checking (Movie vs Series)
                const seriesRegex = /S\d{1,2}E\d{1,2}|\b\d{1,2}x\d{1,2}\b|Stagione\s*\d+|Season\s*\d+/i;
                const isSeriesContent = seriesRegex.test(actual);

                if (type === 'movie' && isSeriesContent) {
                    // console.error(`[Filter] Rejecting series content for movie request: "${actual}"`);
                    return false;
                }

                if (type === 'series' && !isSeriesContent) {
                    // console.error(`[Filter] Rejecting movie/unknown content for series request: "${actual}"`);
                    return false;
                }
            }

            return true;
        });

        console.error(`[StreamFilterer] Filtered ${initialCount} -> ${filtered.length} streams in ${Date.now() - start}ms`);
        return filtered;
    }
}

module.exports = new StreamFilterer();
