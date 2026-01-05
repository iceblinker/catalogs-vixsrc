const fs = require('fs');
const path = require('path');
let pino;
try { pino = require('pino'); } catch (_) {
  // Fallback minimal logger if pino not yet installed
  function fallback(level, msg, ctx) {
    const line = JSON.stringify({ ts: Date.now(), level, msg, ...(ctx||{}) });
    console.log(line);
    return line;
  }
  module.exports = {
    info: (m,c)=>fallback('info',m,c),
    warn: (m,c)=>fallback('warn',m,c),
    error: (m,c)=>fallback('error',m,c),
    debug: (m,c)=>fallback('debug',m,c)
  };
  return;
}

const logFile = path.join(__dirname, '..', 'ingest-structured.log');
let stream = fs.createWriteStream(logFile, { flags: 'a' });
const zlib = require('zlib');
const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: undefined }, stream);

let logCount=0;
const ROTATE_SIZE = parseInt(process.env.LOG_ROTATE_SIZE || (5*1024*1024),10); // 5MB default
const ROTATE_EVERY = 200; // check every 200 logs

function rotateIfNeeded(){
  try {
    const { size } = fs.statSync(logFile);
    if (size >= ROTATE_SIZE){
      const stamp = new Date().toISOString().replace(/[:]/g,'-');
      const rotated = logFile.replace(/\.log$/, '') + '.' + stamp + '.log';
      stream.end();
      fs.renameSync(logFile, rotated);
      // Compress rotated file
      try {
        // For small rotation size (default 5MB) synchronous compression is acceptable and simpler.
        const buf = fs.readFileSync(rotated);
        const gz = zlib.gzipSync(buf);
        fs.writeFileSync(rotated + '.gz', gz);
        fs.unlinkSync(rotated); // remove uncompressed after successful gzip
        logger.info(`[LOG] Rotated & compressed -> ${path.basename(rotated)}.gz`);
      } catch(e){ logger.warn('[LOG] Compression failed '+e.message); }
      stream = fs.createWriteStream(logFile, { flags: 'a' });
    }
  } catch(e){ /* ignore */ }
}

['info','warn','error','debug'].forEach(level => {
  const orig = logger[level].bind(logger);
  logger[level] = (...args) => {
    logCount++;
    if (logCount % ROTATE_EVERY === 0) rotateIfNeeded();
    return orig(...args);
  };
});

module.exports = logger;
