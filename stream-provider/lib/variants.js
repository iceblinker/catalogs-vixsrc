function chooseCanonical(titles, languages) {
  // Prefer Italian then English; fallback longest stripped.
  if (!Array.isArray(titles) || !titles.length) return '';
  const idxIt = languages.findIndex(l => l === 'it');
  if (idxIt >= 0 && titles[idxIt]) return titles[idxIt];
  const idxEn = languages.findIndex(l => l === 'en');
  if (idxEn >= 0 && titles[idxEn]) return titles[idxEn];
  const cleaned = titles.map(t => t.replace(/\([^)]*\)/g, '').trim());
  return cleaned.sort((a, b) => b.length - a.length)[0] || titles[0];
}

function recordVariant(db, tmdbId, suTitle, type, logger, language) {
  try {
    const row = db.prepare('SELECT canonical_title, titles_json, types_json, languages_json FROM variant_titles WHERE tmdb_id = ?').get(tmdbId);
    if (!row) {
      const titles = [suTitle];
      const types = [type];
      const languages = [language || 'it'];
      const canonical = chooseCanonical(titles, languages);
      db.prepare('INSERT INTO variant_titles (tmdb_id, canonical_title, titles_json, types_json, languages_json) VALUES (?, ?, ?, ?, ?)')
        .run(tmdbId, canonical, JSON.stringify(titles), JSON.stringify(types), JSON.stringify(languages));
      logger.debug(`[VARIANT] New variant record tmdb_id=${tmdbId}`);
      return;
    }
    let titles; let types; let languages;
    try { titles = JSON.parse(row.titles_json) || []; } catch { titles = []; }
    try { types = JSON.parse(row.types_json) || []; } catch { types = []; }
    try { languages = JSON.parse(row.languages_json) || []; } catch { languages = []; }
    let changed = false;
    if (suTitle && !titles.includes(suTitle)) { titles.push(suTitle); changed = true; }
    if (type && !types.includes(type)) { types.push(type); changed = true; }
    if (language && !languages.includes(language)) { languages.push(language); changed = true; }
    if (changed) {
      const canonical = chooseCanonical(titles, languages);
      db.prepare('UPDATE variant_titles SET titles_json = ?, types_json = ?, languages_json = ?, canonical_title = ? WHERE tmdb_id = ?')
        .run(JSON.stringify(titles), JSON.stringify(types), JSON.stringify(languages), canonical, tmdbId);
      logger.debug(`[VARIANT] Updated variants tmdb_id=${tmdbId} titles=${titles.length} canonical='${canonical}'`);
    }
  } catch (e) {
    logger.warn(`[VARIANT] Failed recordVariant tmdb_id=${tmdbId} ${e.message}`);
  }
}

// Enrich variant languages using DB metadata (original_title + optional languages column).
function enrichVariantLanguagesFromDB(db, logger) {
  try {
    const variantRows = db.prepare('SELECT tmdb_id, titles_json, languages_json FROM variant_titles').all();
    const movies = db.prepare('SELECT tmdb_id, original_title, original_language FROM movie_metadata').all();
    const tvs = db.prepare('SELECT tmdb_id, original_title, original_language, languages FROM tv_metadata').all();
    const vMap = new Map(variantRows.map(r => [r.tmdb_id, r]));
    function update(tmdbId, originalTitle, originalLanguage, extraLanguagesJson) {
      const row = vMap.get(tmdbId); if (!row) return;
      let titles = []; let languages = [];
      try { titles = JSON.parse(row.titles_json) || []; } catch { }
      try { languages = JSON.parse(row.languages_json) || []; } catch { }
      if (originalTitle && !titles.includes(originalTitle)) titles.push(originalTitle);
      const iso = (originalLanguage || '').trim();
      if (iso && !languages.includes(iso)) languages.push(iso);
      if (extraLanguagesJson) {
        try {
          const arr = JSON.parse(extraLanguagesJson) || [];
          for (const l of arr) {
            const code = (l || '').trim();
            if (code && !languages.includes(code)) languages.push(code);
          }
        } catch { }
      }
      // Fallback tags based on script
      if (originalTitle) {
        const hasNonAscii = /[^\x00-\x7F]/.test(originalTitle);
        const tag = hasNonAscii ? 'orig' : 'en';
        if (!languages.includes(tag)) languages.push(tag);
      }
      const canonical = chooseCanonical(titles, languages);
      db.prepare('UPDATE variant_titles SET titles_json=?, languages_json=?, canonical_title=? WHERE tmdb_id=?')
        .run(JSON.stringify(titles), JSON.stringify(languages), canonical, tmdbId);
    }
    movies.forEach(m => update(m.tmdb_id, m.original_title, m.original_language, null));
    tvs.forEach(t => update(t.tmdb_id, t.original_title, t.original_language, t.languages));
    logger.info('[VARIANT_LANG] Enriched variant languages (pass)');
  } catch (e) { logger.warn('[VARIANT_LANG] Enrichment failed ' + e.message); }
}

module.exports = { recordVariant, chooseCanonical, enrichVariantLanguagesFromDB };

