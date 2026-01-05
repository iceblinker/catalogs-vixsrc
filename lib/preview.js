const fetch = require('node-fetch');
const { buildHeaders, warmUp } = require('./antibot');

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function sleepWithBackoff(base, attempt){
  const delay = base * Math.pow(2, attempt - 1);
  const jitter = delay * (0.75 + Math.random() * 0.5);
  return sleep(Math.round(jitter));
}

async function fetchPreview(id, type, metrics, logger, attempt=1){
  const url = `https://streamingunity.co/api/titles/preview/${id}?lang=it`;
  const MAX_ATTEMPTS = 4;
  const BASE_DELAY = 400;
  for (let a=attempt; a<=MAX_ATTEMPTS; a++){
    metrics.previewAttempts++;
    let res; let networkError=null;
    try { res = await fetch(url, { method:'POST', headers: buildHeaders(true), body:'{}' }); } catch(e){ networkError=e; }
    if (networkError){
      logger.warn(`[PREVIEW] Network error id=${id} (${type}) attempt=${a}: ${networkError.message}`);
      if (a===1) await warmUp(logger);
      if (a<MAX_ATTEMPTS){ await sleepWithBackoff(BASE_DELAY,a); continue; }
      metrics.previewTransientFailure++;
      metrics.previewFailures.push({ id, type, status:'NETWORK', attempts:a, body: networkError.message.slice(0,120)});
      return null;
    }
    if (!res.ok){
      if (res.status===419 && a===1){
        logger.warn(`[PREVIEW] 419 id=${id} (${type}) attempt=${a} -> re-warm & retry`);
        await warmUp(logger);
        await sleepWithBackoff(BASE_DELAY,a);
        continue;
      }
      const status=res.status;
      let body='';
      try { body=(await res.text()).slice(0,120);} catch(_){ body='<unreadable>'; }
      const isTransient = status>=500 || status===429;
      logger.warn(`[PREVIEW] HTTP ${status} id=${id} (${type}) attempt=${a}${isTransient?' (transient)':' (permanent)'} body="${body}"`);
      if (isTransient && a<MAX_ATTEMPTS){
        if (status===504 || status===503) await warmUp(logger);
        await sleepWithBackoff(BASE_DELAY,a); continue;
      }
      if (isTransient) metrics.previewTransientFailure++; else metrics.previewPermanentFailure++;
      metrics.previewFailures.push({ id, type, status, attempts:a, body });
      return null;
    }
    const text = await res.text();
    if (text.startsWith('<')){
      logger.warn(`[PREVIEW] HTML challenge id=${id} (${type}) len=${text.length}`);
      metrics.previewPermanentFailure++;
      metrics.previewFailures.push({ id, type, status:'HTML_CHALLENGE', attempts:a, body:text.slice(0,120)});
      return null;
    }
    let data; try { data=JSON.parse(text);} catch(e){
      logger.warn(`[PREVIEW] Parse error id=${id} (${type}) attempt=${a}: ${e.message}`);
      metrics.previewPermanentFailure++;
      metrics.previewFailures.push({ id, type, status:'PARSE', attempts:a, body:text.slice(0,120)});
      return null;
    }
    logger.info(`[PREVIEW] OK id=${id} (${type}) attempt=${a}`);
    if (a===1) metrics.previewSuccess++; else metrics.previewRetriedSuccess++;
    return data;
  }
  return null;
}

module.exports = { fetchPreview, sleepWithBackoff };
