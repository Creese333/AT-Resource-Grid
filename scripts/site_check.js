/* A.T. Resource Grid: checks the site before it is published (run by .github/workflows/site.yml).
   Fails, and so blocks publishing, if
   - a script in index.html, data/app.js, data/inat.js or sw.js has a syntax error,
   - a data file is not valid JSON,
   - a data file the published site has is missing, empty, or much smaller than before (when --prev is given),
   - the page throws an error or draws no grid cells on desktop or a phone, for any guiding question.
   Usage: node scripts/site_check.js <folder with the site> [port] [--prev <folder with the published site>]
   Set ALLOW_SMALLER=1 to let smaller or removed data files through (on purpose, for example after removing a species). */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const args = process.argv.slice(2), pi = args.indexOf('--prev'), PREV = pi >= 0 ? path.resolve(args[pi + 1]) : '';
if (pi >= 0) args.splice(pi, 2);
const ROOT = path.resolve(args[0] || '.'), PORT = +(args[1] || 8790), ALLOW = process.env.ALLOW_SMALLER === '1' || process.env.ALLOW_SMALLER === 'true';
const fails = []; const fail = m => { fails.push(m); console.log('FAIL  ' + m); }; const ok = m => console.log('ok    ' + m); const warn = m => console.log('warn  ' + m);
const LIVEQ = new Set(['land']);
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), has = f => fs.existsSync(path.join(ROOT, f));
const parses = (name, code) => { try { new vm.Script(code); ok(name + ' parses'); } catch (e) { fail(`${name}: ${e.message}`); } };

/* 1. scripts parse, and the grid is there */
const html = read('index.html');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { try { new vm.Script(s); } catch (e) { fail(`index.html script ${i + 1}: ${e.message}`); } });
ok(`${scripts.length} scripts in index.html checked`);
for (const f of ['data/app.js', 'data/inat.js', 'sw.js']) if (has(f)) parses(f, read(f));
const pay = html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/);
const gridText = pay ? pay[1] : has('data/grid.json') ? read('data/grid.json') : null;
if (!pay && !has('data/app.js')) fail('the page code is missing (no data/app.js)');
if (gridText == null) fail('the grid data is missing (no data/grid.json)');
else { try { const d = JSON.parse(gridText); if (!d.levels || !d.levels.hex || !d.levels.hex.id.length) fail('grid data has no cells'); else ok(`grid data: ${d.levels.hex.id.length} cells`); } catch (e) { fail('grid data is not valid JSON: ' + e.message); } }

/* 2. data files are valid JSON */
const list = dir => { const out = []; const walk = d => fs.readdirSync(d, {withFileTypes: true}).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); if (fs.existsSync(dir)) walk(dir); return out; };
let nj = 0; for (const p of list(path.join(ROOT, 'data'))) if (p.endsWith('.json')) { nj++; try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { fail(`${path.relative(ROOT, p)} is not valid JSON`); } }
ok(`${nj} data files checked`);

/* 3. nothing went missing or shrank, compared with the published site */
/* how many records a JSON file holds: the longest list found in its first two levels */
const records = t => { let d; try { d = JSON.parse(t); } catch (e) { return 0; } let n = 0;
  const look = (v, depth) => { if (Array.isArray(v)) n = Math.max(n, v.length); if (depth < 2 && v && typeof v === 'object') for (const k in v) look(v[k], depth + 1); };
  look(d, 0); return n; };
if (PREV && fs.existsSync(path.join(PREV, 'data'))) {
  const gone = [], small = []; let n = 0;
  for (const p of list(path.join(PREV, 'data'))) {
    const rel = path.relative(PREV, p), now = path.join(ROOT, rel), was = fs.statSync(p).size; n++;
    if (!fs.existsSync(now)) { gone.push(rel); continue; }
    const is = fs.statSync(now).size;
    if (was > 0 && is === 0) { small.push(`${rel} is empty (was ${was} bytes)`); continue; }
    if (was < 4096) continue;                                       /* small files change size a lot on their own */
    if (is < was * 0.8) { small.push(`${rel} shrank from ${was} to ${is} bytes`); continue; }
    if (rel.endsWith('.json')) { const a = records(fs.readFileSync(p, 'utf8')), b = records(fs.readFileSync(now, 'utf8'));
      if (a >= 50 && b < a * 0.8) small.push(`${rel} holds ${b} records, down from ${a}`); }
  }
  const report = ALLOW ? warn : fail;
  gone.forEach(r => report(`${r} was removed`)); small.forEach(m => report(m));
  if (!gone.length && !small.length) ok(`${n} data files compared with the published site: none missing or smaller`);
  else if (ALLOW) warn('smaller data let through on purpose (allow smaller data was ticked)');
} else if (PREV) warn('no published copy to compare the data with');

/* 4. the page works on desktop and a phone, for every question */
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.webmanifest':'application/manifest+json', '.gz':'application/gzip', '.css':'text/css', '.svg':'image/svg+xml'};
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r); });
(async () => {
  if (fails.length) throw new Error('stopped before the browser checks');
  await new Promise(r => server.listen(PORT, r));
  const {chromium, devices} = require('playwright'); const b = await chromium.launch();
  const LOCAL_LEAFLET = process.env.LOCAL_LEAFLET;   /* a folder with leaflet.js and leaflet.css, for running without internet */
  const views = [['desktop', {viewport: {width: 1440, height: 900}}], ['phone', devices['iPhone 13']]];
  /* the page is ready once the app has drawn its question list (the code and grid load after the loading screen) */
  const ready = p => p.waitForFunction(() => document.querySelectorAll('#qpick [data-q]').length > 0, null, {timeout: 60000}).catch(() => {});
  for (const [name, opts] of views) {
    const cx = await b.newContext({...opts, serviceWorkers: 'block'});
    await cx.addInitScript(() => { try { localStorage.setItem('atgrid_howseen', '1'); } catch (e) {} });
    if (LOCAL_LEAFLET) await cx.route(/leaflet/, r => r.fulfill({path: path.join(LOCAL_LEAFLET, r.request().url().endsWith('.css') ? 'leaflet.css' : 'leaflet.js')}));
    const p = await cx.newPage(); let errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'load', timeout: 60000}); await ready(p); await p.waitForTimeout(3000);
    const qs = await p.evaluate(() => [...document.querySelectorAll('#qpick [data-q]')].map(e => e.dataset.q));
    if (!qs.length) fail(`${name}: no guiding questions found${errs.length ? ' (' + errs[0] + ')' : ''}`);
    for (const q of qs) {
      errs = []; await p.goto(`http://localhost:${PORT}/index.html#q=${q}`); await p.reload({waitUntil: 'load'}); await ready(p);
      /* grid cells are drawn on this canvas; give each question up to 12 seconds to draw */
      const count = () => p.evaluate(() => { const c = document.querySelector('.leaflet-cells-pane canvas'); if (!c || !c.width) return 0;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i]) n++; return n; }).catch(() => 0);
      let drawn = 0; for (let t = 0; t < 24 && drawn < 20; t++){ await p.waitForTimeout(500); drawn = await count(); }
      /* "land" opens on land protected over time, which loads live from the NPS map service: an outage there only warns */
      if (errs.length) fail(`${name}, question "${q}": ${errs[0]}`); else if (drawn < 20) (LIVEQ.has(q) ? m => warn(m + ' (a live map service may be down; not blocking)') : fail)(`${name}, question "${q}": the map drew nothing`);
    }
    ok(`${name}: ${qs.length} questions loaded`); await cx.close();
  }
  await b.close(); server.close();
})().catch(e => { if (!fails.length) fail(e.message); try { server.close(); } catch (x) {} }).then(() => {
  if (fails.length){ console.log(`\n${fails.length} problem(s): the site was NOT published; the last good version stays up.`); process.exit(1); }
  console.log('\nAll checks passed.');
});
