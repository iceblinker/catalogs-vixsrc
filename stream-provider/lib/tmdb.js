const fetch = require('node-fetch');
let TMDB_API_KEY = process.env.TMDB_API_KEY || '';
if (!TMDB_API_KEY) console.warn('[TMDB] API key not set; searches will fail');
const memoryCache = new Map();
let lastTs=0;

function configure(key){ if (key) TMDB_API_KEY=key; }

const PRUNE_THRESHOLD = parseInt(process.env.TMDB_CACHE_PRUNE_MISSES || '5',10);

async function getTMDBId(title, type, minDelayMs, logger, db){
  const normKey = `${type}:${title.toLowerCase().trim()}`;
  if (memoryCache.has(normKey)) return memoryCache.get(normKey);
  // persistent cache lookup
  if (db){
    try {
      const row = db.prepare('SELECT tmdb_id, misses_count FROM tmdb_cache WHERE type = ? AND normalized_title = ?').get(type, normKey.split(':')[1]);
      if (row){
        if (row.tmdb_id === null && row.misses_count >= PRUNE_THRESHOLD){
          memoryCache.set(normKey, null);
          return null; // prune behavior: stop querying
        }
        memoryCache.set(normKey, row.tmdb_id || null);
        return row.tmdb_id || null;
      }
    } catch(e){ logger.warn('[TMDB] Persistent cache lookup failed '+e.message); }
  }
  const now=Date.now(); const delta=now-lastTs;
  if (minDelayMs>0 && delta<minDelayMs){ await new Promise(r=>setTimeout(r, minDelayMs - delta)); }
  try {
    const query=encodeURIComponent(title);
    const tmdbType = type==='tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${TMDB_API_KEY}&query=${query}`;
    const res = await fetch(url);
    lastTs=Date.now();
    if (!res.ok){ logger.warn(`[TMDB] HTTP ${res.status} for ${title} (${type})`); memoryCache.set(normKey,null); missPersist(db,type,normKey.split(':')[1]); return null; }
    const data = await res.json();
    if (data.results && data.results[0]){ const id = data.results[0].id; memoryCache.set(normKey,id); hitPersist(db,type,normKey.split(':')[1],id); return id; }
    logger.info(`[TMDB] No results for ${title} (${type})`); memoryCache.set(normKey,null); missPersist(db,type,normKey.split(':')[1]); return null;
  } catch(err){ logger.error(`[TMDB] Error for ${title} (${type}) ${err.message}`); memoryCache.set(normKey,null); missPersist(db,type,normKey.split(':')[1]); return null; }
}

function hitPersist(db,type,normalizedTitle,tmdbId){
  if (!db) return;
  try {
    db.prepare('INSERT OR REPLACE INTO tmdb_cache (type, normalized_title, tmdb_id, misses_count) VALUES (?,?,?,0)')
      .run(type, normalizedTitle, tmdbId);
  } catch(e){ /* ignore */ }
}

function missPersist(db,type,normalizedTitle){
  if (!db) return;
  try {
    const row = db.prepare('SELECT tmdb_id, misses_count FROM tmdb_cache WHERE type=? AND normalized_title=?').get(type, normalizedTitle);
    if (!row){
      db.prepare('INSERT INTO tmdb_cache (type, normalized_title, tmdb_id, misses_count) VALUES (?,?,NULL,1)').run(type, normalizedTitle);
    } else {
      const misses = (row.misses_count || 0) + 1;
      db.prepare('UPDATE tmdb_cache SET misses_count=? WHERE type=? AND normalized_title=?').run(misses, type, normalizedTitle);
      if (misses >= PRUNE_THRESHOLD){
        // Optionally delete; we keep row but further lookups skip searching.
      }
    }
  } catch(e){ /* ignore */ }
}

module.exports = { getTMDBId, configure };
