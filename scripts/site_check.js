/* A.T. Resource Grid: checks the site before it is published (run by .github/workflows/site.yml).
   Fails, and so blocks publishing, if
   - a script in index.html or sw.js has a syntax error,
   - a data file is not valid JSON,
   - the page throws an error or draws no grid cells on desktop or a phone, for any guiding question.
   Usage: node scripts/site_check.js <folder with the site> [port]                                   */
const fs = require('fs'), path = require('path'), http = require('http'), vm = require('vm');
const ROOT = path.resolve(process.argv[2] || '.'), PORT = +(process.argv[3] || 8790);
const fails = []; const fail = m => { fails.push(m); console.log('FAIL  ' + m); }; const ok = m => console.log('ok    ' + m); const warn = m => console.log('warn  ' + m + ' (a live map service may be down; not blocking)');
const LIVEQ = new Set(['land']);

/* 1. scripts parse */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
scripts.forEach((s, i) => { try { new vm.Script(s); } catch (e) { fail(`index.html script ${i + 1}: ${e.message}`); } });
ok(`${scripts.length} scripts in index.html checked`);
const pay = html.match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/);
if (!pay) fail('index.html has no grid data'); else { try { const d = JSON.parse(pay[1]); if (!d.levels || !d.levels.hex || !d.levels.hex.id.length) fail('grid data has no cells'); else ok(`grid data: ${d.levels.hex.id.length} cells`); } catch (e) { fail('grid data is not valid JSON: ' + e.message); } }
for (const f of ['sw.js']) if (fs.existsSync(path.join(ROOT, f))) { try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8')); ok(f + ' parses'); } catch (e) { fail(`${f}: ${e.message}`); } }

/* 2. data files are valid JSON */
let nj = 0; const walk = d => fs.readdirSync(d, {withFileTypes: true}).forEach(e => { const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) { nj++; try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch (x) { fail(`${path.relative(ROOT, p)} is not valid JSON`); } } });
if (fs.existsSync(path.join(ROOT, 'data'))) walk(path.join(ROOT, 'data')); ok(`${nj} data files checked`);

/* 3. the page works on desktop and a phone, for every question */
const TYPES = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.webmanifest':'application/manifest+json', '.gz':'application/gzip', '.css':'text/css', '.svg':'image/svg+xml'};
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, {'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream'}); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const {chromium, devices} = require('playwright'); const b = await chromium.launch();
  const LOCAL_LEAFLET = process.env.LOCAL_LEAFLET;   /* a folder with leaflet.js and leaflet.css, for running without internet */
  const views = [['desktop', {viewport: {width: 1440, height: 900}}], ['phone', devices['iPhone 13']]];
  for (const [name, opts] of views) {
    const cx = await b.newContext({...opts, serviceWorkers: 'block'});
    await cx.addInitScript(() => { try { localStorage.setItem('atgrid_howseen', '1'); } catch (e) {} });
    if (LOCAL_LEAFLET) await cx.route(/leaflet/, r => r.fulfill({path: path.join(LOCAL_LEAFLET, r.request().url().endsWith('.css') ? 'leaflet.css' : 'leaflet.js')}));
    const p = await cx.newPage(); let errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${PORT}/index.html`, {waitUntil: 'load', timeout: 60000}); await p.waitForTimeout(4000);
    const qs = await p.evaluate(() => [...document.querySelectorAll('#qpick [data-q]')].map(e => e.dataset.q));
    if (!qs.length) fail(`${name}: no guiding questions found`);
    for (const q of qs) {
      errs = []; await p.goto(`http://localhost:${PORT}/index.html#q=${q}`); await p.reload({waitUntil: 'load'}); await p.waitForTimeout(2500);
      const drawn = await p.evaluate(() => { const c = document.querySelector('.leaflet-cells-pane canvas'); if (!c || !c.width) return 0;   /* grid cells are drawn on this canvas */
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i]) n++; return n; }).catch(() => 0);
      /* "land" opens on land protected over time, which loads live from the NPS map service: an outage there only warns */
      if (errs.length) fail(`${name}, question "${q}": ${errs[0]}`); else if (drawn < 20) (LIVEQ.has(q) ? warn : fail)(`${name}, question "${q}": the map drew nothing`);
    }
    ok(`${name}: ${qs.length} questions loaded`); await cx.close();
  }
  await b.close(); server.close();
  if (fails.length){ console.log(`\n${fails.length} problem(s): the site was NOT published; the last good version stays up.`); process.exit(1); }
  console.log('\nAll checks passed.');
})().catch(e => { console.log('FAIL  ' + e.message); process.exit(1); });
