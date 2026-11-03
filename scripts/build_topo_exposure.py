"""
Topographic wind exposure for the A.T. Resource Grid: a factor in the windfall risk screening score
("Where is the treadway most at risk?", Tree fall vulnerability).

Measured on the trail itself: points every 30 m along the A.T. centerline (the same centerline and stations as the trail slope
build, scripts/build_trail_slope.py), with elevations from USGS 3DEP 1 arc-second (the 1-degree cloud-optimized GeoTIFFs, read at
their first overview, about 60 m, so only a few MB per tile are fetched). At every point the topographic position index (TPI) is
the point's elevation minus the mean elevation 1 km away in eight directions: ridges, summits and upper slopes stand above their
surroundings and take the wind; gaps, hollows and coves are sheltered.
High-use areas count too: shelters, campsites, privies, parking areas and vistas from the A.T. facilities inventory (the points in
index.html) are measured the same way, and each counts as much as 300 m of trail (SITE_W points), since people gather and camp there.
  TOPO_TPI   mean TPI of the trail and high-use sites in the cell, m (positive: they sit high in their landscape)
  TOPO_EXP   share of the trail and high-use sites in the cell that is exposed (TPI over 25 m), %
  TOPO_SITE  high-use sites in the cell, and TOPO_SITE_EXP how many of them are exposed
  TOPO_N     trail points measured in the cell (30 m apart); cells with fewer than 5 and no site are left empty
The same points also carry, for the tree fall score:
  IDS_MORT   share of the trail and sites inside areas mapped with tree mortality since 2016, %, and IDS_DEF with defoliation
             (USDA Forest Service Insect and Disease Survey, aerial detection damage areas)
  CH_MEAN    average forest canopy height at the trail and sites, m (LANDFIRE forest canopy height; points under 3 m left out)
Each source is optional: if one cannot be read, its fields are left out and the error is written to the file's meta.

  python scripts/build_topo_exposure.py
Writes data/topo_exposure.json (A.T. corridor cells; the treadway question is corridor only). Needs geopandas, pyogrio, shapely, pyproj, rasterio, numpy.
Terrain does not change: run it once, and again only if the grid changes.
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from datetime import date
import numpy as np, geopandas as gpd, shapely, rasterio
from shapely.geometry import Polygon

SCRIPTS = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.dirname(SCRIPTS)
DATA = os.path.join(HERE, 'data'); INDEX = os.path.join(HERE, 'index.html'); HUCFILE = os.path.join(DATA, 'soils_wetlands_huc10.json')
OUT = {'corr': os.path.join(DATA, 'topo_exposure.json')}
TILE = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/1/TIFF/current/n{n:02d}w{w:03d}/USGS_1_n{n:02d}w{w:03d}.tif'
POINTS = {'hex': 5, 'cog': 8, 'wheel': 12}
RADIUS = 1000.0            # m, the ring the point is compared with
EXPOSED = 25.0             # m above the ring's mean elevation
SITES = {'Shelter', 'Campsite', 'Privy', 'Parking', 'Vista'}
SITE_W = 10                # a high-use site counts as 10 trail points (300 m of trail)


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
    g = {'corr': {lv: gpd.GeoDataFrame({'id': P['levels'][lv]['id']}, geometry=rings_of(P['levels'][lv]), crs=4326) for lv in ('hex', 'cog', 'wheel')}}
    return g


def sample_points(cells, lv):
    k = POINTS[lv]; xs, ys, owner = [], [], []
    for i, (x0, y0, x1, y1) in enumerate(cells.geometry.bounds.values):
        gx = x0 + (np.arange(k) + .5) * (x1 - x0) / k; gy = y0 + (np.arange(k) + .5) * (y1 - y0) / k
        X, Y = np.meshgrid(gx, gy); xs.append(X.ravel()); ys.append(Y.ravel()); owner.append(np.full(k * k, i))
    x, y, own = np.concatenate(xs), np.concatenate(ys), np.concatenate(owner)
    inside = shapely.contains_xy(cells.geometry.values[own], x, y)
    x, y, own = x[inside], y[inside], own[inside]
    missing = np.setdiff1d(np.arange(len(cells)), own)
    if len(missing):
        c = cells.geometry.values[missing].centroid
        x = np.concatenate([x, shapely.get_x(c)]); y = np.concatenate([y, shapely.get_y(c)]); own = np.concatenate([own, missing])
    return x, y, own


class DEM:
    """elevations from the 1-degree tiles, each read once at its first overview and kept"""
    def __init__(self): self.t = {}; self.bad = []
    def tile(self, n, w):
        k = (n, w)
        if k in self.t: return self.t[k]
        url = TILE.format(n=n, w=w); arr = None
        for attempt in range(3):
            try:
                with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif', GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='3'):
                    src = url if os.path.exists(url) else '/vsicurl/' + url
                    with rasterio.open(src) as r0:
                        ov = r0.overviews(1)
                    with rasterio.open(src, overview_level=0) if ov else rasterio.open(src) as r:
                        a = r.read(1).astype('float32'); nd = r.nodata
                        if nd is not None: a[a == nd] = np.nan
                        a[a < -500] = np.nan
                        b = r.bounds; arr = (a, b.left, b.top, (b.right - b.left) / a.shape[1], (b.top - b.bottom) / a.shape[0])
                break
            except Exception as e:
                print(f'   tile n{n}w{w:03d} try {attempt + 1}: {e}', flush=True); time.sleep(5 * (attempt + 1))
        if arr is None: self.bad.append(f'n{n}w{w:03d}')
        self.t[k] = arr; return arr
    def z(self, lon, lat):
        out = np.full(len(lon), np.nan, 'float32')
        n = np.ceil(lat).astype(int); w = np.ceil(-lon).astype(int); key = n * 1000 + w
        for k in np.unique(key):
            idx = np.flatnonzero(key == k); t = self.tile(int(k // 1000), int(k % 1000))
            if t is None: continue
            a, x0, y0, dx, dy = t
            col = ((lon[idx] - x0) / dx).astype(int); row = ((y0 - lat[idx]) / dy).astype(int)
            ok = (col >= 0) & (col < a.shape[1]) & (row >= 0) & (row < a.shape[0])
            out[idx[ok]] = a[row[ok], col[ok]]
        return out


def tpi(dem, x, y):
    z0 = dem.z(x, y); ring = []
    for ang in np.arange(0, 360, 45):
        t = np.radians(ang); dy = RADIUS * np.cos(t) / 111320.0; dx = RADIUS * np.sin(t) / (111320.0 * np.cos(np.radians(y)))
        ring.append(dem.z(x + dx, y + dy))
    with np.errstate(all='ignore'):
        return z0 - np.nanmean(np.vstack(ring), axis=0)


UA = {'User-Agent': 'AT-Resource-Grid tree fall build (NPS Appalachian National Scenic Trail)'}
IDS = 'https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_InsectandDiseaseSurvey_01/MapServer/1'
IDS_YEAR = 2016
CANOPY = ['https://lfps.usgs.gov/arcgis/rest/services/Landfire_LF2023/LF2023_CH_CONUS/ImageServer',
          'https://lfps.usgs.gov/arcgis/rest/services/Landfire_LF2022/LF2022_CH_CONUS/ImageServer',
          'https://apps.fs.usda.gov/fsgisx01/rest/services/RDW_Landfire/US_ForestCanopyHeight_v200/ImageServer',
          'https://apps.fs.usda.gov/fsgisx01/rest/services/RDW_Landfire/US_ForestCanopyHeight_v140/ImageServer']


def http_json(url, data=None, tries=4, timeout=180):
    last = ''
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode() if data else None, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                j = json.load(r)
            if isinstance(j, dict) and j.get('error'):
                raise RuntimeError(str(j['error'].get('message') or j['error'])[:200])
            return j
        except Exception as e:
            last = f'{type(e).__name__}: {e}'; time.sleep(4 * (k + 1))
    raise RuntimeError(last)


def chunks_of(lon, lat, n=3000):
    """bounding boxes over runs of consecutive trail points (the trail is in order), with a margin wide enough for nearby sites"""
    for i in range(0, len(lon), n):
        a, b = lon[i:i + n], lat[i:i + n]; ok = np.isfinite(a) & np.isfinite(b)
        if ok.any(): yield float(a[ok].min()) - .04, float(b[ok].min()) - .04, float(a[ok].max()) + .04, float(b[ok].max()) + .04


def ids_flags(lon, lat, nt, meta):
    """for every point: inside a mapped mortality area, inside a mapped defoliation area (survey years from IDS_YEAR)"""
    from shapely.geometry import shape
    mort, defo = np.zeros(len(lon), bool), np.zeros(len(lon), bool)
    kinds = {'mort': ('2,16', mort), 'def': ('1,12,13,14', defo)}; got = {k: 0 for k in kinds}
    pts = shapely.points(lon, lat)
    done = np.zeros(len(lon), bool)
    for box in chunks_of(lon[:nt], lat[:nt]):
        sel = np.flatnonzero(~done & (lon >= box[0]) & (lon <= box[2]) & (lat >= box[1]) & (lat <= box[3]))
        if not len(sel): continue
        done[sel] = True
        for k, (codes, flag) in kinds.items():
            where = f'survey_year >= {IDS_YEAR} AND damage_type_code IN ({codes})'
            geo = json.dumps({'xmin': box[0], 'ymin': box[1], 'xmax': box[2], 'ymax': box[3], 'spatialReference': {'wkid': 4326}})
            ids = http_json(IDS + '/query', {'where': where, 'geometry': geo, 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects', 'returnIdsOnly': 'true', 'f': 'json'}).get('objectIds') or []
            polys = []
            for i in range(0, len(ids), 200):
                j = http_json(IDS + '/query', {'objectIds': ','.join(map(str, ids[i:i + 200])), 'outFields': 'survey_year', 'returnGeometry': 'true', 'outSR': 4326, 'maxAllowableOffset': .0003, 'f': 'geojson'})
                for f in j.get('features') or []:
                    try:
                        g = shape(f['geometry'])
                        if not g.is_empty: polys.append(g)
                    except Exception:
                        pass
            got[k] += len(polys)
            if polys:
                tree = shapely.STRtree(polys); pi, _ = tree.query(pts[sel], predicate='within'); flag[sel[np.unique(pi)]] = True
    meta['ids'] = {'from_year': IDS_YEAR, 'areas_read': got, 'points_in_mortality': int(mort.sum()), 'points_in_defoliation': int(defo.sum())}
    print(f'IDS: {got} damage areas read; {mort.mean() * 100:.1f}% of points in mortality, {defo.mean() * 100:.1f}% in defoliation', flush=True)
    return mort, defo


def canopy(lon, lat, meta):
    """forest canopy height (m) at every point from a LANDFIRE image service (values are meters x 10)"""
    errs = []
    for url in CANOPY:
        try:
            out = np.full(len(lon), np.nan); raw = []
            for i in range(0, len(lon), 500):
                g = json.dumps({'points': [[float(a), float(b)] for a, b in zip(lon[i:i + 500], lat[i:i + 500])], 'spatialReference': {'wkid': 4326}})
                j = http_json(url + '/getSamples', {'geometry': g, 'geometryType': 'esriGeometryMultipoint', 'returnFirstValueOnly': 'true', 'f': 'json'})
                for smp in j.get('samples') or []:
                    k = i + int(smp.get('locationId', 0)); v = smp.get('value')
                    try: v = float(str(v).split()[0])
                    except Exception: continue
                    if 0 <= k < len(out): out[k] = v; raw.append(v)
                if i == 0 and not raw: raise RuntimeError('no samples returned')
            raw = np.array(raw); vals, cnt = np.unique(np.round(raw), return_counts=True); top = sorted(zip(cnt.tolist(), vals.tolist()), reverse=True)[:12]
            h = np.where((out >= 30) & (out <= 600), out / 10.0, np.nan)          # 3 to 60 m forest; other codes are not forest
            meta['canopy'] = {'service': url, 'common_values': [v for _, v in top], 'forest_points_pct': round(float(np.isfinite(h).mean() * 100), 1)}
            print(f'canopy height from {url}: {np.isfinite(h).mean() * 100:.0f}% forest points, median {np.nanmedian(h):.1f} m', flush=True)
            return h
        except Exception as e:
            errs.append(f'{url.split("/services/")[1]}: {e}'); print(f'   canopy {url}: {e}', flush=True)
    meta['canopy'] = {'error': ' | '.join(errs)[:900]}
    return None


def main():
    t0 = time.time(); sys.path.insert(0, SCRIPTS); import build_trail_slope as ts
    grids = ts.load_grids()                                           # in EPSG:5070, like the stations
    x, y, u, v, part = ts.stations(ts.centerline())
    x, y = x[::3], y[::3]                                             # every 30 m
    ll = gpd.GeoSeries(gpd.points_from_xy(x, y), crs=ts.AEA).to_crs(4326); lon, lat = ll.x.values, ll.y.values
    dem = DEM(); v = tpi(dem, lon, lat); ok = np.isfinite(v)
    print(f'{len(lon):,} trail points; median TPI {np.nanmedian(v):.0f} m; {np.mean(v[ok] > EXPOSED) * 100:.0f}% exposed ({time.time() - t0:.0f} s, {len(dem.t)} tiles)', flush=True)
    meta = {'built': date.today().isoformat(), 'source': 'USGS 3D Elevation Program, 1 arc-second DEM (read at about 60 m), on the A.T. centerline every 30 m', 'radius_m': RADIUS, 'exposed_m': EXPOSED, 'missing_tiles': dem.bad}
    h = open(ts.INDEX, encoding='utf-8').read()
    P = json.loads(re.search(r'<script id="payload" type="application/json">(.*?)</script>', h, re.S).group(1))
    st = [f for f in (P.get('feat') or []) if f[0] in SITES and f[3] is not None]
    slat = np.array([f[3] for f in st], float); slon = np.array([f[4] for f in st], float)
    sv = tpi(dem, slon, slat) if len(st) else np.array([]); sok = np.isfinite(sv)
    sxy = gpd.GeoSeries(gpd.points_from_xy(slon, slat), crs=4326).to_crs(ts.AEA); sx, sy = sxy.x.values, sxy.y.values
    print(f'{len(st):,} high-use sites; {np.mean(sv[sok] > EXPOSED) * 100 if sok.any() else 0:.0f}% exposed', flush=True)
    meta['sites'] = sorted(SITES); meta['site_weight_points'] = SITE_W
    alon, alat = np.concatenate([lon, slon]), np.concatenate([lat, slat]); nt = len(lon)
    try:
        mort, defo = ids_flags(alon, alat, nt, meta)
    except Exception as e:
        mort = defo = None; meta['ids'] = {'error': str(e)[:600]}; print('IDS:', e, flush=True)
    ch = canopy(alon, alat, meta)
    themes = {}
    for lv, cells in grids['corr'].items():
        own = ts.owners(cells, x, y); n = len(cells); m = (own >= 0) & ok
        s_ = np.bincount(own[m], weights=v[m], minlength=n); k = np.bincount(own[m], minlength=n).astype(float); e = np.bincount(own[m], weights=(v[m] > EXPOSED).astype(float), minlength=n)
        so = ts.owners(cells, sx, sy) if len(st) else np.array([], int); sm = (so >= 0) & sok
        ns = np.bincount(so[sm], minlength=n); nse = np.bincount(so[sm], weights=(sv[sm] > EXPOSED).astype(float), minlength=n); ssum = np.bincount(so[sm], weights=sv[sm], minlength=n)
        W = k + SITE_W * ns; keep = np.flatnonzero((k >= 5) | (ns > 0))
        def wmean(vals, scale=1.0):
            # point values averaged with the site weighting (trail points 1, sites SITE_W); NaN values left out
            if vals is None: return None
            tv, sv_ = np.asarray(vals[:nt], float), np.asarray(vals[nt:], float)
            tm = m & np.isfinite(tv); smk = ((so >= 0) if len(st) else np.zeros(0, bool)) & np.isfinite(sv_)
            num = np.bincount(own[tm], weights=tv[tm], minlength=n) + SITE_W * np.bincount(so[smk], weights=sv_[smk], minlength=n)
            den = np.bincount(own[tm], minlength=n) + SITE_W * np.bincount(so[smk], minlength=n)
            return [None if den[i] == 0 else round(float(scale * num[i] / den[i]), 1) for i in keep]
        themes[lv] = {'ids': [cells['id'].iat[i] for i in keep], 'f': {
            'TOPO_TPI': [int(round((s_[i] + SITE_W * ssum[i]) / W[i])) for i in keep], 'TOPO_EXP': [round(100 * (e[i] + SITE_W * nse[i]) / W[i], 1) for i in keep],
            'TOPO_SITE': [int(ns[i]) for i in keep], 'TOPO_SITE_EXP': [int(nse[i]) for i in keep], 'TOPO_N': [int(k[i]) for i in keep]}}
        f = themes[lv]['f']
        if mort is not None: f['IDS_MORT'] = wmean(mort.astype(float), 100); f['IDS_DEF'] = wmean(defo.astype(float), 100)
        if ch is not None: f['CH_MEAN'] = wmean(ch)
        print(f'{lv}: {len(keep)} cells with trail or high-use sites measured', flush=True)
    json.dump({'run': date.today().isoformat(), 'meta': meta, 'themes': {'topo': themes}}, open(OUT['corr'], 'w', encoding='utf-8'), separators=(',', ':'))
    print('wrote', OUT['corr'], f'{os.path.getsize(OUT["corr"]) / 1e6:.2f} MB ({time.time() - t0:.0f} s)', flush=True)
    if dem.bad: print('tiles not read:', ', '.join(dem.bad), flush=True)


if __name__ == '__main__':
    main()
