/* A.T. Resource Grid service worker.
   The page and the grid data always come from the network first, so an update on GitHub shows up on the next open;
   the last copy is kept and used when there is no signal. Map libraries and fonts are kept once fetched.
   Live services (ArcGIS, iNaturalist, map tiles) are left alone. */
const VER = 'atgrid-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'images/icon-192.png', 'images/icon-512.png'];
const STATIC = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('atgrid-') && k !== VER).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  /* the page and its own files: network first, keep a copy, fall back to the copy offline */
  if (u.origin === self.location.origin) {
    e.respondWith(fetch(r).then(res => {
      if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(VER).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r, {ignoreSearch: r.mode === 'navigate'})
      .then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
    return;
  }

  /* Leaflet and fonts: kept once fetched */
  if (STATIC.includes(u.hostname)) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(VER).then(c => c.put(r, cp)); }
      return res;
    })));
  }
  /* everything else (live map services, tiles, iNaturalist): straight to the network */
});
