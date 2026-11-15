
/* inat-lookup.js
 * iNaturalist live lookup for a selected grid cell (hex, cog, wheel, or a box selection).
 *
 * Usage:
 *   ATiNat.lookup(geojson, containerElement, { id: 'HEX_123', flags: { 'alliaria petiolata': 'Priority' } });
 *
 *   geojson  GeoJSON Feature, FeatureCollection, Polygon, or MultiPolygon in lng/lat (WGS84)
 *   id       optional cache key (the cell ID); repeat clicks on a cell then cost no request
 *   flags    optional lookup of lowercase scientific name -> badge text (e.g. your invasive list)
 */
(function (global) {
  'use strict';

  var CONFIG = {
    project: 'appalachian-national-scenic-trail-huc10', // the part after /projects/ in the iNaturalist project URL; '' = all iNaturalist observations
    perPage: 50,                  // records fetched per click (API maximum is 200)
    show: 20,                     // records listed in the panel (and exported)
    qualityGrade: '',             // '' = all, or 'research' to match what GBIF carries
    api: 'https://api.inaturalist.org/v1/observations',
    site: 'https://www.inaturalist.org/observations'
  };

  var cache = new Map();
  var pending = null; // the request in flight: { key, el, opts, controller }
  var cssDone = false;

  function rings(g) {
    if (!g) return [];
    if (g.type === 'FeatureCollection') return g.features.reduce(function (a, f) { return a.concat(rings(f)); }, []);
    if (g.type === 'Feature') return rings(g.geometry);
    if (g.type === 'Polygon') return [g.coordinates[0]];
    if (g.type === 'MultiPolygon') return g.coordinates.map(function (p) { return p[0]; });
    return [];
  }

  function bbox(rs) {
    var b = { w: 180, s: 90, e: -180, n: -90 };
    rs.forEach(function (r) {
      r.forEach(function (c) {
        if (c[0] < b.w) b.w = c[0];
        if (c[0] > b.e) b.e = c[0];
        if (c[1] < b.s) b.s = c[1];
        if (c[1] > b.n) b.n = c[1];
      });
    });
    return b;
  }

  function inRing(x, y, r) {
    var inside = false;
    for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
      var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function bboxQuery(b) {
    return 'swlat=' + b.s.toFixed(5) + '&swlng=' + b.w.toFixed(5) +
           '&nelat=' + b.n.toFixed(5) + '&nelng=' + b.e.toFixed(5);
  }

  function projectQuery() {
    return CONFIG.project ? 'project_id=' + encodeURIComponent(CONFIG.project) + '&' : '';
  }

  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    var s = document.createElement('style');
    s.textContent =
      '.inat-wrap{font-size:14px;line-height:1.35}' +
      '.inat-head{font-weight:600;margin:0 0 6px}' +
      '.inat-note{opacity:.7;margin:6px 0}' +
      '.inat-list{list-style:none;margin:0;padding:0}' +
      '.inat-item{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid rgba(128,128,128,.3)}' +
      '.inat-item a{color:inherit;text-decoration:none;display:flex;gap:8px;align-items:center;width:100%}' +
      '.inat-thumb{width:44px;height:44px;border-radius:4px;object-fit:cover;flex:none;background:rgba(128,128,128,.25)}' +
      '.inat-name{font-weight:600}' +
      '.inat-sci{font-style:italic;opacity:.8}' +
      '.inat-meta{opacity:.65;font-size:13px}' +
      '.inat-badge{display:inline-block;margin-left:6px;padding:0 6px;border-radius:9px;font-size:12px;font-weight:600;background:#c0562b;color:#fff}' +
      '.inat-more{display:inline-block;margin-top:8px;color:inherit;text-decoration:underline}';
    document.head.appendChild(s);
  }

  function render(el, data, opts, b) {
    var flags = opts.flags || {};
    var more = CONFIG.site + '?' + projectQuery() + bboxQuery(b) + '&geoprivacy=open&taxon_geoprivacy=open' +
      (CONFIG.qualityGrade ? '&quality_grade=' + CONFIG.qualityGrade : '') + '&subview=map';
    var html = '<div class="inat-wrap"><p class="inat-head">Recent iNaturalist observations</p>';

    if (!data.items.length) {
      html += '<p class="inat-note">No observations with open locations in this cell.</p>';
    } else {
      html += '<ul class="inat-list">';
      data.items.slice(0, CONFIG.show).forEach(function (o) {
        var t = o.taxon || {};
        var sci = t.name || 'Unidentified';
        var common = t.preferred_common_name || sci;
        var flag = flags[sci.toLowerCase()];
        var photo = o.photos && o.photos[0];
        html += '<li class="inat-item"><a href="' + esc(o.uri) + '" target="_blank" rel="noopener">' +
          (photo ? '<img class="inat-thumb" loading="lazy" alt="" src="' + esc(photo.url) + '" title="' + esc(photo.attribution) + '">'
                 : '<span class="inat-thumb"></span>') +
          '<span><span class="inat-name">' + esc(common) + '</span>' +
          (flag ? '<span class="inat-badge">' + esc(flag) + '</span>' : '') +
          (common !== sci ? '<br><span class="inat-sci">' + esc(sci) + '</span>' : '') +
          '<br><span class="inat-meta">' + esc(o.observed_on || 'date unknown') +
          ' · ' + esc(o.user && o.user.login) +
          (o.quality_grade === 'research' ? ' · research grade' : '') + '</span></span></a></li>';
      });
      html += '</ul>';
    }

    // Obscured records are excluded by the query itself, so they can't be counted per cell; say so once.
    html += '<p class="inat-note">Records with obscured locations are not listed, since they can\u2019t be placed in a cell. iNaturalist searches the rectangle around the cell, so its list can include records just outside the cell\u2019s edges.</p>';
    html += '<a class="inat-more" href="' + esc(more) + '" target="_blank" rel="noopener">See all on iNaturalist</a></div>';
    el.innerHTML = html;
  }

  function lookup(geojson, el, opts) {
    opts = opts || {};
    injectCss();

    var rs = rings(geojson);
    if (!rs.length) { el.innerHTML = ''; return Promise.resolve(null); }
    var b = bbox(rs);
    var key = opts.id != null ? String(opts.id) : bboxQuery(b);

    var loading = '<div class="inat-wrap"><p class="inat-note">Loading iNaturalist observations…</p></div>';
    // The same cell asked for again while its request is out (the panel was redrawn): show the result in the new container.
    if (pending && pending.key === key) { pending.el = el; pending.opts = opts; el.innerHTML = loading; return pending.promise; }
    if (pending) pending.controller.abort(); // drop the previous click's request
    pending = null;
    if (cache.has(key)) { render(el, cache.get(key), opts, b); return Promise.resolve(cache.get(key)); }

    var job = { key: key, el: el, opts: opts, controller: new AbortController() };
    pending = job;
    el.innerHTML = loading;

    var url = CONFIG.api + '?' + projectQuery() + bboxQuery(b) +
      '&geoprivacy=open&taxon_geoprivacy=open' + // obscured records would only take up places in the page
      '&order_by=observed_on&order=desc&per_page=' + CONFIG.perPage +
      (CONFIG.qualityGrade ? '&quality_grade=' + CONFIG.qualityGrade : '');

    return job.promise = fetch(url, { signal: job.controller.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('iNaturalist returned ' + r.status);
        return r.json();
      })
      .then(function (json) {
        var data = { items: [] };
        (json.results || []).forEach(function (o) {
          // Obscured records carry randomized coordinates, so they can't be placed in a cell.
          if (o.obscured || o.geoprivacy === 'obscured' || o.geoprivacy === 'private') return;
          var c = o.geojson && o.geojson.coordinates;
          if (!c) return;
          var x = Number(c[0]), y = Number(c[1]);
          // The API filters by bounding box; keep only points inside the actual cell shape.
          if (rs.some(function (r) { return inRing(x, y, r); })) data.items.push(o);
        });
        cache.set(key, data);
        if (pending === job) pending = null;
        render(job.el, data, job.opts, b);
        return data;
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return null;
        if (pending === job) pending = null;
        job.el.innerHTML = '<div class="inat-wrap"><p class="inat-note">Couldn’t reach iNaturalist just now. Try again in a moment.</p></div>';
        return null;
      });
  }

  global.ATiNat = { lookup: lookup, config: CONFIG, cached: function (k) { return cache.get(String(k)) || null; }, _test: { rings: rings, bbox: bbox, inRing: inRing } };
})(typeof window !== 'undefined' ? window : globalThis);
