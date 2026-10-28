"""
Trail slope for the A.T. Resource Grid: the grade of the treadway and how it lies on the hillside, for
"Where is the trail most vulnerable to damage?"

The A.T. centerline is walked in 10 m steps. At each step, elevation is read from USGS 3DEP at the trail and at four points around it
(5 m ahead and behind, 5 m to each side), from the 3DEP elevation service at 1 m (it serves the best data at each place: 1 m lidar on
nearly all of the trail, 1/3 arc-second, about 10 m, elsewhere). Only those points are read, so nothing large is downloaded. Points the
service can't answer are read from the 1/3 arc-second (10 m) 3DEP tiles instead.

Per step:
  grade            the sustained grade, %: elevations on the line are smoothed over 50 m, then the rise is taken over 40 m, so each
                   step's grade reflects about 90 m of trail (lidar noise and a line a few meters off the tread average out)
  side slope       steepness of the ground the trail crosses, %
  slope alignment  the angle between the trail and the fall line, 0 (straight up and down the hill) to 90 degrees (along the contour);
                   the strongest single predictor of soil loss on trails (Olive and Marion 2009; Marion and Wimpey 2017)

Summarized for every 1, 7 and 49 sq mi cell the trail passes through, in the corridor grid and the HUC10 shell grid:
  TS_MI     miles of trail measured                     TS_GRADE  average grade, %
  TS_G10    share of the trail over 10% grade, %        TS_G20    share over 20%, %
  TS_SIDE   average side slope, %                       TS_SAA    average slope alignment, degrees
  TS_FALL   share of the trail that runs within 22.5 degrees of the fall line on ground steeper than 5%, %
A cell holding only a short piece of trail would swing to extremes on a few steps, so each cell's values are blended with the trail
just before and after its own pieces (up to 800 m each way along the line, wherever the grid lines fall), by how much trail it has: a
quarter mile counts equally with that nearby trail. Long stretches keep their own values.

The centerline comes from, in order: at_centerline.geojson, at_centerline.zip (a zipped shapefile) or at_centerline.gpkg in this
repository, or the public ArcGIS Online layer in CENTERLINE_ITEM (the item's feature layer is read through the ArcGIS REST API).

  python build_trail_slope.py          (needs geopandas, pyogrio, shapely, pyproj, rasterio, numpy)
Writes trail_slope.json (corridor) and trail_slope_huc10.json (HUC10 shell). Runs in GitHub Actions (.github/workflows/trail_slope.yml).
"""
import io, json, math, os, re, sys, time, tempfile, urllib.parse, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import warnings
warnings.filterwarnings('ignore')
import numpy as np, geopandas as gpd, shapely
from shapely.geometry import Polygon
from shapely.ops import linemerge, unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, 'index.html')
HUCFILE = os.path.join(HERE, 'soils_wetlands_huc10.json')
OUT = {'corr': os.path.join(HERE, 'trail_slope.json'), 'huc': os.path.join(HERE, 'trail_slope_huc10.json')}
LOCAL = ['at_centerline.geojson', 'at_centerline.zip', 'at_centerline.gpkg']
CENTERLINE_ITEM = os.environ.get('CENTERLINE_ITEM', '71975f7fc14347c7a6c1059fdb593f91')
AGOL = 'https://www.arcgis.com/sharing/rest/content/items/{}?f=json'
IMG = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples'
TILE = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n{n:02d}w{w:03d}/USGS_13_n{n:02d}w{w:03d}.tif'
UA = {'User-Agent': 'AT-Resource-Grid trail slope build (github.com/Creese333/AT-Resource-Grid)'}
AEA = 5070
STEP, OFF, SMOOTH, GRADE_HALF = 10.0, 5.0, 5, 2   # meters between steps, meters to the points around each step, steps smoothed, steps each way for grade
SHRINK_K = 40                           # steps (a quarter mile): a cell with this much trail is weighted equally with the trail around it
WINDOW = 80                             # steps (800 m) each way along the trail that a cell is blended with
BATCH, THREADS = 400, 6
ON_SLOPE, FALL_DEG = 5.0, 22.5


def get(url, data=None, tries=5, timeout=120):
    last = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(3 * (k + 1))
    raise RuntimeError(f'{url[:120]}: {last}')


# ---------------------------------------------------------------- grids
def rings_of(L):
    out = []
    for g in L['g']:
        la, lo = g[0], g[1]; r = [(lo / 1e5, la / 1e5)]
        for k in range(2, len(g), 2):
            la += g[k]; lo += g[k + 1]; r.append((lo / 1e5, la / 1e5))
        out.append(Polygon(r))
    return out


def load_grids():
    h = open(INDEX, encoding='utf-8').read()
    P = json.loads(re.search(r'<script id="payload" type="application/json">(.*?)</script>', h, re.S).group(1))
    grids = {'corr': {lv: gpd.GeoDataFrame({'id': P['levels'][lv]['id']}, geometry=rings_of(P['levels'][lv]), crs=4326).to_crs(AEA) for lv in ('hex', 'cog', 'wheel')}}
    if os.path.exists(HUCFILE):
        H = json.load(open(HUCFILE, encoding='utf-8'))
        grids['huc'] = {lv: gpd.GeoDataFrame({'id': H['levels'][lv]['id']}, geometry=rings_of(H['levels'][lv]), crs=4326).to_crs(AEA) for lv in ('hex', 'cog', 'wheel')}
    return grids


# ---------------------------------------------------------------- centerline
def agol_layer(item):
    """the feature layer URL of a public ArcGIS Online item"""
    it = json.loads(get(AGOL.format(item)))
    if 'error' in it: raise RuntimeError(f'ArcGIS item {item}: {it["error"].get("message")} (is it shared publicly?)')
    url = it.get('url') or ''
    print(f'   ArcGIS item: {it.get("title")} ({it.get("type")}), {url}', flush=True)
    if not url: raise RuntimeError('the item has no service URL')
    if re.search(r'/(Feature|Map)Server/?$', url):
        meta = json.loads(get(url.rstrip('/') + '?f=json'))
        lines = [l for l in meta.get('layers', []) if 'Line' in (l.get('geometryType') or '')] or meta.get('layers', [])
        if not lines: raise RuntimeError('no layers in the service')
        url = url.rstrip('/') + f'/{lines[0]["id"]}'
    return url


def agol_features(url):
    """every feature of a layer as GeoJSON, page by page"""
    meta = json.loads(get(url + '?f=json')); page = min(meta.get('maxRecordCount') or 1000, 2000); feats, off = [], 0
    while True:
        q = urllib.parse.urlencode({'where': '1=1', 'outFields': '*', 'outSR': 4326, 'f': 'geojson', 'resultOffset': off, 'resultRecordCount': page})
        j = json.loads(get(url + '/query?' + q)); f = j.get('features') or []
        feats += f; off += len(f)
        if not f or (len(f) < page and not j.get('properties', {}).get('exceededTransferLimit') and not j.get('exceededTransferLimit')): break
    return gpd.GeoDataFrame.from_features(feats, crs=4326)


def centerline():
    for f in LOCAL:
        p = os.path.join(HERE, f)
        if os.path.exists(p):
            print(f'centerline: {f}', flush=True); return gpd.read_file(p)
    print(f'centerline: ArcGIS Online item {CENTERLINE_ITEM}', flush=True)
    return agol_features(agol_layer(CENTERLINE_ITEM))


def stations(gdf):
    """10 m steps along each merged stretch of trail (EPSG:5070): positions, unit direction, and the stretch each belongs to"""
    g = gdf.to_crs(AEA).geometry
    g = g[g.notna() & ~g.is_empty]
    merged = linemerge(unary_union(list(g.values)))
    parts = list(merged.geoms) if hasattr(merged, 'geoms') else [merged]
    X, Y, U, V, PART = [], [], [], [], []
    for k, ln in enumerate(parts):
        L = ln.length
        if L < 3 * STEP: continue
        d = np.arange(STEP / 2, L, STEP)
        pts = shapely.line_interpolate_point(ln, d); x, y = shapely.get_x(pts), shapely.get_y(pts)
        a = shapely.line_interpolate_point(ln, np.clip(d - STEP, 0, L)); b = shapely.line_interpolate_point(ln, np.clip(d + STEP, 0, L))
        dx, dy = shapely.get_x(b) - shapely.get_x(a), shapely.get_y(b) - shapely.get_y(a); n = np.hypot(dx, dy); n[n == 0] = 1
        X.append(x); Y.append(y); U.append(dx / n); V.append(dy / n); PART.append(np.full(len(d), k))
    print(f'   {len(parts):,} stretches, {sum(p.length for p in parts) / 1609.344:,.0f} miles; {sum(len(x) for x in X):,} steps', flush=True)
    return [np.concatenate(a) for a in (X, Y, U, V, PART)]


# ---------------------------------------------------------------- elevation
def samples(lon, lat):
    """3DEP elevations (m) at points, from the elevation service at 1 m; NaN where it gives none"""
    out = np.full(len(lon), np.nan)
    def one(i0):
        sl = slice(i0, min(i0 + BATCH, len(lon)))
        geom = json.dumps({'points': [[round(a, 7), round(b, 7)] for a, b in zip(lon[sl], lat[sl])], 'spatialReference': {'wkid': 4326}})
        body = urllib.parse.urlencode({'geometry': geom, 'geometryType': 'esriGeometryMultipoint', 'returnFirstValueOnly': 'true',
                                       'interpolation': 'RSP_BilinearInterpolation', 'pixelSize': json.dumps({'x': 1, 'y': 1, 'spatialReference': {'wkid': 3857}}),
                                       'outFields': '', 'f': 'json'}).encode()
        try:
            j = json.loads(get(IMG, data=body))
            for s in j.get('samples', []):
                try:
                    v = float(s['value']); i = int(s['locationId'])
                    if v > -1000: out[sl.start + i] = v
                except (KeyError, TypeError, ValueError):
                    pass
        except Exception as e:
            return str(e)
        return None
    starts = list(range(0, len(lon), BATCH)); t0 = time.time(); errs = 0
    with ThreadPoolExecutor(THREADS) as ex:
        for k, e in enumerate(ex.map(one, starts), 1):
            if e: errs += 1
            if k % 200 == 0: print(f'   elevation service: {k:,} of {len(starts):,} requests ({time.time() - t0:.0f} s, {errs} failed)', flush=True)
    return out


def tiles_fill(lon, lat, z):
    """fill missing elevations from the 1/3 arc-second 3DEP tiles (1-degree cloud-optimized GeoTIFFs; only the needed blocks are read)"""
    import rasterio
    miss = np.where(np.isnan(z))[0]
    if not len(miss): return z
    print(f'   {len(miss):,} points from the 10 m tiles', flush=True)
    key = np.ceil(lat[miss]).astype(int) * 1000 + np.ceil(-lon[miss]).astype(int)
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='3'):
        for k in np.unique(key):
            idx = miss[key == k]; url = '/vsicurl/' + TILE.format(n=k // 1000, w=k % 1000)
            try:
                with rasterio.open(url) as r:
                    v = np.array([s[0] for s in r.sample(zip(lon[idx], lat[idx]))], dtype='float64')
                    if r.nodata is not None: v[v == r.nodata] = np.nan
                    z[idx] = v
            except Exception as e:
                print(f'   tile {url[-24:]}: {e}', flush=True)
    return z


# ---------------------------------------------------------------- per step
def measure(x, y, u, v, part, z):
    """grade and side slope (%) and slope alignment (degrees) at each step; z: (5, n) at the step, ahead, behind, left, right.
    Grade is the sustained grade: elevations on the line are smoothed over 50 m, then the rise is taken over 40 m (20 m each way),
    so each step's grade reflects about 90 m of trail. Lidar noise and a line a few meters off the tread average out instead of
    adding up, and short real pitches still show"""
    z0, za, zb, zl, zr = z
    n = len(x); zs = np.full(n, np.nan); grade = np.full(n, np.nan); h = GRADE_HALF
    for k in np.unique(part):
        i = np.where(part == k)[0]; a = z0[i]
        if len(i) < 2 * h + 1: continue
        pad = np.pad(a, SMOOTH // 2, mode='edge'); ok = np.isfinite(pad)
        w = np.convolve(np.where(ok, pad, 0), np.ones(SMOOTH), 'valid'); c = np.convolve(ok.astype(float), np.ones(SMOOTH), 'valid')
        sm = np.where(c >= (SMOOTH + 1) // 2, w / np.maximum(c, 1), np.nan); zs[i] = sm
        g = np.full(len(i), np.nan); g[h:-h] = (sm[2 * h:] - sm[:-2 * h]) / (2 * h * STEP)
        g[:h] = (sm[h:2 * h] - sm[0:h]) / (h * STEP); g[-h:] = (sm[-h:] - sm[-2 * h:-h]) / (h * STEP)
        grade[i] = np.abs(g) * 100
    ga = (za - zb) / (2 * OFF); gc = (zl - zr) / (2 * OFF)          # rise per meter along and across the trail
    side = np.hypot(ga, gc) * 100
    saa = np.degrees(np.arctan2(np.abs(gc), np.abs(ga)))           # 0: along the fall line; 90: along the contour
    return grade, side, saa


STATS = ['grade', 'g10', 'g20', 'side', 'saa', 'fall']


def step_values(grade, side, saa):
    """per step: the value each measure adds, and whether the step counts for it (slope alignment counts only on ground over 5%)"""
    ok = np.isfinite(grade); on = ok & (side > ON_SLOPE) & np.isfinite(saa)
    val = {'grade': np.where(ok, grade, 0), 'g10': (ok & (grade > 10)).astype(float), 'g20': (ok & (grade > 20)).astype(float),
           'side': np.where(ok & np.isfinite(side), side, 0), 'saa': np.where(on, saa, 0), 'fall': (on & (saa < FALL_DEG)).astype(float)}
    cnt = {k: (on if k == 'saa' else ok).astype(float) for k in STATS}
    return val, cnt


def owners(cells, x, y):
    pts = gpd.GeoDataFrame({'i': np.arange(len(x))}, geometry=gpd.points_from_xy(x, y), crs=AEA)
    j = gpd.sjoin(pts, cells[['geometry']], predicate='within', how='inner')
    own = np.full(len(x), -1); own[j['i'].values] = j['index_right'].values
    return own


def summarize_all(L, x, y, part, grade, side, saa):
    """values for every cell with trail, at all three sizes. Each cell is blended with the trail just before and after its own
    pieces: up to WINDOW steps (800 m) each way along the same stretch of trail, wherever the grid lines fall. In proportion to how
    much trail the cell has: a quarter mile (SHRINK_K steps) counts equally with that nearby trail, so a short piece mostly takes on
    the character of the trail around it and a long one keeps its own values. The whole trail stands in where there is no nearby trail"""
    val, cnt = step_values(grade, side, saa); n = len(x)
    whole = {k: val[k].sum() / max(cnt[k].sum(), 1) for k in STATS}
    pstart = np.r_[0, np.flatnonzero(np.diff(part)) + 1]; pend = np.r_[pstart[1:], n]       # each stretch's step range [start, end)
    stretch = np.searchsorted(pstart, np.arange(n), side='right') - 1
    out = {}
    for lv in ('wheel', 'cog', 'hex'):
        cells = L[lv]; own = owners(cells, x, y); ids = cells['id'].tolist()
        f = {k: [] for k in ('TS_MI', 'TS_GRADE', 'TS_G10', 'TS_G20', 'TS_SIDE', 'TS_SAA', 'TS_FALL')}; keep = []
        order = np.argsort(own, kind='stable'); oo = own[order]; first = np.searchsorted(oo, 0)
        for grp in np.split(order[first:], np.flatnonzero(np.diff(oo[first:])) + 1):
            if not len(grp): continue
            c = own[grp[0]]; idx = np.sort(grp)
            # the runs of consecutive steps this cell holds, and the trail within WINDOW steps on either side of each
            brk = np.flatnonzero(np.diff(idx) != 1) + 1; ctx = []
            for run in np.split(idx, brk):
                a0, b0 = run[0], run[-1]; s0, e0 = pstart[stretch[a0]], pend[stretch[a0]]
                ctx.append(np.arange(max(s0, a0 - WINDOW), a0)); ctx.append(np.arange(b0 + 1, min(e0, b0 + 1 + WINDOW)))
            ctx = np.setdiff1d(np.concatenate(ctx) if ctx else np.array([], int), idx)
            v = {}
            for k in STATS:
                on_, cn = val[k][idx].sum(), cnt[k][idx].sum()
                pc = cnt[k][ctx].sum() if len(ctx) else 0
                prior = val[k][ctx].sum() / pc if pc else whole[k]
                v[k] = (on_ + SHRINK_K * prior) / (cn + SHRINK_K) if cn else prior
            r1 = lambda q, m=1: None if q is None or not np.isfinite(q) else round(float(q) * m, 1)
            keep.append(ids[c]); f['TS_MI'].append(round(len(idx) * STEP / 1609.344, 2))
            f['TS_GRADE'].append(r1(v['grade'])); f['TS_G10'].append(r1(v['g10'], 100)); f['TS_G20'].append(r1(v['g20'], 100))
            f['TS_SIDE'].append(r1(v['side'])); f['TS_SAA'].append(r1(v['saa'])); f['TS_FALL'].append(r1(v['fall'], 100))
        out[lv] = {'ids': keep, 'f': f}
    return out


def main():
    t0 = time.time(); grids = load_grids()
    x, y, u, v, part = stations(centerline())
    # the step and the four points around it, in longitude and latitude
    px = np.concatenate([x, x + OFF * u, x - OFF * u, x - OFF * v, x + OFF * v])
    py = np.concatenate([y, y + OFF * v, y - OFF * v, y + OFF * u, y - OFF * u])
    ll = gpd.GeoSeries(gpd.points_from_xy(px, py), crs=AEA).to_crs(4326); lon, lat = ll.x.values, ll.y.values
    print(f'reading {len(lon):,} elevations', flush=True)
    z = samples(lon, lat); print(f'   elevation service: {np.isfinite(z).mean() * 100:.1f}% answered ({time.time() - t0:.0f} s)', flush=True)
    z = tiles_fill(lon, lat, z)
    z = z.reshape(5, len(x))
    grade, side, saa = measure(x, y, u, v, part, z)
    ok = np.isfinite(grade)
    print(f'trail: average grade {np.nanmean(grade):.1f}%, {np.mean(grade[ok] > 10) * 100:.0f}% over 10%, {np.mean(grade[ok] > 20) * 100:.0f}% over 20%', flush=True)
    meta = {'built': date.today().isoformat(), 'step_m': STEP, 'offset_m': OFF, 'smooth_m': STEP * SMOOTH, 'grade_m': 2 * GRADE_HALF * STEP, 'shrink_steps': SHRINK_K, 'window_steps': WINDOW, 'fall_deg': FALL_DEG, 'on_slope_pct': ON_SLOPE,
            'miles': round(len(x) * STEP / 1609.344, 1), 'source': 'USGS 3DEP (elevation service at 1 m; 1/3 arc-second tiles where it had no value)'}
    for ext, L in grids.items():
        themes = summarize_all(L, x, y, part, grade, side, saa)
        with open(OUT[ext], 'w', encoding='utf-8') as fh:
            json.dump({'run': date.today().isoformat(), 'meta': meta, 'themes': {'slope': themes}}, fh, separators=(',', ':'))
        print(f'wrote {os.path.basename(OUT[ext])} ({os.path.getsize(OUT[ext]) / 1e6:.1f} MB, {len(themes["hex"]["ids"]):,} square miles)', flush=True)
    print(f'done in {time.time() - t0:.0f} s', flush=True)


if __name__ == '__main__':
    main()
