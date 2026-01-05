const crypto = require('crypto');

class StreamDeduplicator {
    deduplicate(streams) {
        const start = Date.now();
        const initialCount = streams.length;
        const uniqueMap = new Map();
        const directStreams = [];

        streams.forEach(stream => {
            // Direct streams (HTTP)
            if (stream.isDirectStream) {
                // Deduplicate by URL first
                if (stream.url && uniqueMap.has(stream.url)) return;

                // Deduplicate by Filename + Size (if available) across direct streams
                // This prevents listing the exact same file multiple times if URLs differ slightly
                let directKey = stream.url;
                const filename = stream.title || stream.name; // We mapped filename to title in scrapers

                if (filename) {
                    // Normalize filename for better matching
                    const normName = filename.toLowerCase().replace(/[^a-z0-9]/g, '');
                    // Use size if available to reduce false positives
                    const sizeKey = stream.size ? `:${stream.size}` : '';
                    directKey = `direct:${normName}${sizeKey}`;
                }

                if (!uniqueMap.has(directKey)) {
                    uniqueMap.set(directKey, stream);
                    directStreams.push(stream);
                    if (stream.url) uniqueMap.set(stream.url, stream); // Also track URL to be safe
                }
                return;
            }

            // Generate Smart Hash
            // Key: Resolution + Size (rounded) + Codec (if available)
            // If infoHash is present, use it as a fallback or primary key?
            // AIOStreams uses DSU to merge. We'll use a simpler map approach for now.

            let key = stream.infoHash;

            if (!key && stream.size) {
                // Fallback for streams without hash but with size (rare for torrents)
                const roundedSize = Math.round(stream.size / 100000000) * 100000000; // 100MB buckets
                const resolution = stream.resolution || 'unknown';
                key = `smart:${roundedSize}:${resolution}`;
            }

            if (!key) {
                // No hash, no size -> keep it
                directStreams.push(stream);
                return;
            }

            const existing = uniqueMap.get(key);
            if (!existing) {
                uniqueMap.set(key, stream);
            } else {
                // Merge logic: Keep the one with more seeders or better metadata
                if ((stream.seeders || 0) > (existing.seeders || 0)) {
                    uniqueMap.set(key, stream);
                }
                // If existing is cached and new is not, keep existing (already handled by sort, but good to preserve)
                else if (existing.cached && !stream.cached) {
                    // keep existing
                }
                else if (!existing.cached && stream.cached) {
                    uniqueMap.set(key, stream);
                }
            }
        });

        // Filter directStreams from uniqueMap values if we mixed them?
        // No, we pushed to directStreams array separately.
        // Wait, current logic for directStreams pushes to array AND map?
        // My new logic tracks them in map but pushes to array.
        // The return value was `[...uniqueMap.values(), ...directStreams]`.
        // Torrents are in uniqueMap. Directs are in directStreams.

        const torrents = Array.from(uniqueMap.values()).filter(s => !s.isDirectStream && !s.url?.startsWith('http')); // Safety filter
        const result = [...torrents, ...directStreams];
        console.error(`[StreamDeduplicator] Deduplicated ${initialCount} -> ${result.length} streams in ${Date.now() - start}ms`);
        return result;
    }
}

module.exports = new StreamDeduplicator();
