"""Shared pieces for the NASA Earthdata builds (build_canopy_loss.py, build_forest_structure.py, build_green_up.py, build_climate_change.py).

- grids(): the corridor cells (from the page) and the HUC10 shell cells (from soils_wetlands_huc10.json), at the 1, 7 and 49 sq mi levels.
- login(): signs in to NASA Earthdata with the EARTHDATA_TOKEN secret, or EARTHDATA_USERNAME and EARTHDATA_PASSWORD.
- Labeler: lays the cells over any raster grid, so pixel values can be summed or averaged by cell.
- write(): writes data/<name>.json and data/<name>_huc10.json in the dashboard's layout (themes -> level -> ids and fields).
"""
import json, os, re, sys
from datetime import date
import numpy as np, geopandas as gpd
from shapely.geometry import Polygon

SCRIPTS = os.path.dirname(os.path.abspath(__file__)); HERE = os.path.dirname(SCRIPTS)
DATA = os.path.join(HERE, 'data'); INDEX = os.path.join(HERE, 'index.html'); HUCFILE = os.path.join(DATA, 'soils_wetlands_huc10.json')
sys.path.insert(0, SCRIPTS)
from page import read_page   # index.html + data/app.js + data/grid.json
LEVELS = ('hex', 'cog', 'wheel')
ACRES_PER_M2 = 1 / 4046.8564224


def log(*a):
    print(*a, flush=True)


def _rings(L):
    out = []
    for g in L['g']:
        la, lo = g[0], g[1]; r = [(lo / 1e5, la / 1e5)]
        for k in range(2, len(g), 2):
            la += g[k]; lo += g[k + 1]; r.append((lo / 1e5, la / 1e5))
        out.append(Polygon(r))
    return out


def grids():
    """{'corr': {level: GeoDataFrame(id, geometry)}, 'huc': {...}} in longitude and latitude"""
    h = read_page(INDEX)
    P = json.loads(re.search(r'<script id="payload" type="application/json">(.*?)</script>', h, re.S).group(1))
    g = {'corr': {lv: gpd.GeoDataFrame({'id': P['levels'][lv]['id']}, geometry=_rings(P['levels'][lv]), crs=4326) for lv in LEVELS}}
    if os.path.exists(HUCFILE):
        H = json.load(open(HUCFILE, encoding='utf-8'))
        g['huc'] = {lv: gpd.GeoDataFrame({'id': H['levels'][lv]['id']}, geometry=_rings(H['levels'][lv]), crs=4326) for lv in LEVELS}
    return g


def footprint(G):
    """one outline around every cell, for choosing which tiles and boxes to read"""
    allc = gpd.GeoSeries(list(G['huc']['wheel'].geometry if 'huc' in G else []) + list(G['corr']['wheel'].geometry), crs=4326)
    return allc.buffer(0.02).union_all()


def login():
    import earthaccess
    for k in ('EARTHDATA_TOKEN', 'EARTHDATA_USERNAME', 'EARTHDATA_PASSWORD'):
        if not os.environ.get(k, '').strip(): os.environ.pop(k, None)     # an unset secret arrives as an empty string
    if not (os.environ.get('EARTHDATA_TOKEN') or (os.environ.get('EARTHDATA_USERNAME') and os.environ.get('EARTHDATA_PASSWORD'))):
        raise SystemExit('No Earthdata login: add the EARTHDATA_TOKEN secret (or EARTHDATA_USERNAME and EARTHDATA_PASSWORD) under Settings > Secrets and variables > Actions.')
    a = earthaccess.login(strategy='environment')
    if not a or not getattr(a, 'authenticated', True):
        raise SystemExit('Earthdata did not accept the login. A token lasts 60 days: make a new one at urs.earthdata.nasa.gov and update the secret.')
    return earthaccess


class Labeler:
    """The cells of every extent and level laid over one raster grid (crs, transform, shape).
    lab[ext][lv] is an int32 array: 0 outside every cell, else cell index + 1. With coarse=True (grids of about 1 km), a cell too
    small to hold a pixel center is given the pixel under its center."""
    def __init__(self, G, crs, transform, shape, coarse=False):
        from rasterio import features
        from rasterio.transform import rowcol, array_bounds
        self.lab, self.extra, self.n = {}, {}, {}
        H, W = shape
        x0, y0, x1, y1 = array_bounds(H, W, transform)   # west, south, east, north
        for ext, L in G.items():
            self.lab[ext], self.extra[ext], self.n[ext] = {}, {}, {}
            for lv, cells in L.items():
                c = cells.to_crs(crs); n = len(c); self.n[ext][lv] = n
                from shapely.geometry import box
                inb = c.geometry.intersects(box(x0, y0, x1, y1))
                pos = np.where(inb.values)[0]
                idx = [(c.geometry.iloc[i], int(i) + 1) for i in pos]
                a = features.rasterize(idx, out_shape=shape, transform=transform, fill=0, dtype='int32') if idx else np.zeros(shape, 'int32')
                self.lab[ext][lv] = a; ex = []
                if coarse and len(pos):
                    have = np.bincount(a.ravel(), minlength=n + 1)[1:] > 0
                    miss = np.array([i for i in pos if not have[i]], dtype=int)
                    if len(miss):
                        cen = c.geometry.iloc[miss].representative_point()
                        rr, cc = rowcol(transform, cen.x.values, cen.y.values)
                        for i, r, q in zip(miss, rr, cc):
                            if 0 <= r < H and 0 <= q < W: ex.append((int(i), int(r), int(q)))
                self.extra[ext][lv] = ex

    def sums(self, ext, lv, values, valid=None):
        """per cell: (sum of values, number of pixels) over valid pixels"""
        a = self.lab[ext][lv]; n = self.n[ext][lv]
        m = (a > 0) if valid is None else (a > 0) & valid
        s = np.bincount(a[m], weights=values[m].astype('float64'), minlength=n + 1)[1:]
        k = np.bincount(a[m], minlength=n + 1)[1:].astype('float64')
        for i, r, q in self.extra[ext][lv]:
            if valid is None or valid[r, q]:
                s[i] += float(values[r, q]); k[i] += 1
        return s, k

    def counts(self, ext, lv, mask):
        a = self.lab[ext][lv]; n = self.n[ext][lv]
        k = np.bincount(a[mask & (a > 0)], minlength=n + 1)[1:].astype('float64')
        for i, r, q in self.extra[ext][lv]:
            if mask[r, q]: k[i] += 1
        return k


def rnd(v, d):
    return None if v is None or not np.isfinite(v) else (round(float(v), d) if d else int(round(float(v))))


def previous(name, ext):
    p = os.path.join(DATA, name + ('_huc10' if ext == 'huc' else '') + '.json')
    try:
        return json.load(open(p, encoding='utf-8'))
    except Exception:
        return None


def write(name, theme, G, fields, meta):
    """fields[ext][lv] = {FIELD: list per cell, in the order of G[ext][lv]}"""
    for ext in G:
        if ext not in fields: continue
        p = os.path.join(DATA, name + ('_huc10' if ext == 'huc' else '') + '.json')
        th = {lv: {'ids': G[ext][lv]['id'].tolist(), 'f': fields[ext][lv]} for lv in LEVELS if lv in fields[ext]}
        json.dump({'run': date.today().isoformat(), 'meta': meta, 'themes': {theme: th}}, open(p, 'w', encoding='utf-8'), separators=(',', ':'))
        log('wrote', p, f'{os.path.getsize(p) / 1e6:.1f} MB')
