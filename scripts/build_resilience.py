"""
Climate resilience for the A.T. Resource Grid ("How resilient is this land to a changing climate?"), from The Nature
Conservancy's Center for Resilient Conservation Science.

Two kinds of layer:
  - the Resilient and Connected Network: a 30 m national raster whose classes say whether a place belongs to the proposed
    network of climate-resilient sites and the corridors between them (Anderson and others, PNAS 2023).
  - the layers the network is built from, each a continuous score: estimated resilience to climate change (stratified by
    setting and ecoregion), landscape diversity, local connectedness, and climate flow.

The network's download is known. The component layers move between TNC's pages, so the script first looks for them and
prints everything it finds, then builds every layer it managed to reach. A run that finds nothing new still builds the
network and leaves a list of candidates in the log.

For each cell (corridor and HUC10 shell; 1, 7 and 49 sq mi) it writes
  RES_NET     share of the cell in the Resilient and Connected Network, percent
  RES_C<code> share of the cell in each network class, percent (class names are in meta.classes)
  RES_SCORE   estimated resilience, average z-score (positive is more resilient than others of its kind)
  RES_DIV     landscape diversity, average z-score
  RES_CONN    local connectedness, average z-score
  RES_FLOW    climate flow, average z-score

  python scripts/build_resilience.py
Needs no secret. Run it from the Actions tab ("Run workflow"); the data changes every few years, not yearly.
Writes data/resilience.json and data/resilience_huc10.json.
"""
import io, json, os, re, shutil, subprocess, sys, tempfile, zipfile
from datetime import date
import numpy as np
from nasa_common import grids, footprint, Labeler, write, log, rnd, LEVELS

NAME, THEME = 'resilience', 'res'
TILE = 4096                      # pixels a side, read one tile at a time: the whole eastern US will not fit in memory
TIMEOUT = 120

# The network: a file geodatabase raster inside a zip on TNC's Box. RCN_URL (a workflow input) overrides it.
RCN_BOX = '14g44i2273abcdcjmdacat77ikr27gd0'
RCN_TRY = [os.environ.get('RCN_URL', '').strip(),
           f'https://tnc.box.com/shared/static/{RCN_BOX}.zip',
           f'https://tnc.box.com/s/{RCN_BOX}']

# Where the component layers have lived. Each is read for links; nothing here is required to exist.
LOOK = ['https://crcs.tnc.org/api/feed/dcat-us/1.1.json',
        'https://geospatial.tnc.org/api/feed/dcat-us/1.1.json',
        'https://crcs.tnc.org/pages/data-terrestrial-resilience',
        'https://www.conservationgateway.org/ConservationPractices/ClimateChange/Pages/RCN-Downloads.aspx',
        'https://www.conservationgateway.org/ConservationByGeography/NorthAmerica/UnitedStates/edc/reportsdata/terrestrial/resilience/Pages/Downloads.aspx']
WANT = re.compile(r'resilien|connected|landscape[_ -]?diversity|local[_ -]?connect|climate[_ -]?flow', re.I)
FILE = re.compile(r'https?://[^\s"\'<>)]+\.(?:zip|tif|tiff|gdb|7z)\b', re.I)
# which component a file name belongs to, in the order tried
PARTS = [('RES_SCORE', re.compile(r'resilien(ce|t)[_ -]?(score|z|strat|setting)|^resil', re.I)),
         ('RES_DIV', re.compile(r'landscape[_ -]?diversity|land[_ -]?div', re.I)),
         ('RES_CONN', re.compile(r'local[_ -]?connect|connectedness', re.I)),
         ('RES_FLOW', re.compile(r'climate[_ -]?flow|flow[_ -]?zone', re.I))]


def http(url, stream=False):
    import requests
    return requests.get(url, timeout=TIMEOUT, stream=stream, allow_redirects=True,
                        headers={'User-Agent': 'AT-Resource-Grid/1.0 (+https://grid.trailassessment.org)'})


def head(url):
    import requests
    try:
        r = requests.head(url, timeout=30, allow_redirects=True)
        return r.status_code, r.headers.get('Content-Length', '?'), r.headers.get('Content-Type', '?')
    except Exception as e:
        return 'err', str(e)[:60], ''


def discover():
    """Print every download link TNC offers that looks like a resilience layer, and return the ones worth trying."""
    found = []
    for page in LOOK:
        try:
            r = http(page); body = r.text
        except Exception as e:
            log(f'  {page}: not read ({str(e)[:70]})'); continue
        urls = sorted(set(u for u in FILE.findall(body) if WANT.search(u)))
        log(f'  {page}: {r.status_code}, {len(body)} bytes, {len(urls)} candidate file links')
        for u in urls:
            st, size, ct = head(u)
            log(f'      {u}  [{st} {size} {ct}]')
            found.append(u)
        if not urls:                                     # pages that build their links in the browser leave their data in a blob
            for m in re.finditer(r'https?://[^\s"\'<>)]{20,200}', body):
                u = m.group(0)
                if WANT.search(u) and ('box.com' in u or 's3' in u or 'arcgis' in u or 'download' in u.lower()):
                    log(f'      (page link) {u}')
    return found


def fetch_zip(urls, into):
    """the first address that answers with a zip; returns its path"""
    for u in [x for x in urls if x]:
        try:
            log(f'  trying {u}')
            r = http(u, stream=True)
            ct = r.headers.get('Content-Type', ''); n = int(r.headers.get('Content-Length') or 0)
            log(f'    {r.status_code} {ct} {n / 1e6:.0f} MB' if n else f'    {r.status_code} {ct}')
            if r.status_code != 200: continue
            if 'zip' not in ct and 'octet-stream' not in ct and n < 1e7:
                log('    not a file, skipped'); continue
            p = os.path.join(into, 'source.zip'); got = 0
            with open(p, 'wb') as f:
                for ch in r.iter_content(1 << 20):
                    f.write(ch); got += len(ch)
            log(f'    saved {got / 1e6:.0f} MB')
            if zipfile.is_zipfile(p): return p
            log('    not a zip, skipped')
        except Exception as e:
            log(f'    failed ({str(e)[:90]})')
    return None


def gdal(*args):
    out = subprocess.run(args, capture_output=True, text=True)
    if out.returncode: log('    gdal said:', (out.stderr or out.stdout).strip()[:200])
    return out.stdout


def rasters_in(path):
    """every raster a GDAL build can see in a folder, file geodatabase included; [(open string, name)]"""
    got = []
    for root, dirs, files in os.walk(path):
        for d in list(dirs):
            if d.lower().endswith('.gdb'):
                dirs.remove(d); g = os.path.join(root, d)
                info = gdal('gdalinfo', '-json', g)
                try:
                    j = json.loads(info or '{}')
                except Exception:
                    j = {}
                subs = [s.get('name', '') for s in (j.get('metadata', {}).get('SUBDATASETS', {}) or {}).values() if isinstance(s, str) is False]
                for k, v in (j.get('metadata', {}).get('SUBDATASETS', {}) or {}).items():
                    if k.endswith('_NAME'): subs.append(v)
                if not subs: subs = [f'OpenFileGDB:{g}:{n}' for n in gdb_names(g)]
                for s in subs: got.append((s, s.rsplit(':', 1)[-1]))
                log(f'    {d}: {len(subs)} raster(s)')
        for f in files:
            if f.lower().endswith(('.tif', '.tiff')): got.append((os.path.join(root, f), f))
    return got


def gdb_names(g):
    """raster names in a file geodatabase, from ogrinfo's table list"""
    out = gdal('ogrinfo', '-ro', '-so', g)
    return [m.group(1) for m in re.finditer(r'^\s*\d+:\s*([^\s(]+)', out or '', re.M) if not m.group(1).startswith('GDB_')]


def read_info(src):
    j = json.loads(gdal('gdalinfo', '-json', src) or '{}')
    gt = j.get('geoTransform'); size = j.get('size')
    crs = (j.get('coordinateSystem', {}) or {}).get('wkt', '')
    rat = {}
    for b in j.get('bands', []) or []:
        for row in ((b.get('rat', {}) or {}).get('row', []) or []):
            vals = row.get('f', [])
            if len(vals) >= 2:
                try: rat[int(vals[0])] = str(vals[-1])
                except Exception: pass
    return gt, size, crs, rat, j


def tiles(gt, size, bounds, keep=None):
    """tile windows (col, row, w, h) over the footprint's bounds in the raster's own coordinates. The trail is a thin
    band across a national raster, so a tile that holds no cells is skipped rather than read."""
    from shapely.geometry import box
    x0, y0 = gt[0], gt[3]; px, py = gt[1], gt[5]; W, H = size
    c0 = int(max(0, (bounds[0] - x0) / px)); c1 = int(min(W, (bounds[2] - x0) / px) + 1)
    r0 = int(max(0, (bounds[3] - y0) / py)); r1 = int(min(H, (bounds[1] - y0) / py) + 1)
    for r in range(r0, r1, TILE):
        for c in range(c0, c1, TILE):
            w, h = min(TILE, c1 - c), min(TILE, r1 - r)
            if w <= 0 or h <= 0: continue
            if keep is not None:
                bx = box(x0 + c * px, y0 + (r + h) * py, x0 + (c + w) * px, y0 + r * py)
                if not keep.intersects(bx): continue
            yield c, r, w, h


def each_tile(src, gt, size, crs, fp, tmp):
    """read the raster a tile at a time: (array, Labeler) for every tile that holds cells"""
    import rasterio
    from rasterio.transform import Affine
    from rasterio.warp import transform_bounds
    import geopandas as gpd
    b = transform_bounds('EPSG:4326', crs, *fp.bounds, densify_pts=51)
    keep = gpd.GeoSeries([fp], crs=4326).to_crs(crs).iloc[0]
    win = list(tiles(gt, size, b, keep)); log(f'  {len(win)} tiles hold cells')
    labs = {}
    for i, (c, r, w, h) in enumerate(win):
        p = os.path.join(tmp, 'tile.tif')
        gdal('gdal_translate', '-q', '-of', 'GTiff', '-srcwin', str(c), str(r), str(w), str(h), src, p)
        if not os.path.exists(p): continue
        with rasterio.open(p) as ds:
            a = ds.read(1); tr = ds.transform; shp = a.shape
        key = (shp, round(tr.c, 1), round(tr.f, 1))
        lab = labs.get(key) or Labeler(GRIDS, crs, Affine(*tr[:6]), shp, coarse=False)
        labs = {key: lab}                                 # one tile at a time: keep only the last
        if (i + 1) % 10 == 0: log(f'    tile {i + 1} of {len(win)}')
        yield a, lab
        os.remove(p)


def classes(src, gt, size, crs, fp, rat, tmp):
    """share of each cell in each network class, and in the network as a whole. Every class is counted in one pass per
    cell grid (cell number and class number folded into one index), because a national 30 m raster is far too big to
    walk through once for each of fourteen classes. Classes are learned as they appear, so the raster's own table is
    used for names where it has them but is not needed to read the values."""
    codes = np.array(sorted(rat), dtype='int64') if rat else np.zeros(0, dtype='int64')
    tot = {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS}
    per = {ext: {lv: np.zeros((len(GRIDS[ext][lv]), len(codes))) for lv in LEVELS} for ext in GRIDS}
    seen = {}
    for a, lab in each_tile(src, gt, size, crs, fp, tmp):
        good = (a != 0) & (a != -2147483648)              # background, and the sentinel in part-covered blocks
        vals, counts = np.unique(a[good], return_counts=True)
        for v, n in zip(vals.tolist(), counts.tolist()): seen[v] = seen.get(v, 0) + n
        new = np.setdiff1d(vals.astype('int64'), codes)
        if len(new):                                      # a class not seen before: widen the tally, keeping the order
            merged = np.union1d(codes, new); at = np.searchsorted(merged, codes)
            for ext in GRIDS:
                for lv in LEVELS:
                    old = per[ext][lv]; wide = np.zeros((old.shape[0], len(merged)))
                    if old.shape[1]: wide[:, at] = old
                    per[ext][lv] = wide
            codes = merged
        K = len(codes)
        pos = np.clip(np.searchsorted(codes, a), 0, K - 1)
        ok = good & (codes[pos] == a)
        for ext in GRIDS:
            for lv in LEVELS:
                L = lab.lab[ext][lv]; n = len(GRIDS[ext][lv]); m = ok & (L > 0)
                if not m.any(): continue
                idx = (L[m].astype('int64') - 1) * K + pos[m]
                per[ext][lv] += np.bincount(idx, minlength=n * K)[:n * K].reshape(n, K)
                tot[ext][lv] += np.bincount(L[m] - 1, minlength=n)[:n]
    log(f'  {len(seen)} classes in the trail\'s cells')
    for v in sorted(seen, key=lambda k: -seen[k])[:40]:
        log(f'    {v}: {seen[v]:,} px  {rat.get(v, "(no name in the table)")}')
    return tot, per, codes, seen


OFF = re.compile(r'not in (the )?network|^background|^no ?data|^other$|^none$', re.I)


def network_share(per, tot, codes, names, seen):
    """RES_NET, and a field for each class that covers enough of the trail to be worth its own line in the file"""
    out = {}
    total = sum(seen.values()) or 1
    big = [i for i, v in enumerate(codes.tolist()) if seen.get(v, 0) / total >= .005]   # a class under half a percent is counted in the total only
    log(f'  {len(big)} of {len(codes)} classes cover at least 0.5% of the trail and get their own measure')
    for ext in per:
        out[ext] = {}
        for lv in LEVELS:
            t = tot[ext][lv]; k = per[ext][lv]; f = {}
            with np.errstate(invalid='ignore', divide='ignore'):
                share = lambda col: [rnd(x, 1) for x in np.where(t > 0, 100 * col / np.maximum(t, 1), np.nan)]
                for i in big: f[f'RES_C{codes[i]}'] = share(k[:, i])
                keep = [i for i, v in enumerate(codes.tolist()) if not OFF.search(names.get(v, '') or '')]
                f['RES_NET'] = share(k[:, keep].sum(axis=1) if keep else np.zeros(len(t)))
            out[ext][lv] = f
    return out


def score_layer(field, src, gt, size, crs, fp, tmp, nodata=None):
    """average of a continuous layer per cell"""
    s = {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS}
    k = {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS}
    for a, lab in each_tile(src, gt, size, crs, fp, tmp):
        v = a.astype('float64')
        ok = np.isfinite(v) if nodata is None else (np.isfinite(v) & (v != nodata))
        ok &= v > -9000
        for ext in GRIDS:
            for lv in LEVELS:
                ss, kk = lab.sums(ext, lv, v, ok); s[ext][lv] += ss; k[ext][lv] += kk
    out = {}
    with np.errstate(invalid='ignore', divide='ignore'):
        for ext in s:
            out[ext] = {lv: {field: [rnd(x, 2) for x in np.where(k[ext][lv] > 0, s[ext][lv] / np.maximum(k[ext][lv], 1), np.nan)]} for lv in LEVELS}
    return out


def merge(into, more):
    for ext in more:
        into.setdefault(ext, {})
        for lv in more[ext]: into[ext].setdefault(lv, {}).update(more[ext][lv])


GRIDS = None


def main():
    global GRIDS
    GRIDS = grids(); fp = footprint(GRIDS)
    log('Looking for the resilience layers TNC publishes:')
    found = discover()
    fields, meta_classes, built = {}, {}, []
    tmp = tempfile.mkdtemp()
    try:
        log('The Resilient and Connected Network:')
        z = fetch_zip(RCN_TRY, tmp)
        if z:
            out = os.path.join(tmp, 'rcn'); os.makedirs(out, exist_ok=True)
            with zipfile.ZipFile(z) as f: f.extractall(out)
            os.remove(z)
            rs = rasters_in(out)
            log(f'  {len(rs)} raster(s) in the package: ' + ', '.join(n for _, n in rs[:8]))
            pick = next((s for s, n in rs if re.search(r'rcn|network', n, re.I)), rs[0][0] if rs else None)
            if pick:
                gt, size, crs, rat, _ = read_info(pick)
                log(f'  {pick}: {size}, {len(rat)} classes named in the table')
                if gt and size and crs:
                    tot, per, codes, seen = classes(pick, gt, size, crs, fp, rat, tmp)
                    names = {v: rat.get(v, '') for v in seen}
                    merge(fields, network_share(per, tot, codes, names, seen))
                    meta_classes = {str(v): names.get(v, '') for v in sorted(seen)}
                    built.append('network')
                else:
                    log('  could not read the raster: is gdal-bin installed and new enough for file geodatabases?')
            shutil.rmtree(out, ignore_errors=True)

        for field, pat in PARTS:
            hit = next((u for u in found if pat.search(u.rsplit('/', 1)[-1])), None)
            if not hit: log(f'{field}: no download found yet'); continue
            log(f'{field}: {hit}')
            z = fetch_zip([hit], tmp)
            src = None; out = os.path.join(tmp, field); os.makedirs(out, exist_ok=True)
            if z:
                with zipfile.ZipFile(z) as f: f.extractall(out)
                os.remove(z); rs = rasters_in(out)
                src = rs[0][0] if rs else None
            elif hit.lower().endswith(('.tif', '.tiff')):
                src = os.path.join(out, 'layer.tif')
                with open(src, 'wb') as f: f.write(http(hit).content)
            if src:
                gt, size, crs, rat, _ = read_info(src)
                if gt and size and crs:
                    merge(fields, score_layer(field, src, gt, size, crs, fp, tmp, None)); built.append(field)
            shutil.rmtree(out, ignore_errors=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if not fields:
        raise SystemExit('Nothing was built. The log above lists every download that was tried.')
    meta = {'built': date.today().isoformat(), 'layers': built, 'classes': meta_classes,
            'source': 'Resilient and Connected Network and the terrestrial resilience layers behind it, The Nature Conservancy, '
                      'Center for Resilient Conservation Science (Anderson, M.G. and others, 2023).'}
    write(NAME, THEME, GRIDS, fields, meta)
    log('built:', ', '.join(built))


if __name__ == '__main__':
    main()
