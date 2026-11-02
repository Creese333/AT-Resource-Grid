"""
Topographic wind exposure for the A.T. Resource Grid: a factor in the windfall risk screening score
("Where is the treadway most at risk?", Tree fall vulnerability).

From USGS 3DEP 1 arc-second elevation (about 30 m; the 1-degree cloud-optimized GeoTIFFs, read at their first overview, about
60 m, so only a few MB per tile are fetched). Each grid cell is sampled on a regular grid of points (as the weather build does).
At every point the topographic position index (TPI) is the point's elevation minus the mean elevation 1 km away in eight
directions: ridges, summits and upper slopes stand above their surroundings and take the wind; hollows and coves are sheltered.
  TOPO_TPI   mean TPI of the cell's points, m (positive: the cell sits high in its landscape)
  TOPO_EXP   share of the cell's points that are exposed (TPI over 25 m), %

  python scripts/build_topo_exposure.py
Writes data/topo_exposure.json (A.T. corridor cells; the treadway question is corridor only). Needs geopandas, shapely, rasterio, numpy.
Terrain does not change: run it once, and again only if the grid changes.
"""
import json, os, re, time
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


def main():
    t0 = time.time(); grids = load_grids(); dem = DEM()
    meta = {'built': date.today().isoformat(), 'source': 'USGS 3D Elevation Program, 1 arc-second DEM (read at about 60 m)', 'radius_m': RADIUS, 'exposed_m': EXPOSED}
    for ext, L in grids.items():
        themes = {}
        for lv, cells in L.items():
            x, y, own = sample_points(cells, lv); n = len(cells)
            v = tpi(dem, x, y); ok = np.isfinite(v)
            s = np.bincount(own[ok], weights=v[ok], minlength=n); k = np.bincount(own[ok], minlength=n)
            e = np.bincount(own[ok], weights=(v[ok] > EXPOSED).astype(float), minlength=n)
            with np.errstate(all='ignore'):
                mean = np.where(k > 0, s / k, np.nan); share = np.where(k > 0, 100 * e / k, np.nan)
            f = {'TOPO_TPI': [None if not np.isfinite(m) else int(round(m)) for m in mean], 'TOPO_EXP': [None if not np.isfinite(p) else round(float(p), 1) for p in share]}
            themes[lv] = {'ids': cells['id'].tolist(), 'f': f}
            print(f'{ext} {lv}: {n} cells, {len(x):,} points, median exposed {np.nanmedian(share):.0f}% ({time.time() - t0:.0f} s, {len(dem.t)} tiles)', flush=True)
        json.dump({'run': date.today().isoformat(), 'meta': dict(meta, missing_tiles=dem.bad), 'themes': {'topo': themes}}, open(OUT[ext], 'w', encoding='utf-8'), separators=(',', ':'))
        print('wrote', OUT[ext], f'{os.path.getsize(OUT[ext]) / 1e6:.1f} MB', flush=True)
    if dem.bad: print('tiles not read:', ', '.join(dem.bad), flush=True)


if __name__ == '__main__':
    main()
