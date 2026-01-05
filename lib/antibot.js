const fetch = require('node-fetch');
let COOKIE_JAR = '';
let XSRF_TOKEN = '';

function baseHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://streamingunity.co/it/archive',
    'Origin': 'https://streamingunity.co',
    'Connection': 'keep-alive'
  };
}

function buildHeaders(json = false) {
  const h = baseHeaders();
  if (COOKIE_JAR) h['Cookie'] = COOKIE_JAR;
  if (XSRF_TOKEN) h['x-xsrf-token'] = decodeURIComponent(XSRF_TOKEN);
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function warmUp(logger) {
  const url = 'https://streamingunity.co/it/archive';
  logger.info('[ANTIBOT] Warm-up GET ' + url);
  try {
    const res = await fetch(url, { headers: baseHeaders() });
    const raw = res.headers.raw()['set-cookie'] || [];
    if (raw.length) {
      const jarParts = [];
      const seenNames = new Set();
      for (const c of raw) {
        const main = c.split(';')[0];
        const [name] = main.split('=');
        if (!seenNames.has(name)) {
          jarParts.push(main);
          seenNames.add(name);
        }
        if (name === 'XSRF-TOKEN') {
          XSRF_TOKEN = main.split('=')[1];
        }
      }
      COOKIE_JAR = jarParts.join('; ');
      logger.info('[ANTIBOT] Cookies captured');
      if (XSRF_TOKEN) logger.info('[ANTIBOT] XSRF token captured');
    } else {
      logger.warn('[ANTIBOT] No Set-Cookie headers received');
    }
  } catch (e) {
    logger.error('[ANTIBOT] Warm-up failed: ' + e.message);
  }
}

module.exports = { warmUp, buildHeaders, baseHeaders };
