const fuzz = require('fuzzball');

/**
 * Finds the best match for a query within a list of items using fuzzy matching.
 * 
 * @param {string} query The search query (e.g., "The Matrix").
 * @param {Array<{title: string, link: string, [key: string]: any}>} items List of items to search.
 * @param {string} type 'movie' or 'series'. Used for safeguards.
 * @param {Object} options Options for matching.
 * @param {number} options.threshold Minimum score to consider a match (default: 80).
 * @returns {Object|null} The best matching item or null.
 */
function findBestMatch(query, items, type, options = {}) {
    const { threshold = 80 } = options;
    const normalizedQuery = query.toLowerCase().trim();

    let bestMatch = null;
    let bestScore = -1;

    console.log(`[Matcher] looking for "${query}" (Type: ${type}) among ${items.length} candidates.`);

    for (const item of items) {
        const itemTitle = item.title;
        const normalizedTitle = itemTitle.toLowerCase().trim();

        // --- SAFEGUARDS ---
        if (type === 'movie') {
            // Reject if title looks like a series episode/season
            // "Stagione 1", "Season 2", "Episodio 5", "1x01", "S01"
            const seriesPatterns = [
                /stagione\s*\d+/i,
                /season\s*\d+/i,
                /episodio\s*\d+/i,
                /episode\s*\d+/i,
                /\bs\d{1,2}e\d{1,2}\b/i, // S01E01
                /\b1x\d{1,2}\b/i,        // 1x01
                /\bserie\b/i             // ambiguous, be careful. Maybe "Serie TV"
            ];

            const isSeries = seriesPatterns.some(p => p.test(normalizedTitle));
            if (isSeries) {
                console.log(`[Matcher] Safeguard: Rejected "${itemTitle}" as it looks like a series.`);
                continue;
            }
        }

        // --- SCORING ---
        const score1 = fuzz.ratio(normalizedQuery, normalizedTitle);
        const score2 = fuzz.token_sort_ratio(normalizedQuery, normalizedTitle);
        const score3 = fuzz.partial_ratio(normalizedQuery, normalizedTitle);

        let finalScore = Math.max(score1, score2);

        // Lowered threshold from 4 to 2 (e.g. "Her" is 3 chars)
        if (normalizedQuery.length > 2) {
            finalScore = Math.max(finalScore, score3);
        }

        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestMatch = item;
        }
    }

    if (bestScore >= threshold) {
        console.log(`[Matcher] Best match: "${bestMatch.title}" (Score: ${bestScore})`);
        return bestMatch;
    } else {
        console.log(`[Matcher] No match found above threshold ${threshold}. Best was "${bestMatch?.title}" (${bestScore})`);
        return null;
    }
}

module.exports = { findBestMatch };
