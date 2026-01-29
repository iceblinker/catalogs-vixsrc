const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const cache = require('../lib/cache');

const LINGVA_BASE = 'https://lingva-translate-azure.vercel.app/api/v1';

async function translateText(text, targetLang, sourceLang = 'auto') {
    if (!text || !targetLang) return text;

    // Normalize target lang (e.g. es-ES -> es)
    const target = targetLang.split('-')[0];
    const source = sourceLang.split('-')[0];

    const cacheKey = `trans:${source}:${target}:${text}`; // Warning: text could be long
    // Maybe hash the text for key? For now use simple string, but watch out for key length limits if any.
    // Node-cache/sqlite usually handles long keys fine but latency might suffer. 
    // Let's use a hashed key if text > 50 chars? Simpler to just use it for now.

    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    try {
        const url = `${LINGVA_BASE}/${source}/${target}/${encodeURIComponent(text)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Lingva status ${res.status}`);
        const data = await res.json();

        const translation = data.translation;
        if (translation) {
            await cache.set(cacheKey, translation, 60 * 60 * 24 * 7); // 1 week
            return translation;
        }
    } catch (e) {
        console.error(`[Translation] Error translating to ${target}: ${e.message}`);
    }

    return text;
}

module.exports = { translateText };
