global.window = {};
require(require('path').join(process.cwd(), 'tex.js'));
const T = global.window.Tex, fs = require('fs');
const ids = ['lang','chem','french','calcbc','apush'];
let problems = [], total = 0;
const seen = new Map();
for (const id of ids) {
  const d = JSON.parse(fs.readFileSync(`data/${id}.json`,'utf8'));
  const unitIds = new Set(d.units.map(u=>u.id));
  for (const c of d.cards) {
    total++;
    for (const f of ['q','a']) {
      const v = c[f];
      if (!v || !v.trim()) problems.push(`${id}/${c.i} empty ${f}`);
      if ((v.match(/\$/g)||[]).length % 2 && /\$[^$]*[\\^_]/.test(v)) problems.push(`${id}/${c.i} unbalanced math $ in ${f}: ${v.slice(0,70)}`);
      let html;
      try { html = T.html(v); } catch(e) { problems.push(`${id}/${c.i} tex threw on ${f}: ${e.message}`); continue; }
      if (/\\[a-zA-Z]/.test(html)) problems.push(`${id}/${c.i} unrendered macro in ${f}: ${html.match(/\\[a-zA-Z]+/)[0]}`);
      if (/undefined<|>NaN|class="math">\s*<\/span>/.test(html)) problems.push(`${id}/${c.i} suspicious render in ${f}`);
    }
    if (!unitIds.has(c.u)) problems.push(`${id}/${c.i} unknown unit ${c.u}`);
    if (c.a.length > 420) problems.push(`${id}/${c.i} very long answer (${c.a.length})`);
    if (c.n && c.n.length > 240) problems.push(`${id}/${c.i} very long note (${c.n.length})`);
    const key = id + '|' + c.q.toLowerCase().replace(/\s+/g,' ').trim().replace(/[.?!:]+$/,'');
    if (seen.has(key)) problems.push(`${id} near-dup front: ${c.i} ~ ${seen.get(key)} :: ${c.q.slice(0,60)}`);
    else seen.set(key, c.i);
    if (c.x && !Array.isArray(c.x)) problems.push(`${id}/${c.i} alt is not an array`);
  }
  // per-unit coverage
  for (const u of d.units) if (!u.count) problems.push(`${id} unit ${u.id} is empty`);
}
console.log(`${total} cards linted, ${problems.length} problems`);
problems.slice(0,60).forEach(p=>console.log('  -',p));
if (problems.length>60) console.log(`  ... ${problems.length-60} more`);
