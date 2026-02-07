const { getDatabase } = require('../../lib/db');
const { fetchTMDB, normalizeProviders } = require('./tmdbClient');
const { generateDescription } = require('./googleAiClient');
const { mapCommon } = require('./processor');

async function harmonize(table, type, log = console.log) {
    const db = getDatabase();
    const rows = db.prepare(`SELECT tmdb_id, title, description, catalog_names, vote_count, updated_at FROM ${table}`).all();
    let updated = 0;
    // CJK Regex for Asian title detection
    const cjkRegex = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/;

    for (const row of rows) {
        let isStreamingUnity = false;
        if (row.catalog_names) {
            try {
                const catalogs = JSON.parse(row.catalog_names);
                if (Array.isArray(catalogs) && catalogs.includes('streamingunity')) {
                    isStreamingUnity = true;
                }
            } catch { }
        }

        if (!isStreamingUnity || !row.tmdb_id) continue;

        // FIX: Optimization - Skip fetching if we have recent, high-quality local data
        // Criteria: Updated in last 7 days + Has Description + Has Votes + Title is not Asian (implies normalized)
        const isRecent = row.updated_at && (Date.now() - new Date(row.updated_at).getTime() < 7 * 24 * 60 * 60 * 1000);
        const hasGoodData = row.description && row.description.length > 20 && (row.vote_count > 0);
        const isNative = !cjkRegex.test(row.title);

        if (isRecent && hasGoodData && isNative) {
            // log(`[${table}] Skipping optimized row: ${row.title}`);
            continue;
        }

        // Use the centralized TMDB client (which has caching!)
        const result = await fetchTMDB(row.tmdb_id, type, () => { }); // Silence logs for individual fetches
        if (!result || !result.details) {
            continue;
        }

        const { details } = result;
        const crews = details.credits?.crew || [];
        const mapped = mapCommon(details, crews, type);

        let updateFields = {};
        for (const key in mapped) {
            // Preserve streamingunity title
            if (key === 'title') continue;

            // Preserve streamingunity description ONLY if it's good quality
            if (key === 'description') {
                const suDesc = row.description || '';
                const tmdbDesc = mapped.description || '';

                // If SU description is very short/empty and TMDB has a good one, OVERWRITE it.
                // Otherwise (SU is good OR TMDB is empty), keep SU (by skipping update).
                if (suDesc.length < 20 && tmdbDesc.length > 20) {
                    // Allow update (don't continue) -> TMDB wins
                } else {
                    // Keep SU -> Skip update
                    continue;
                }
            }
            updateFields[key] = mapped[key];
        }

        // --- ITALIAN FORCING LOGIC ---
        // Check if the final description (mapped or original) is actually Italian.
        // If it looks English or is empty/short, force AI translation.
        const currentDesc = updateFields.description || row.description || '';
        const isEnglishy = /\b(the|and|with|his|her|film|movie|series|is|are|was)\b/i.test(currentDesc) &&
            !/\b(il|la|con|che|sono|era)\b/i.test(currentDesc);

        // If description is missing, too short (< 20 chars), or looks English
        if ((!currentDesc || currentDesc.length < 20 || isEnglishy) && row.title) {
            // log(`[Harmonizer] Detected English/Empty description for "${row.title}". Translating...`);
            try {
                // Use the generateDescription helper which handles translation/generation
                // It uses the title and year (from details or row) to find/create an Italian summary.
                const releaseDate = mapped.release_date || mapped.last_air_date || row.release_date;
                const year = releaseDate ? parseInt(releaseDate) : (new Date().getFullYear());

                const translated = await generateDescription(row.title, year, currentDesc, () => { });

                if (translated && translated.length > 20) {
                    updateFields.description = translated;
                    // log(`[Harmonizer] Translation success: "${translated.substring(0, 50)}..."`);
                }
            } catch (e) {
                // log(`[Harmonizer] Translation failed: ${e.message}`);
            }
        }

        if (Object.keys(updateFields).length) {
            const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
            const values = Object.values(updateFields);
            values.push(row.tmdb_id);
            db.prepare(`UPDATE ${table} SET ${setClause} WHERE tmdb_id = ?`).run(...values);
            updated++;
            if (updated % 50 === 0) log(`[${table}] Harmonized ${updated} streamingunity rows...`);
        }
    }
    log(`[${table}] Harmonized ${updated} streamingunity entries.`);
}

module.exports = { harmonize };
