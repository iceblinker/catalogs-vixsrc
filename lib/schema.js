function columnExists(db, table, col){
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(r => r.name === col);
  } catch(e){ return false; }
}

function ensureSchema(db, logger){
  const movieCols = [
    ['su_original_title','TEXT'],
    ['su_description_raw','TEXT'],
    ['su_preview_html','TEXT'],
    ['su_language','TEXT']
  ];
  const tvCols = movieCols.concat([
    ['su_seasons_raw','TEXT']
  ]);
  for (const [col,type] of movieCols){
    if (!columnExists(db,'movie_metadata',col)){
      logger.info(`[SCHEMA] Adding column movie_metadata.${col}`);
      db.prepare(`ALTER TABLE movie_metadata ADD COLUMN ${col} ${type}`).run();
    }
  }
  for (const [col,type] of tvCols){
    if (!columnExists(db,'tv_metadata',col)){
      logger.info(`[SCHEMA] Adding column tv_metadata.${col}`);
      db.prepare(`ALTER TABLE tv_metadata ADD COLUMN ${col} ${type}`).run();
    }
  }

  // Tables: variant_titles, tmdb_cache
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS variant_titles (tmdb_id INTEGER PRIMARY KEY, canonical_title TEXT, titles_json TEXT, types_json TEXT, languages_json TEXT)` ).run();
  } catch(e){ logger.warn('[SCHEMA] variant_titles creation failed '+e.message); }
  try {
    db.prepare(`CREATE TABLE IF NOT EXISTS tmdb_cache (type TEXT NOT NULL, normalized_title TEXT NOT NULL, tmdb_id INTEGER, misses_count INTEGER DEFAULT 0, PRIMARY KEY(type, normalized_title))`).run();
  } catch(e){ logger.warn('[SCHEMA] tmdb_cache creation failed '+e.message); }

  // Add columns if schema already existed
  const extraVariantCols = ['languages_json'];
  for (const col of extraVariantCols){
    if (!columnExists(db,'variant_titles',col)){
      try { db.prepare(`ALTER TABLE variant_titles ADD COLUMN ${col} TEXT`).run(); } catch(_) {}
    }
  }
  const extraCacheCols = ['misses_count'];
  for (const col of extraCacheCols){
    if (!columnExists(db,'tmdb_cache',col)){
      try { db.prepare(`ALTER TABLE tmdb_cache ADD COLUMN ${col} INTEGER DEFAULT 0`).run(); } catch(_) {}
    }
  }
}

module.exports = { ensureSchema };
