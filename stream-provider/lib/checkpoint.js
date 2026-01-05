const fs = require('fs');
const path = require('path');

function writeCheckpoint(entry){
  try {
    const file = path.join(__dirname,'..','checkpoint.json');
    let data={ progress: [] };
    if (fs.existsSync(file)){
      try { data = JSON.parse(fs.readFileSync(file,'utf8')); } catch(_) { data={ progress: [] }; }
    }
    const key = `${entry.type}-${entry.kind||'year'}-${entry.year}`;
    const idx = data.progress.findIndex(p => `${p.type}-${p.kind||'year'}-${p.year}` === key);
    if (idx>=0) data.progress[idx] = { ...data.progress[idx], ...entry }; else data.progress.push(entry);
    fs.writeFileSync(file, JSON.stringify(data,null,2));
  } catch(e){
    console.warn('[CHECKPOINT] Failed to write checkpoint:', e.message);
  }
}

function loadCheckpoint(){
  const file = path.join(__dirname,'..','checkpoint.json');
  if (!fs.existsSync(file)) return { completed: new Set(), partial: new Map() };
  try {
    const data = JSON.parse(fs.readFileSync(file,'utf8'));
    const completed = new Set();
    const partial = new Map();
    if (data && Array.isArray(data.progress)){
      for (const p of data.progress){
        const kind = p.kind || 'year';
        if (p.completed) completed.add(`${p.type}:${kind}:${p.year}`);
        else if (p.lastOffset !== null && p.lastOffset !== undefined) partial.set(`${p.type}:${kind}:${p.year}`, p.lastOffset);
      }
    }
    return { completed, partial };
  } catch(e){
    console.warn('[CHECKPOINT] Failed loading checkpoint:', e.message);
    return { completed: new Set(), partial: new Map() };
  }
}

module.exports = { writeCheckpoint, loadCheckpoint };