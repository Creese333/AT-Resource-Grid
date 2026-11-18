"""
Soundscape for the A.T. Resource Grid ("How quiet is it here?"), from the National Park Service's Natural Sounds and
Night Skies Division.

NPS models the sound level across the country from field recordings at hundreds of sites: a 270 m map of a typical
summer daytime hour, in L50 dBA (the level exceeded half the time). Three layers:
  existing   what a person would actually hear, people and nature together
  natural    what the place would sound like with human sources taken out
  impact     existing minus natural: the decibels human noise adds on top of the natural soundscape

For each cell (corridor and HUC10 shell; 1, 7 and 49 sq mi) it writes
  SND_EXIST   existing sound level, average dBA
  SND_NAT     natural sound level, average dBA
  SND_IMP     noise above natural, average dBA
  SND_Q3      share of the cell where noise above natural is under 3 dBA, percent

  python scripts/build_soundscape.py
Needs no secret: the files are public on the NPS DataStore (reference 2217356). Run it from the Actions tab
("Run workflow"); NPS republishes every few years, not yearly. Writes data/soundscape.json and data/soundscape_huc10.json.
"""
import io, json, os, re, shutil, subprocess, tempfile, zipfile
from datetime import date
import numpy as np
from nasa_common import grids, footprint, Labeler, write, log, rnd, LEVELS

NAME, THEME = 'soundscape', 'snd'
TILE = 4096                      # pixels a side: the national raster will not fit in memory
TIMEOUT = 180
NEAR_NATURAL = 3.0               # dBA above natural; NPS treats 3 dBA as the edge of audible human intrusion

REF = os.environ.get('NPS_REF', '').strip() or '2217356'   # NPS DataStore: Geospatial Sound Modeling
PAGES = [f'https://irma.nps.gov/DataStore/Reference/Profile/{REF}',
         f'https://irmaservices.nps.gov/datastore/v7/rest/Profile/{REF}',
         f'https://irmaservices.nps.gov/datastore/v6/rest/Profile/{REF}']
DL = re.compile(r'/DataStore/DownloadFile/(\d+)')
FNAME = re.compile(r'^[^\\/:*?"<>|]{3,160}\.[A-Za-z0-9]{2,5}$')   # looks like a file name, not a sentence
# Which layer a file holds, narrowest first so "existing" does not swallow "impact". NPS shortens the three to
# _imp, _nat and _exi (CONUS_sumDay_L50dBA_nat.tif), so a whole word or that abbreviation both count; the word has
# to stand on its own, or "Extractive" and "Industrial" would look like layers.
W = r'(?<![A-Za-z])%s(?![A-Za-z])'
PARTS = [('SND_IMP', re.compile('|'.join(W % p for p in ('imp', 'impact', 'excess', r'above[_ -]?nat\w*',
                                                         r'minus[_ -]?nat\w*')), re.I)),
         ('SND_NAT', re.compile('|'.join(W % p for p in ('nat', 'natural', 'natamb')), re.I)),
         ('SND_EXIST', re.compile('|'.join(W % p for p in ('exi', 'exist', 'existing', 'ambient', 'measured')), re.I))]
SKIP = re.compile(r'alaska|hawaii|puerto|guam|samoa|virgin'                    # the release is wider than the lower 48
                  r'|(?<![A-Za-z])(ak|hi|pr|gu|as|vi)(?![A-Za-z])', re.I)      # AK_, _HI_: an underscore is no \b
RAST = ('.tif', '.tiff', '.img', '.vrt', '.zip', '.gdb', '.7z', '.gz', '.tar')
# a national file is the one to take; a per-park or per-region file is a fallback
BIG = re.compile(r'conus|contiguous|lower[_ -]?48|national|\bus\b|usa', re.I)
L50 = re.compile(r'l50|dba', re.I)
SUMMER = re.compile(r'summer|sum[_ -]?day', re.I)   # the published layers are a summer day


def http(url, stream=False):
    import requests
    return requests.get(url, timeout=TIMEOUT, stream=stream, allow_redirects=True,
                        headers={'User-Agent': 'AT-Resource-Grid/1.0 (+https://grid.trailassessment.org)'})


def json_names(body, out):
    """Pull {file id: file name} out of a DataStore reply without knowing its field names: any object that carries
    one number that could be a file id and one string that looks like a file name pairs the two."""
    try:
        doc = json.loads(body)
    except Exception:
        return
    def walk(o):
        if isinstance(o, dict):
            num = {k: str(v) for k, v in o.items()
                   if isinstance(v, (int, str)) and str(v).isdigit() and 4 < len(str(v)) < 10}
            # a key called something like an id, if there is one: a file's size is a number of this shape too
            ids = [v for k, v in num.items() if re.search(r'id$|identifier|guid', k, re.I)] or list(num.values())
            nms = [v for v in o.values() if isinstance(v, str) and FNAME.match(v.strip())]
            if len(nms) == 1:
                for fid in ids: out.setdefault(fid, nms[0].strip())
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(doc)


def probe(url):
    """the name and size of one file, from the download itself: the first byte is asked for and the body dropped,
    so this costs a request and not a download. Content-Disposition is how NPS names a DownloadFile reply."""
    import requests
    for head in ({'Range': 'bytes=0-0'}, {}):      # a server that will not do ranges is asked plainly, body dropped
        try:
            r = requests.get(url, timeout=60, stream=True, allow_redirects=True,
                             headers={'User-Agent': 'AT-Resource-Grid/1.0 (+https://grid.trailassessment.org)', **head})
            cd = r.headers.get('Content-Disposition') or ''
            cr = r.headers.get('Content-Range') or ''
            n = int((re.search(r'/(\d+)$', cr) or [0, 0])[1]) or int(r.headers.get('Content-Length') or 0)
            m = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', cd)
            ct = r.headers.get('Content-Type') or '?'
            r.close()
            if m: return (m.group(1).strip(), n, '')
            note = f'{r.status_code} {ct} {n / 1e6:.0f} MB, no name in the reply'
        except Exception as e:
            note = f'not read ({str(e)[:60]})'
    return ('', 0, note)


def find_files():
    """Every file on the DataStore reference, as (name, address, size). Names matter — they are what says which layer
    a file holds — so they are taken from the reply if it gives them and asked of each download if it does not.
    Everything found is printed, so a run always says what NPS is offering and under what names."""
    import concurrent.futures as cf
    names, order = {}, []
    for page in PAGES:
        try:
            r = http(page); body = r.text
        except Exception as e:
            log(f'  {page}: not read ({str(e)[:70]})'); continue
        ids = DL.findall(body)
        before = set(names)
        json_names(body, names)
        # a file counts whether its download address is spelled out in the reply or only its id is
        for fid in ids + [f for f in names if f not in before]:
            if fid not in order: order.append(fid)
        # a name sitting beside its link, for the HTML page
        for fid in set(ids):
            if names.get(fid): continue
            m = re.search(r'/DataStore/DownloadFile/%s["\'][^>]*>\s*([^<]{3,160})' % fid, body)
            if m and FNAME.match(m.group(1).strip()): names[fid] = m.group(1).strip()
        log(f'  {page}: {r.status_code}, {len(body)} bytes, {len(order)} files so far, '
            f'{sum(1 for f in order if names.get(f))} of them named')
        if order and all(names.get(f) for f in order): break
    if not order: return []

    ask = [f for f in order if not names.get(f)]
    if ask:
        log(f'  {len(ask)} files are unnamed in the listing; asking each download what it is called')
        urls = {f: f'https://irma.nps.gov/DataStore/DownloadFile/{f}' for f in ask}
        quiet = 0
        with cf.ThreadPoolExecutor(8) as ex:
            for fid, (nm, n, note) in zip(ask, ex.map(probe, [urls[f] for f in ask])):
                if nm: names[fid] = nm
                if n: SIZE[fid] = n
                if note and quiet < 5:            # say what came back instead of a name, so a bad run is diagnosable
                    quiet += 1; log(f'    {urls[fid]}: {note}')
    got = [(names.get(f, ''), f'https://irma.nps.gov/DataStore/DownloadFile/{f}', SIZE.get(f, 0)) for f in order]
    for n, u, s in got: log(f'      {n or "(unnamed)"}   {s / 1e6:.0f} MB   {u}')
    return got


SIZE = {}


def score(name, size):
    """how likely a file is the national raster rather than one park's copy or a picture of the map"""
    s = size / 1e9
    if BIG.search(name): s += 100
    if L50.search(name): s += 40
    if SUMMER.search(name): s += 40
    if name.lower().endswith(('.tif', '.tiff', '.img')): s += 20
    return s


def pick(files, pat, taken):
    """the best file for one layer: it has to name the layer and be something a raster can come out of"""
    cand = [(n, u, sz) for n, u, sz in files
            if u not in taken and n and not SKIP.search(n) and n.lower().endswith(RAST) and pat.search(n)]
    if not cand: return None
    cand.sort(key=lambda t: -score(t[0], t[2]))
    if len(cand) > 1: log('    also matched: ' + ', '.join(n for n, _, _ in cand[1:5]))
    return cand[0]


def fetch(url, into, name=''):
    """download one file; returns its path on disk"""
    try:
        r = http(url, stream=True)
        n = int(r.headers.get('Content-Length') or 0)
        cd = r.headers.get('Content-Disposition') or ''
        fn = (re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', cd) or [None, name or 'file'])[1]
        log(f'    {r.status_code} {r.headers.get("Content-Type", "?")} {n / 1e6:.0f} MB  {fn}')
        if r.status_code != 200: return None
        p = os.path.join(into, os.path.basename(fn) or 'file')
        with open(p, 'wb') as f:
            for ch in r.iter_content(1 << 20): f.write(ch)
        return p
    except Exception as e:
        log(f'    failed ({str(e)[:90]})'); return None


def gdal(*args):
    out = subprocess.run(args, capture_output=True, text=True)
    if out.returncode: log('    gdal said:', (out.stderr or out.stdout).strip()[:200])
    return out.stdout


def rasters_in(path):
    """every raster under a folder (or the file itself), biggest first"""
    got = []
    if os.path.isfile(path):
        if path.lower().endswith(('.tif', '.tiff', '.img', '.vrt')): got.append(path)
        elif zipfile.is_zipfile(path):
            out = path + '.d'; os.makedirs(out, exist_ok=True)
            with zipfile.ZipFile(path) as z: z.extractall(out)
            os.remove(path); return rasters_in(out)
        return got
    for root, dirs, files in os.walk(path):
        for f in files:
            if f.lower().endswith(('.tif', '.tiff', '.img')): got.append(os.path.join(root, f))
        for d in list(dirs):
            if d.lower().endswith('.gdb'):
                dirs.remove(d); g = os.path.join(root, d)
                try:
                    j = json.loads(gdal('gdalinfo', '-json', g) or '{}')
                except Exception:
                    j = {}
                subs = [v for k, v in (j.get('metadata', {}).get('SUBDATASETS', {}) or {}).items() if k.endswith('_NAME')]
                got += subs or ([g] if j.get('size') else [])
    return sorted(got, key=lambda p: -(os.path.getsize(p) if os.path.isfile(p) else 0))


def read_info(src):
    j = json.loads(gdal('gdalinfo', '-json', src) or '{}')
    return j.get('geoTransform'), j.get('size'), (j.get('coordinateSystem', {}) or {}).get('wkt', ''), j


def tiles(gt, size, bounds, keep=None):
    """tile windows over the footprint's bounds; a tile holding no cells is skipped rather than read"""
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


def each_tile(srcs, gt, size, crs, fp, tmp):
    """read the rasters a tile at a time, the same window from each: ([arrays], Labeler) per tile"""
    import rasterio
    from rasterio.transform import Affine
    from rasterio.warp import transform_bounds
    import geopandas as gpd
    b = transform_bounds('EPSG:4326', crs, *fp.bounds, densify_pts=51)
    keep = gpd.GeoSeries([fp], crs=4326).to_crs(crs).iloc[0]
    win = list(tiles(gt, size, b, keep)); log(f'  {len(win)} tiles hold cells')
    for i, (c, r, w, h) in enumerate(win):
        arrs, tr, shp = [], None, None
        for n, src in enumerate(srcs):
            p = os.path.join(tmp, f'tile{n}.tif')
            gdal('gdal_translate', '-q', '-of', 'GTiff', '-srcwin', str(c), str(r), str(w), str(h), src, p)
            if not os.path.exists(p): arrs = []; break
            with rasterio.open(p) as ds:
                arrs.append(ds.read(1).astype('float64')); tr = ds.transform; shp = arrs[-1].shape
            os.remove(p)
        if not arrs: continue
        lab = Labeler(GRIDS, crs, Affine(*tr[:6]), shp, coarse=False)
        if (i + 1) % 10 == 0: log(f'    tile {i + 1} of {len(win)}')
        yield arrs, lab


def ok_mask(v, nodata):
    m = np.isfinite(v) & (v > -9000) & (v < 9000)
    if nodata is not None: m &= (v != nodata)
    return m


def build(srcs, fields, gt, size, crs, fp, tmp, nodata, impact_from):
    """average of each layer per cell, plus the share of the cell that is still near-natural"""
    n0 = {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS}
    tot = {f: {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS} for f in fields + ['SND_IMP']}
    cnt = {f: {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS} for f in fields + ['SND_IMP']}
    quiet = {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS}
    qtot = {ext: {lv: np.zeros(len(GRIDS[ext][lv])) for lv in LEVELS} for ext in GRIDS}
    seen = []
    for arrs, lab in each_tile(srcs, gt, size, crs, fp, tmp):
        vals = dict(zip(fields, arrs))
        if impact_from and 'SND_EXIST' in vals and 'SND_NAT' in vals:      # not published: work it out
            vals['SND_IMP'] = vals['SND_EXIST'] - vals['SND_NAT']
        for f, v in vals.items():
            m = ok_mask(v, nodata)
            if f == 'SND_IMP' and impact_from: m &= ok_mask(vals['SND_EXIST'], nodata) & ok_mask(vals['SND_NAT'], nodata)
            if not m.any(): continue
            if f == 'SND_EXIST': seen.append((float(np.nanmin(v[m])), float(np.nanmax(v[m]))))
            for ext in GRIDS:
                for lv in LEVELS:
                    s, k = lab.sums(ext, lv, v, m); tot[f][ext][lv] += s; cnt[f][ext][lv] += k
        if 'SND_IMP' in vals:
            m = ok_mask(vals['SND_IMP'], nodata)
            q = m & (vals['SND_IMP'] < NEAR_NATURAL)
            for ext in GRIDS:
                for lv in LEVELS:
                    quiet[ext][lv] += lab.counts(ext, lv, q); qtot[ext][lv] += lab.counts(ext, lv, m)
    if seen: log('  existing sound level over the trail: %.1f to %.1f' % (min(x[0] for x in seen), max(x[1] for x in seen)))
    out = {}
    with np.errstate(invalid='ignore', divide='ignore'):
        for ext in GRIDS:
            out[ext] = {}
            for lv in LEVELS:
                f = {}
                for name in tot:
                    k = cnt[name][ext][lv]
                    if k.sum() == 0: continue
                    f[name] = [rnd(x, 1) for x in np.where(k > 0, tot[name][ext][lv] / np.maximum(k, 1), np.nan)]
                t = qtot[ext][lv]
                if t.sum(): f['SND_Q3'] = [rnd(x, 1) for x in np.where(t > 0, 100 * quiet[ext][lv] / np.maximum(t, 1), np.nan)]
                out[ext][lv] = f
    return out


GRIDS = None


def main():
    global GRIDS
    GRIDS = grids(); fp = footprint(GRIDS)
    log(f'Looking at NPS DataStore reference {REF}:')
    files = find_files()
    if not files: raise SystemExit('No files found on the reference. The log above says what was tried.')
    tmp = tempfile.mkdtemp()
    try:
        picked, taken = {}, set()
        for field, pat in PARTS:
            hit = pick(files, pat, taken)
            if not hit: log(f'{field}: nothing on the reference matches'); continue
            taken.add(hit[1]); log(f'{field}: {hit[0]}  ({hit[2] / 1e6:.0f} MB)')
            p = fetch(hit[1], tmp, hit[0])
            if not p: continue
            rs = rasters_in(p)
            log(f'    {len(rs)} raster(s): ' + ', '.join(os.path.basename(x) for x in rs[:6]))
            if rs: picked[field] = rs[0]
        if 'SND_EXIST' not in picked and 'SND_NAT' not in picked:
            raise SystemExit('Neither the existing nor the natural layer could be read. Every file on the reference is '
                             'listed above with its name and size; the two wanted are the national existing and natural '
                             'sound level rasters.')

        # Every layer must sit on the same grid to be read window by window together, so the grid the most layers
        # agree on wins and any odd one out is left behind, whichever layer that turns out to be.
        info = {}
        for f in ('SND_EXIST', 'SND_NAT', 'SND_IMP'):
            if f not in picked: continue
            g2, s2, c2, j2 = read_info(picked[f])
            if not g2 or not s2: log(f'  {f} could not be read; left out'); continue
            info[f] = (tuple(s2) + tuple(round(x, 3) for x in g2), g2, s2, c2, j2)
        if not info: raise SystemExit('None of the chosen files could be read as a raster.')
        from collections import Counter
        same = Counter(v[0] for v in info.values()).most_common(1)[0][0]
        fields = [f for f in ('SND_EXIST', 'SND_NAT', 'SND_IMP') if info.get(f) and info[f][0] == same]
        for f in info:
            if f not in fields: log(f'  {f} sits on a different grid ({info[f][2]}); left out')
        gt, size, crs, j = info[fields[0]][1:]
        srcs = [picked[f] for f in fields]
        log(f'  grid: {size} at {abs(gt[1]):.0f} m, {crs[:60]}')
        nodata = ((j.get('bands') or [{}])[0] or {}).get('noDataValue')
        log('  reading: ' + ', '.join(fields))
        impact_from = 'SND_IMP' not in fields and 'SND_EXIST' in fields and 'SND_NAT' in fields
        if impact_from: log('  noise above natural is not published here, so it is worked out as existing minus natural')
        out = build(srcs, fields, gt, size, crs, fp, tmp, nodata, impact_from)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    got = sorted({k for ext in out for lv in out[ext] for k in out[ext][lv]})
    if not got: raise SystemExit('Nothing landed in the cells.')
    v = [x for x in out['corr']['wheel'].get('SND_IMP', []) if x is not None]
    if v: log('  noise above natural, corridor 49 sq mi cells: %.1f to %.1f dBA, median %.1f' % (min(v), max(v), float(np.median(v))))
    meta = {'built': date.today().isoformat(), 'fields': got, 'near_natural': NEAR_NATURAL, 'ref': REF,
            'source': 'Geospatial sound modeling, National Park Service Natural Sounds and Night Skies Division '
                      '(Mennitt and Fristrup); L50 dBA for a typical summer day, 270 m.'}
    write(NAME, THEME, GRIDS, out, meta)
    log('built:', ', '.join(got))


if __name__ == '__main__':
    main()
