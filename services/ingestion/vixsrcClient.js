const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

async function fetchVixIds(endpoint, existing, log = console.log) {
    log(`[VixSrc]  GET  ${endpoint}`);
    try {
        const res = await fetch(endpoint, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`VixSrc ${res.status} ${res.statusText}`);
        const raw = await res.text();
        let body;
        try {
            body = JSON.parse(raw);
        } catch (jsonErr) {
            log(`[VixSrc]  ERROR JSON.parse failed: ${jsonErr.message}`);
            return [];
        }
        if (!Array.isArray(body)) throw new Error('Body is not array');
        let ids = body
            .map(o => o.tmdb_id)
            .filter(id => id !== null && id !== undefined)
            .filter(id => !existing.has(id.toString()));
        ids = Array.from(new Set(ids));
        log(`[VixSrc]  OK    ${ids.length} new unique IDs`);
        return ids;
    } catch (e) {
        log(`[VixSrc]  ERROR ${e.message}`);
        return [];
    }
}

module.exports = { fetchVixIds };
