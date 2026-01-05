const fetch = require('node-fetch');
const cheerio = require('cheerio');
const settings = require('../../../config/settings');

// --- Helpers ---

function normalizeUrl(url) {
    if (!url) return '';
    if (!url.startsWith('http')) return 'https://' + url;
    return url;
}

function parseSizeToBytes(sizeStr) {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/([\d.,]+)\s*([GM]B)/i);
    if (!match) return 0;
    const val = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toUpperCase();
    if (unit === 'GB') return val * 1024 * 1024 * 1024;
    if (unit === 'MB') return val * 1024 * 1024;
    return 0;
}

async function get(url, headers = {}) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                ...headers
            }
        });
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        console.error(`[Extractor] Fetch error for ${url}: ${e.message}`);
        return null;
    }
}

// --- Extractors ---

const MixdropExtractor = {
    supports: (url) => /mixdrop/i.test(url),
    extract: async (rawUrl) => {
        const mfpUrl = settings.MEDIAFLOW_URL;
        const mfpPassword = settings.MEDIAFLOW_PASSWORD;

        if (!mfpUrl) {
            console.log('[Mixdrop] MediaFlow URL not configured, skipping.');
            return [];
        }

        let embedUrl = normalizeUrl(rawUrl).replace('/f/', '/e/');
        if (!/\/e\//.test(embedUrl)) embedUrl = embedUrl.replace('/f/', '/e/');
        const fileUrl = embedUrl.replace('/e/', '/f/');

        // Fetch metadata from file page
        const html = await get(fileUrl);
        if (!html) return [];
        if (/can't find the (file|video)/i.test(html)) return [];

        const titleMatch = html.match(/<b>([^<]+)<\/b>/) || html.match(/class="title"[^>]*>\s*<b>([^<]+)<\/b>/i);
        const sizeMatch = html.match(/([\d.,]+ ?[GM]B)/);
        const resMatch = html.match(/(\b[1-9]\d{2,3}p\b)/i);

        const encoded = encodeURIComponent(embedUrl);
        const passwordParam = mfpPassword ? `&api_password=${encodeURIComponent(mfpPassword)}` : '';
        const finalUrl = `${mfpUrl.replace(/\/$/, '')}/extractor/video?host=Mixdrop${passwordParam}&d=${encoded}&redirect_stream=true`;

        const bytes = sizeMatch ? parseSizeToBytes(sizeMatch[1]) : 0;
        let sizePart = '';
        if (bytes) {
            sizePart = bytes >= 1024 ** 3 ? (bytes / 1024 / 1024 / 1024).toFixed(2) + 'GB' : (bytes / 1024 / 1024).toFixed(0) + 'MB';
        }

        let baseTitle = (titleMatch ? titleMatch[1].trim() : 'Mixdrop').trim();
        if (!/\[ITA\]$/i.test(baseTitle)) {
            if (!/•\s*\[ITA\]$/i.test(baseTitle)) baseTitle = `${baseTitle} • [ITA]`;
        }

        const line2Segs = [];
        if (sizePart) line2Segs.push(sizePart);
        if (resMatch) line2Segs.push(resMatch[1].toLowerCase());
        line2Segs.push('Mixdrop');

        const fullTitle = (sizePart || resMatch) ? `${baseTitle}\n💾 ${line2Segs.join(' • ')}` : baseTitle;

        return [{
            title: fullTitle,
            url: finalUrl,
            behaviorHints: { notWebReady: true }
        }];
    }
};

const StreamtapeExtractor = {
    supports: (url) => /streamtape\.com\//i.test(url),
    extract: async (rawUrl) => {
        const mfpUrl = settings.MEDIAFLOW_URL;
        const mfpPassword = settings.MEDIAFLOW_PASSWORD;

        if (!mfpUrl) {
            console.log('[Streamtape] MediaFlow URL not configured, skipping.');
            return [];
        }

        const embedUrl = normalizeUrl(rawUrl);
        const encoded = encodeURIComponent(embedUrl);
        const base = mfpUrl.replace(/\/$/, '');
        const passwordParam = mfpPassword ? `&api_password=${encodeURIComponent(mfpPassword)}` : '';
        const finalUrl = `${base}/extractor/video?host=Streamtape${passwordParam}&d=${encoded}&redirect_stream=true`;

        let line1 = 'Streamtape';
        if (!/\[ITA\]$/i.test(line1)) line1 = line1 + ' • [ITA]';
        const line2 = '💾 streamtape';
        const title = `${line1}\n${line2}`;

        return [{
            title: title,
            url: finalUrl,
            behaviorHints: { notWebReady: true }
        }];
    }
};

const DoodStreamExtractor = {
    supports: (url) => /dood|do[0-9]go|doood|dooood|ds2play|ds2video|d0o0d|do0od|d0000d|d000d|vidply|all3do|doply|vide0|vvide0|d-s/i.test(url),
    extract: async (rawUrl) => {
        const DOOD_PRIMARY = 'https://dood.to';
        const DOOD_FALLBACKS = ['https://doodstream.co', 'https://dood.watch', 'https://d000d.com'];

        async function fetchText(url, referer, cookieJar = []) {
            try {
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': referer
                };
                if (cookieJar.length) headers['Cookie'] = cookieJar.join('; ');

                const res = await fetch(url, { headers, redirect: 'manual' });
                const setCookie = res.headers.get('set-cookie');
                const allCookies = [];
                if (setCookie) {
                    // Simple split for comma-separated cookies
                    setCookie.split(/,(?=[^;]+=[^;]+)/).forEach(c => allCookies.push(c.trim()));
                }

                if (res.status === 301 || res.status === 302) {
                    const loc = res.headers.get('location');
                    if (loc) {
                        const nextJar = [...cookieJar, ...allCookies.map(c => c.split(';')[0])];
                        return fetchText(new URL(loc, url).toString(), referer, nextJar);
                    }
                }

                if (!res.ok) return { text: null, setCookie: allCookies };
                const text = await res.text();
                return { text, setCookie: allCookies };
            } catch (e) {
                return { text: null };
            }
        }

        const normU = new URL(normalizeUrl(rawUrl));
        const videoId = normU.pathname.split('/').pop();
        if (!videoId) return [];

        const domains = [DOOD_PRIMARY, ...DOOD_FALLBACKS];
        let html = null;
        let originUsed = '';
        const cookieJar = [];

        for (const dom of domains) {
            const test = `${dom.replace(/\/$/, '')}/e/${videoId}`;
            const res = await fetchText(test, dom, cookieJar);
            if (res.setCookie && res.setCookie.length) {
                res.setCookie.forEach(c => cookieJar.push(c.split(';')[0]));
            }
            if (res.text) {
                html = res.text;
                originUsed = dom;
                break;
            }
        }

        if (!html) return [];

        const pass = html.match(/\/pass_md5\/[\w-]+\/([\w-]+)/);
        if (!pass) return [];

        const passUrl = new URL(pass[0], originUsed).toString();
        const passRes = await fetchText(passUrl, originUsed, cookieJar);
        const token = passRes.text;

        if (!token) return [];

        const randomStr = Math.random().toString(36).substring(2, 12);
        const finalUrl = `${token}${randomStr}?token=${pass[1]}&expiry=${Date.now()}`;

        return [{
            title: 'Doodstream',
            url: finalUrl,
            behaviorHints: {
                notWebReady: true,
                proxyHeaders: {
                    request: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                        'Referer': originUsed
                    }
                }
            }
        }];
    }
};

const VixCloudHlsExtractor = {
    supports: (url) => /vixcloud\./i.test(url),
    extract: async (url) => {
        try {
            const embedUrl = normalizeUrl(url);
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://animeunity.so/'
            };
            const res = await fetch(embedUrl, { headers });
            if (!res.ok) return [];
            const html = await res.text();
            const $ = cheerio.load(html);

            const scriptContent = $('script').toArray()
                .map(el => $(el).html())
                .find(s => s && s.includes('masterPlaylist'));

            if (!scriptContent) return [];

            const match = scriptContent.match(/(?:window\.|var\s+|const\s+|let\s+)?masterPlaylist\s*=\s*(\{[\s\S]*?\})(?:;|\s|$)/);

            let masterPlaylist = null;
            let canPlayFHD = false;

            if (match) {
                try {
                    const jsonStr = match[1]
                        .replace(/(\w+):/g, '"$1":')
                        .replace(/'/g, '"')
                        .replace(/,\s*}/g, '}');
                    masterPlaylist = JSON.parse(jsonStr);
                } catch (e) {
                    const urlMatch = match[1].match(/url:\s*['"]([^'"]+)['"]/);
                    const tokenMatch = match[1].match(/token:\s*['"]([^'"]+)['"]/);
                    const expiresMatch = match[1].match(/expires:\s*['"]([^'"]+)['"]/);

                    if (urlMatch) {
                        masterPlaylist = {
                            url: urlMatch[1],
                            params: {
                                token: tokenMatch ? tokenMatch[1] : '',
                                expires: expiresMatch ? expiresMatch[1] : ''
                            }
                        };
                    }
                }
            }

            if (scriptContent.includes('canPlayFHD: true') || scriptContent.includes('canPlayFHD = true')) {
                canPlayFHD = true;
            }

            if (!masterPlaylist || !masterPlaylist.url) return [];

            const { url: baseUrl, params } = masterPlaylist;
            let token = params?.token;
            let expires = params?.expires;

            // Fallback: Extract token/expires from the embed URL if missing
            if (!token || !expires) {
                try {
                    const urlObj = new URL(embedUrl);
                    if (!token) token = urlObj.searchParams.get('token');
                    if (!expires) expires = urlObj.searchParams.get('expires');
                } catch (e) {
                    // Ignore URL parsing error
                }
            }

            const paramStr = `token=${encodeURIComponent(token || '')}&expires=${encodeURIComponent(expires || '')}`;
            let finalUrl;
            if (baseUrl.includes('?b')) {
                finalUrl = baseUrl.replace('?b:1', '?b=1') + `&${paramStr}`;
            } else {
                finalUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + paramStr;
            }

            const beforeQuery = finalUrl.split('?')[0];
            if (!/\.m3u8$/i.test(beforeQuery)) {
                const query = finalUrl.split('?')[1] || '';
                finalUrl = beforeQuery.replace(/\/$/, '') + '.m3u8' + (query ? `?${query}` : '');
            }

            if (canPlayFHD) {
                finalUrl += '&h=1';
            }

            return [{
                title: '[VIX] Stream',
                url: finalUrl,
                behaviorHints: {
                    notWebReady: true,
                    requestHeaders: headers
                }
            }];

        } catch (e) {
            console.error(`[VixCloud] Error: ${e.message}`);
            return [];
        }
    }
};

const VixCloudMediaFlowExtractor = {
    supports: (url) => /vixcloud\./i.test(url) && settings.MEDIAFLOW_URL,
    extract: async (url) => {
        const mfpUrl = settings.MEDIAFLOW_URL;
        const mfpPassword = settings.MEDIAFLOW_PASSWORD;

        if (!mfpUrl) return [];

        try {
            const embedUrl = normalizeUrl(url);
            const encoded = encodeURIComponent(embedUrl);
            const base = mfpUrl.replace(/\/$/, '');
            const passwordParam = mfpPassword ? `&api_password=${encodeURIComponent(mfpPassword)}` : '';

            // We use the 'redirect_stream=true' to get the final m3u8 directly
            const finalUrl = `${base}/extractor/video?host=VixCloud${passwordParam}&d=${encoded}&redirect_stream=true`;

            return [{
                title: '[VIX] Stream (Proxy)',
                url: finalUrl,
                behaviorHints: { notWebReady: true }
            }];
        } catch (e) {
            console.error(`[VixCloudProxy] Error: ${e.message}`);
            return [];
        }
    }
};

// --- Main Export ---

async function resolveSupervideo(link) {
    try {
        const html = await get(link);
        if (!html) return null;
        const m = html.match(/}\('(.+?)',.+,'(.+?)'\.split/);
        if (!m) return null;
        const terms = m[2].split('|');
        const fileIndex = terms.indexOf('file');
        if (fileIndex === -1) return null;
        let hfs = '';
        for (let i = fileIndex; i < terms.length; i++) {
            if (terms[i].includes('hfs')) {
                hfs = terms[i];
                break;
            }
        }
        if (!hfs) return null;
        const urlsetIndex = terms.indexOf('urlset');
        const hlsIndex = terms.indexOf('hls');
        if (urlsetIndex === -1 || hlsIndex === -1 || hlsIndex <= urlsetIndex) return null;
        const slice = terms.slice(urlsetIndex + 1, hlsIndex).reverse();
        let base = `https://${hfs}.serversicuro.cc/hls/`;
        if (slice.length === 1) return base + ',' + slice[0] + '.urlset/master.m3u8';
        slice.forEach((el, idx) => {
            base += el + ',' + (idx === slice.length - 1 ? '.urlset/master.m3u8' : '');
        });
        return base;
    } catch (e) {
        console.error(`[Extractor] Supervideo error: ${e.message}`);
        return null;
    }
}

async function extractFromUrl(url) {
    console.log(`[Extractor] Extracting from: ${url}`);
    const streams = [];

    try {
        // 1. Clicka.cc Redirect
        if (url.includes('clicka.cc')) {
            console.log('[Extractor] Handling Clicka.cc...');
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                redirect: 'follow'
            });
            const finalUrl = res.url;
            console.log(`[Extractor] Clicka redirected to: ${finalUrl}`);
            // Recursive call for the final URL
            const subResult = await extractFromUrl(finalUrl);
            streams.push(...subResult.streams);
            return { streams };
        }

        // 2. Uprot.net / MaxStream
        if (url.includes('uprot.net') || url.includes('maxstream')) {
            console.log('[Extractor] Handling Uprot/MaxStream...');
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const html = await res.text();
            const match = html.match(/src:\s*["']([^"']+\.mp4)["']/);
            if (match) {
                streams.push({
                    url: match[1],
                    title: 'MaxStream',
                    behaviorHints: { notWebReady: true }
                });
            }
        }

        // 3. SuperVideo
        if (url.includes('supervideo')) {
            const resolved = await resolveSupervideo(url);
            if (resolved) {
                streams.push({
                    url: resolved,
                    title: 'SuperVideo',
                    isDirectStream: true,
                    behaviorHints: { notWebReady: true }
                });
            }
        }

        // 4. MixDrop
        if (MixdropExtractor.supports(url)) {
            const results = await MixdropExtractor.extract(url);
            streams.push(...results);
        }

        // 5. Streamtape
        if (StreamtapeExtractor.supports(url)) {
            const results = await StreamtapeExtractor.extract(url);
            streams.push(...results);
        }

        // 6. DoodStream
        if (DoodStreamExtractor.supports(url)) {
            const results = await DoodStreamExtractor.extract(url);
            streams.push(...results);
        }

        // 7. VixCloud (Direct & Proxy)
        if (VixCloudHlsExtractor.supports(url)) {
            // Try Direct first
            const directResults = await VixCloudHlsExtractor.extract(url);
            streams.push(...directResults);

            // Try Proxy if configured
            if (VixCloudMediaFlowExtractor.supports(url)) {
                const proxyResults = await VixCloudMediaFlowExtractor.extract(url);
                streams.push(...proxyResults);
            }
        }

    } catch (e) {
        console.error(`[Extractor] Extract error for ${url}: ${e.message}`);
    }

    return { streams };
}

module.exports = {
    extractFromUrl,
    resolveSupervideo
};
