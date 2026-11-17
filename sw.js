/* A.T. Resource Grid service worker.
   Opening the app: the saved copy of the page and its data files is shown straight away, and a fresh copy is
   fetched in the background. If the page or its code changed, the app shows "Updated - tap to reload".
   "Save for offline" (at the bottom of About the data) stores all the data files and the imagery tiles along the trail
   in a separate store, OFF, which survives updates to this file.
   v5: saved copies are looked up by exact address in the two stores that hold them (a search that ignores ?query text reads
   every saved tile, which made opening slow once the trail's imagery was saved), and "updated" compares the files' contents:
   every publish gives all files a new date and tag, even when they have not changed.
   v6: basemap tiles are left to the browser unless Save for offline has been used; when it has, the offline store is opened once
   and kept open instead of being opened again for every tile. */
const VER = 'atgrid-v6';
const OFF = 'atoffline-1';          /* filled by Save for offline; never cleared here */
const LIVE = 'atlive-1';            /* last copy of the trail line, mile points and point layers (shelters, campsites...) */
const SHELL = ['./', 'index.html', 'data/app.js', 'data/inat.js', 'data/grid.json', 'manifest.webmanifest', 'images/icon-192.png', 'images/icon-512.png'];
const STATIC = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TILEHOST = 'basemap.nationalmap.gov';
const SVCHOST = 'services1.arcgis.com';
const WATCH = /\/data\/(app\.js|inat\.js|grid\.json)$/;   /* besides the page: the files whose change means a new version */

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('atgrid-') && k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (name, r, res) => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(name).then(c => c.put(r, cp)).catch(() => {}); } return res; };
let told = false;
const tellPages = msg => { if (told) return; told = true; setTimeout(() => { told = false; }, 30000);
  return self.clients.matchAll({type: 'window'}).then(cs => cs.forEach(c => c.postMessage(msg))); };

/* the offline store, opened once and looked at again every 20 s (Save for offline and its removal happen in the page).
   offStore() is null when there is no store, so tiles need not pass through here at all. */
let offOpen = Promise.resolve(undefined), offHas, offAt = 0;
function offStore() {
  if (Date.now() - offAt > 20000) { offAt = Date.now();
    const p = caches.has(OFF).then(h => { offHas = h; return h ? caches.open(OFF) : undefined; }).catch(() => undefined);
    if (offHas === undefined) offOpen = p; else p.then(c => { offOpen = Promise.resolve(c); }); }
  return offHas === false ? null : offOpen;
}
offStore();

/* the saved copy of an address: this version's store first, then the offline store (exact address, no scan) */
async function savedCopy(key) {
  for (const name of [VER, OFF]) { const c = await caches.open(name), m = await c.match(key); if (m) return m; }
  return undefined;
}
async function sameBody(a, b) {
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  if (x.byteLength !== y.byteLength) return false;
  const [h1, h2] = await Promise.all([crypto.subtle.digest('SHA-256', x), crypto.subtle.digest('SHA-256', y)]);
  const u = new Uint8Array(h1), v = new Uint8Array(h2); for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false; return true;
}

/* the saved copy right away; a fresh copy in the background (and a note to the page when the page or its code really changed) */
function fastThenFresh(e, r, isPage) {
  const u = new URL(r.url), key = isPage ? new URL('index.html', self.registration.scope).href : u.origin + u.pathname;
  const saved = savedCopy(key);
  const fresh = fetch(r, {cache: 'no-cache'}).then(async res => {
    if (res.ok && res.type === 'basic') {
      if (isPage || WATCH.test(u.pathname)) {
        const old = await saved;
        if (old && !(await sameBody(old, res.clone()).catch(() => true))) tellPages({type: 'updated'});
      }
      const c = await caches.open(VER); await c.put(key, res.clone());
    }
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  return saved.then(m => m ? m.clone() : fresh).catch(() => fresh);   /* the page gets a copy; the saved one is kept for the comparison */
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    const isPage = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('/index.html');
    if (isPage || u.pathname.includes('/data/') || u.pathname.includes('/images/')) {
      e.respondWith(fastThenFresh(e, r, isPage).catch(() => savedCopy(u.origin + u.pathname).then(m => m || Response.error())));
      return;
    }
    e.respondWith(fetch(r).then(res => res.type === 'basic' ? keep(VER, r, res) : res)
      .catch(() => savedCopy(u.origin + u.pathname).then(m => m || Response.error())));
    return;
  }

  /* imagery tiles: a saved tile is used straight away; others come from the network */
  if (u.hostname === TILEHOST && u.pathname.includes('/tile/')) {
    if (offStore() === null) return;   /* nothing saved: the browser fetches and keeps the tile itself */
    e.respondWith(offOpen.then(c => c ? c.match(r.url) : undefined).then(m => m || fetch(r)).catch(() => fetch(r)));
    return;
  }

  /* trail line, mile points and point layers: network first, last copy offline (area-by-area queries are not kept) */
  if (u.hostname === SVCHOST && !u.searchParams.has('geometry')) {
    e.respondWith(fetch(r).then(res => keep(LIVE, r, res)).catch(() => caches.open(LIVE).then(c => c.match(r.url)).then(m => m || Response.error())));
    return;
  }

  /* Leaflet and fonts: kept once fetched */
  if (STATIC.includes(u.hostname)) {
    e.respondWith(caches.open(VER).then(c => c.match(r)).then(m => m || fetch(r).then(res => keep(VER, r, res))));
  }
});
