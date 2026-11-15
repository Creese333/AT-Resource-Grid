/* A.T. Resource Grid service worker.
   Opening the app: the saved copy of the page and its data files is shown straight away, and a fresh copy is
   fetched in the background. If the page changed, the app shows "Updated - tap to reload".
   "Save for offline" (at the bottom of About the data) stores all the data files and the imagery tiles along the trail
   in a separate store, OFF, which survives updates to this file. */
const VER = 'atgrid-v3';
const OFF = 'atoffline-1';          /* filled by Save for offline; never cleared here */
const LIVE = 'atlive-1';            /* last copy of the trail line, mile points and point layers (shelters, campsites...) */
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'images/icon-192.png', 'images/icon-512.png'];
const STATIC = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const TILEHOST = 'basemap.nationalmap.gov';
const SVCHOST = 'services1.arcgis.com';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('atgrid-') && k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const keep = (name, r, res) => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(name).then(c => c.put(r, cp)).catch(() => {}); } return res; };
const tellPages = msg => self.clients.matchAll({type: 'window'}).then(cs => cs.forEach(c => c.postMessage(msg)));

/* the saved copy right away; a fresh copy in the background (and a note to the page when the page itself changed) */
function fastThenFresh(e, r, isPage) {
  const key = isPage ? 'index.html' : r;
  const saved = caches.match(key, {ignoreSearch: true});
  const fresh = fetch(r, {cache: 'no-cache'}).then(async res => {
    if (res.ok && res.type === 'basic') {
      if (isPage) {
        const old = await saved, tag = h => h && (h.headers.get('etag') || h.headers.get('last-modified'));
        if (old && tag(old) && tag(res) && tag(old) !== tag(res)) tellPages({type: 'updated'});
      }
      const c = await caches.open(VER); await c.put(key, res.clone());
    }
    return res;
  });
  e.waitUntil(fresh.catch(() => {}));
  return saved.then(m => m || fresh).catch(() => fresh);
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    const isPage = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('/index.html');
    if (isPage || u.pathname.includes('/data/') || u.pathname.includes('/images/')) {
      e.respondWith(fastThenFresh(e, r, isPage).catch(() => caches.match(r, {ignoreSearch: true}).then(m => m || Response.error())));
      return;
    }
    e.respondWith(fetch(r).then(res => res.type === 'basic' ? keep(VER, r, res) : res)
      .catch(() => caches.match(r, {ignoreSearch: true}).then(m => m || Response.error())));
    return;
  }

  /* imagery tiles: a saved tile is used straight away; others come from the network */
  if (u.hostname === TILEHOST && u.pathname.includes('/tile/')) {
    e.respondWith(caches.open(OFF).then(c => c.match(r.url)).then(m => m || fetch(r)));
    return;
  }

  /* trail line, mile points and point layers: network first, last copy offline (area-by-area queries are not kept) */
  if (u.hostname === SVCHOST && !u.searchParams.has('geometry')) {
    e.respondWith(fetch(r).then(res => keep(LIVE, r, res)).catch(() => caches.match(r.url).then(m => m || Response.error())));
    return;
  }

  /* Leaflet and fonts: kept once fetched */
  if (STATIC.includes(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => keep(VER, r, res))));
  }
});
