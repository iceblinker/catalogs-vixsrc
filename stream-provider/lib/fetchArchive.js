const fetch = require('node-fetch');
const { buildHeaders } = require('./antibot');
const { writeCheckpoint } = require('./checkpoint');

const API_ARCHIVE_BASE = 'https://streamingunity.co/api/archive';
const PAGE_SIZE = 60;
const MAX_PAGES = 200;

async function fetchArchivePage(type, offset, yearValue, logger){
  const base = `${API_ARCHIVE_BASE}?lang=it&offset=${offset}&type=${type}`;
  const url = yearValue ? `${base}&year=${yearValue}` : base;
  try {
    logger.info(`[FETCH] Page offset=${offset} type=${type} year=${yearValue || 'ALL'} -> ${url}`);
    const res = await fetch(url, { method:'GET', headers: buildHeaders() });
    if (!res.ok){
      logger.error(`[FETCH] HTTP error ${res.status} at offset ${offset} (${type})`);
      return { items: [], error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    if (text.startsWith('<')){
      logger.warn(`[FETCH] HTML response (challenge?) at offset ${offset} (${type}) len=${text.length}`);
      return { items: [], error: 'HTML_CHALLENGE' };
    }
    let data; try { data = JSON.parse(text); } catch(e){
      logger.error(`[FETCH] JSON parse error at offset ${offset} (${type}) ${e.message}`);
      return { items: [], error: 'PARSE_ERROR' };
    }
    let items;
    if (Array.isArray(data)) items = data;
    else if (data.titles && Array.isArray(data.titles)) items = data.titles;
    else if (data.results && Array.isArray(data.results)) items = data.results;
    else { logger.warn(`[FETCH] Unrecognized JSON shape keys=${Object.keys(data).join(',')}`); items=[]; }
    logger.info(`[FETCH] Received ${items.length} items at offset ${offset} (${type})`);
    return { items, error: null };
  } catch(err){
    logger.error(`[FETCH] Error offset ${offset} (${type}): ${err.message}`);
    return { items: [], error: err.message };
  }
}

async function fetchAllTitlesPaginated(type, yearValue, segmentMetric, resumeOffset, logger){
  const aggregated=[]; let consecutiveErrors=0;
  const startPage = resumeOffset ? Math.floor(resumeOffset / PAGE_SIZE) + 1 : 0;
  if (resumeOffset) logger.info(`[RESUME] Continue ${type} ${yearValue} from offset=${resumeOffset} startPage=${startPage}`);
  for (let pageIndex=startPage; pageIndex<MAX_PAGES; pageIndex++){
    const offset = pageIndex * PAGE_SIZE;
    const { items, error } = await fetchArchivePage(type, offset, yearValue, logger);
    if (error){
      consecutiveErrors++;
      logger.warn(`[FETCH] Error offset ${offset} (${type}) -> ${error} consecutiveErrors=${consecutiveErrors}`);
      if (consecutiveErrors>=3){
        logger.warn(`[FETCH] Too many consecutive errors; abort pagination (${type})`);
        if (segmentMetric){ segmentMetric.aborted=true; segmentMetric.pages=pageIndex; }
        break;
      }
      continue;
    }
    consecutiveErrors=0;
    if (items.length===0){
      logger.info(`[FETCH] No items at offset ${offset}; end pagination (${type})`);
      if (segmentMetric) segmentMetric.pages=pageIndex; break;
    }
    aggregated.push(...items);
    if (segmentMetric){
      segmentMetric.pages = pageIndex + 1;
      segmentMetric.collected = aggregated.length;
      writeCheckpoint({ type, year: yearValue, lastOffset: offset, completed:false });
    }
    if (items.length < PAGE_SIZE){
      logger.info(`[FETCH] Final partial page ${items.length} < ${PAGE_SIZE}; end pagination (${type})`);
      break;
    }
  }
  logger.info(`[FETCH] Pagination complete (${type}) collected=${aggregated.length}`);
  if (segmentMetric) segmentMetric.collected = aggregated.length;
  return aggregated;
}

module.exports = { fetchArchivePage, fetchAllTitlesPaginated, PAGE_SIZE };
