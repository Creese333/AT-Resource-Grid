"""Viewsheds from A.T. overlooks: which land can be seen from the trail, and therefore where a change on the
ground would be seen from it.

For each overlook in POINTS the script
  1. downloads terrain around it (AWS Terrain Tiles, which carry USGS 3DEP over the lower 48 - public, no sign-in,
     so this runs unattended in Actions where Earth Engine cannot),
  2. reprojects it to a local UTM grid at RES_M,
  3. moves the observer to the highest ground within SNAP_M of the given coordinate, because a published overlook
     coordinate often sits at the foot of the cliff rather than on top of it and a viewshed is very sensitive to that,
  4. casts rays to every cell on the edge of the window, tracking the steepest horizon seen so far, with earth
     curvature and atmospheric refraction,
  5. summarizes the result onto the dashboard's cells: what share of each cell can be seen from the overlook.

Writes data/viewshed.json and data/viewshed_huc10.json (cell summaries) and, for each overlook, a flat
data/viewshed_<id>_<surface>.geojson of the visible area by distance zone, for the 3D page. Everything lands
directly in data/ - no subfolders, because files are uploaded from a phone.

Fields per cell: VS_PCT share of the cell that can be seen (%), VS_ACRES visible acres, VS_MI miles to the overlook.
"""
import io, json, math, os, time

import numpy as np

import nasa_common as nc
from nasa_common import log, rnd, LEVELS

# ---------------------------------------------------------------- settings
# Each overlook is looked up by name in the A.T. vista inventory (the same layer as the dashboard's Vistas), so the
# observer stands where APPA's own record puts the vista. lat/lon is only the fallback if that lookup fails: Mountain
# Project's point for the cliff (801 ft), not the GNIS feature point, which sits at the foot of the cliff (384 ft).
POINTS = [
    {'id': 'weverton-cliffs', 'name': 'Weverton Cliffs', 'vista': 'weverton',
     'lat': 39.33231, 'lon': -77.67658,
     'where': 'Maryland, above the Potomac at Weverton',
     'note': 'The A.T. climbs from the river to a rock ledge looking up the Potomac water gap.'},
]
SVC = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/'
VISTAS = SVC + 'ANST_Facilities/FeatureServer/5'
RADIUS_KM = float(os.environ.get('VS_RADIUS_KM', '') or 16.0)   # 16 km is about 10 miles
RES_M = float(os.environ.get('VS_RES_M', '') or 10.0)
SURFACES = [s for s in (os.environ.get('VS_SURFACES', '') or 'bare,canopy').split(',') if s.strip()]
OBS_H = 1.7            # eye height above the ground, metres
TGT_H = 0.0            # 0 = can the ground itself be seen
REFRACTION = 0.13      # standard atmospheric refraction
SNAP_M = float(os.environ.get('VS_SNAP_M', '') or 40.0)   # a small nudge onto the rock, never a walk up the ridge
CLEAR_M = 30.0         # with canopy: the overlook itself is open ground
# Meta and WRI global canopy height, 1 m, public on AWS: one Cloud Optimized GeoTIFF per zoom-9 quadkey, read through
# its overviews so only about 8 m data is pulled. The same model the notebook uses through Earth Engine.
CHM = 'https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/{qk}.tif'
TILE_Z = int(os.environ.get('VS_TILE_Z', '') or 14)
TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
UA = {'User-Agent': 'AT-Resource-Grid/1.0 (+https://grid.trailassessment.org)'}
ACRES_PER_M2 = 1 / 4046.8564224
R_MERC = 6378137.0
EARTH_R = 6371008.8

# distance zones, the USFS Scenery Management System convention the notebook uses
ZONES = [(2, 'Foreground (0-0.5 mi)', 804.672),
         (3, 'Middleground (0.5-4 mi)', 6437.376),
         (4, 'Background (4+ mi)', float('inf'))]
ZONE_RGB = {2: (214, 40, 40), 3: (247, 127, 0), 4: (252, 191, 73)}


# ---------------------------------------------------------------- terrain
def merc(lon, lat):
    x = math.radians(lon) * R_MERC
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R_MERC
    return x, y


def get_tile(z, x, y, tries=4):
    import requests
    url = TILES.format(z=z, x=x, y=y)
    for i in range(tries):
        try:
            r = requests.get(url, timeout=60, headers=UA)
            if r.status_code == 404:
                return None                      # ocean and off-coverage tiles are simply absent
            r.raise_for_status()
            from PIL import Image
            return np.asarray(Image.open(io.BytesIO(r.content)).convert('RGB'), dtype=np.float64)
        except Exception as e:
            if i + 1 == tries:
                log(f'    tile {z}/{x}/{y}: giving up ({str(e)[:60]})')
                return None
            time.sleep(1.5 * (i + 1))
    return None


def fetch_terrain(lon, lat, radius_m, z=TILE_Z):
    """Terrain around a point as (elevation array, affine transform) in Web Mercator.
    Terrarium tiles hold elevation in the RGB channels: (R*256 + G + B/256) - 32768 metres."""
    from rasterio.transform import from_origin
    span = R_MERC * 2 * math.pi
    res = span / (256 * 2 ** z)                                   # metres per pixel at the equator
    cx, cy = merc(lon, lat)
    # mercator exaggerates ground distance by 1/cos(lat), so the window must be that much bigger
    half = radius_m / math.cos(math.radians(lat)) + 4 * res
    x0, x1, y0, y1 = cx - half, cx + half, cy - half, cy + half
    px0 = int(math.floor((x0 + span / 2) / res)); px1 = int(math.ceil((x1 + span / 2) / res))
    py0 = int(math.floor((span / 2 - y1) / res)); py1 = int(math.ceil((span / 2 - y0) / res))
    tx0, tx1, ty0, ty1 = px0 // 256, (px1 - 1) // 256, py0 // 256, (py1 - 1) // 256
    nx, ny = (tx1 - tx0 + 1), (ty1 - ty0 + 1)
    log(f'    terrain: {nx}x{ny} tiles at zoom {z} ({res:.1f} m/px)')
    out = np.full((ny * 256, nx * 256), np.nan)
    got = 0
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            a = get_tile(z, tx, ty)
            if a is None:
                continue
            got += 1
            out[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = \
                a[:, :, 0] * 256 + a[:, :, 1] + a[:, :, 2] / 256 - 32768
    if not got:
        raise SystemExit('No terrain tiles could be read; the elevation tile service may be unreachable.')
    log(f'    terrain: {got} of {nx * ny} tiles read')
    tr = from_origin(tx0 * 256 * res - span / 2, span / 2 - ty0 * 256 * res, res, res)
    return out, tr


def utm_epsg(lon, lat):
    return (32600 if lat >= 0 else 32700) + int((lon + 180) // 6) + 1


def analysis_grid(lon, lat, radius_m, res_m):
    """A square UTM grid centred on the observer, with the observer at a cell centre."""
    from rasterio.crs import CRS
    from rasterio.transform import from_origin
    from rasterio.warp import transform as warp_xy
    crs = CRS.from_epsg(utm_epsg(lon, lat))
    xs, ys = warp_xy(CRS.from_epsg(4326), crs, [lon], [lat])
    half = int(math.ceil(radius_m / res_m)) + 2
    n = 2 * half + 1
    return crs, from_origin(xs[0] - (half + .5) * res_m, ys[0] + (half + .5) * res_m, res_m, res_m), n, float(half), float(half)


def to_grid(src, src_tr, crs, tr, n):
    from rasterio.crs import CRS
    from rasterio.warp import reproject, Resampling
    out = np.full((n, n), np.nan)
    reproject(source=src, destination=out, src_transform=src_tr, src_crs=CRS.from_epsg(3857),
              src_nodata=np.nan, dst_transform=tr, dst_crs=crs, dst_nodata=np.nan,
              resampling=Resampling.bilinear)
    return out


# ---------------------------------------------------------------- where the overlook is
def find_vista(p):
    """The overlook's own record in the A.T. vista inventory: a feature whose name holds p['vista'], nearest the
    fallback point. Returns (lat, lon, name) or None, and logs what it found either way."""
    import requests
    if not p.get('vista'):
        return None
    pad = .03
    q = {'where': f"UPPER(Name) LIKE '%{p['vista'].upper()}%'", 'outFields': '*', 'outSR': 4326, 'f': 'geojson',
         'geometry': f"{p['lon'] - pad},{p['lat'] - pad},{p['lon'] + pad},{p['lat'] + pad}",
         'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects'}
    try:
        r = requests.get(VISTAS + '/query', params=q, timeout=60, headers=UA)
        feats = [f for f in (r.json().get('features') or []) if (f.get('geometry') or {}).get('type') == 'Point']
    except Exception as e:
        log(f'    vista inventory not read ({str(e)[:70]}); using the fallback point'); return None
    if not feats:
        log(f"    no vista named like '{p['vista']}' near the fallback point; using it instead"); return None
    near = lambda f: math.hypot(f['geometry']['coordinates'][0] - p['lon'], f['geometry']['coordinates'][1] - p['lat'])
    f = min(feats, key=near)
    lon, lat = f['geometry']['coordinates'][:2]
    nm = (f.get('properties') or {}).get('Name') or p['name']
    log(f'    vista inventory: "{nm}" at {lat:.6f}, {lon:.6f} '
        f'({near(f) * 111000:.0f} m from the fallback point; {len(feats)} matched)')
    return lat, lon, nm


def rc_to_lonlat(r, c, crs, tr):
    from rasterio.warp import transform as warp_xy
    from rasterio.crs import CRS
    x, y = tr * (c + .5, r + .5)
    xs, ys = warp_xy(crs, CRS.from_epsg(4326), [x], [y])
    return xs[0], ys[0]


# ---------------------------------------------------------------- canopy
def quadkey(lon, lat, z=9):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return ''.join(str((1 if x & (1 << (i - 1)) else 0) + (2 if y & (1 << (i - 1)) else 0)) for i in range(z, 0, -1))


def fetch_canopy(crs, tr, n):
    """Canopy height in metres on the analysis grid, from the Meta/WRI model. None if it cannot be read: the build
    then carries on with bare earth alone and says so, rather than failing."""
    import rasterio
    from rasterio.warp import reproject, Resampling, transform_bounds
    from rasterio.transform import array_bounds
    W, S, E, N = transform_bounds(crs, 'EPSG:4326', *array_bounds(n, n, tr))
    qks = sorted({quadkey(x, y) for x in np.linspace(W, E, 6) for y in np.linspace(S, N, 6)})
    out = np.zeros((n, n), np.float32); got = 0
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', AWS_NO_SIGN_REQUEST='YES', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
               GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='2')
    with rasterio.Env(**env):
        for qk in qks:
            url = '/vsicurl/' + CHM.format(qk=qk)
            try:
                with rasterio.open(url) as base:
                    res0 = abs(base.transform.a) * (111320 if base.crs and base.crs.is_geographic else 1)
                    facs = base.overviews(1)
                    lvl = max([i for i, f in enumerate(facs) if res0 * f <= RES_M] or [-1])
                log(f'    canopy {qk}: {res0:.1f} m, overviews {facs}, reading level {lvl}')
                kw = {'overview_level': lvl} if lvl >= 0 else {}
                with rasterio.open(url, **kw) as src:
                    part = np.full((n, n), np.nan, np.float32)
                    reproject(source=rasterio.band(src, 1), destination=part, src_nodata=src.nodata, dst_nodata=np.nan,
                              dst_transform=tr, dst_crs=crs, resampling=Resampling.average)
                ok = np.isfinite(part); out[ok] = np.maximum(part[ok], 0); got += 1
            except Exception as e:
                log(f'    canopy {qk}: not read ({str(e)[:90]})')
    if not got:
        log('    canopy: nothing could be read; building bare earth only'); return None
    log(f'    canopy: {got} of {len(qks)} tiles read, median height {np.median(out[out > 0]) if (out > 0).any() else 0:.1f} m')
    return out


# ---------------------------------------------------------------- viewshed
def engine():
    """The ray-casting viewshed, compiled on first use."""
    from numba import njit

    @njit(cache=True)
    def _bilinear(dem, r, c):
        ny, nx = dem.shape
        r0 = int(math.floor(r)); c0 = int(math.floor(c))
        if r0 < 0 or c0 < 0 or r0 >= ny - 1 or c0 >= nx - 1:
            rr = min(max(int(round(r)), 0), ny - 1); cc = min(max(int(round(c)), 0), nx - 1)
            return dem[rr, cc]
        fr = r - r0; fc = c - c0
        z00 = dem[r0, c0]; z01 = dem[r0, c0 + 1]; z10 = dem[r0 + 1, c0]; z11 = dem[r0 + 1, c0 + 1]
        if math.isnan(z00) or math.isnan(z01) or math.isnan(z10) or math.isnan(z11):
            return dem[int(round(r)), int(round(c))]
        return (z00 * (1 - fr) * (1 - fc) + z01 * (1 - fr) * fc + z10 * fr * (1 - fc) + z11 * fr * fc)

    @njit(cache=True)
    def _cast(dem, vis, r0, c0, zobs, rt, ct, cell, maxd, tgt_h, curv):
        dr = rt - r0; dc = ct - c0
        n = int(max(abs(dr), abs(dc)))
        if n == 0:
            return
        ny, nx = dem.shape
        max_s = -1e30
        for i in range(1, n + 1):
            r = r0 + dr * i / n; c = c0 + dc * i / n
            ri = int(round(r)); ci = int(round(c))
            if ri < 0 or ci < 0 or ri >= ny or ci >= nx:
                break
            d = math.hypot(r - r0, c - c0) * cell
            if d > maxd:
                break
            z = _bilinear(dem, r, c)
            if math.isnan(z):
                continue
            drop = curv * d * d
            s_ground = (z - drop - zobs) / d
            s_target = (z + tgt_h - drop - zobs) / d
            if s_target >= max_s:
                vis[ri, ci] = 1
            if s_ground > max_s:
                max_s = s_ground

    @njit(cache=True)
    def _viewshed(dem, r0, c0, obs_h, tgt_h, cell, maxd, curv):
        ny, nx = dem.shape
        vis = np.zeros((ny, nx), np.uint8)
        zobs = _bilinear(dem, r0, c0) + obs_h
        ri0 = int(round(r0)); ci0 = int(round(c0))
        vis[ri0, ci0] = 1
        rad = int(math.ceil(maxd / cell)) + 1
        rmin = max(0, ri0 - rad); rmax = min(ny - 1, ri0 + rad)
        cmin = max(0, ci0 - rad); cmax = min(nx - 1, ci0 + rad)
        for c in range(cmin, cmax + 1):
            _cast(dem, vis, r0, c0, zobs, rmin, c, cell, maxd, tgt_h, curv)
            _cast(dem, vis, r0, c0, zobs, rmax, c, cell, maxd, tgt_h, curv)
        for r in range(rmin + 1, rmax):
            _cast(dem, vis, r0, c0, zobs, r, cmin, cell, maxd, tgt_h, curv)
            _cast(dem, vis, r0, c0, zobs, r, cmax, cell, maxd, tgt_h, curv)
        return vis, zobs
    return _viewshed


def viewshed(dem, r0, c0, cell, maxd, obs_h=OBS_H, tgt_h=TGT_H, refraction=REFRACTION):
    fn = viewshed.fn = getattr(viewshed, 'fn', None) or engine()
    curv = (1.0 - refraction) / (2.0 * EARTH_R)
    return fn(np.ascontiguousarray(dem, dtype=np.float64), float(r0), float(c0),
              float(obs_h), float(tgt_h), float(cell), float(maxd), curv)


def snap(dem, r0, c0, res, snap_m):
    """Move the observer to the highest ground within snap_m. A published overlook coordinate is often at the
    foot of the cliff; the view belongs to the top of it."""
    rad = int(snap_m / res)
    rr, cc = np.mgrid[-rad:rad + 1, -rad:rad + 1]
    near = (np.hypot(rr, cc) * res) <= snap_m
    win = dem[int(r0) - rad:int(r0) + rad + 1, int(c0) - rad:int(c0) + rad + 1].copy()
    win[~near | ~np.isfinite(win)] = -1e9
    i = int(np.argmax(win)); dr, dc = divmod(i, win.shape[1])
    return float(int(r0) - rad + dr), float(int(c0) - rad + dc)


# ---------------------------------------------------------------- outputs
def zones_of(n, r0, c0, res, maxd):
    rr, cc = np.mgrid[0:n, 0:n]
    d = np.hypot(rr - r0, cc - c0) * res
    return d, d <= maxd


def classify(vis, inside, d):
    """0 outside, 1 inside the circle but hidden, 2/3/4 in view by distance zone"""
    cls = np.zeros(vis.shape, np.uint8)
    cls[inside] = 1
    v = inside & (vis == 1)
    lo = 0.0
    for code, _, hi in ZONES:
        cls[v & (d >= lo) & (d < hi)] = code
        lo = hi
    return cls


def zone_stats(cls):
    """Acres in view per zone, counted before any specks are tidied away for the map, so the totals are the whole answer."""
    a = RES_M * RES_M * ACRES_PER_M2
    inside = int((cls >= 1).sum()); seen = int((cls >= 2).sum())
    return {'acres': round(seen * a), 'pct': round(100 * seen / max(inside, 1), 1),
            'zones': {str(c): round(int((cls == c).sum()) * a) for c, _, _ in ZONES}}


def write_geojson(path, cls, crs, tr, stats, sieve=4, simplify=None):
    """Visible area as lon/lat polygons, one feature per distance zone, each carrying its acres, for the 3D page."""
    from rasterio import features
    from rasterio.warp import transform_geom
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    res = abs(tr.a)
    simplify = res if simplify is None else simplify
    c = features.sieve(cls, size=sieve, connectivity=8) if sieve and sieve > 1 else cls
    feats = []
    for code, label, _ in ZONES:
        m = c == code
        if not m.any():
            continue
        gs = [shape(g) for g, val in features.shapes(m.astype(np.uint8), mask=m, transform=tr, connectivity=8) if val == 1]
        g = unary_union(gs).simplify(simplify, preserve_topology=True)
        if g.is_empty:
            continue
        feats.append({'type': 'Feature', 'properties': {'zone': code, 'label': label, 'rgb': list(ZONE_RGB[code]),
                                                        'acres': stats['zones'][str(code)]},
                      'geometry': transform_geom(crs, 'EPSG:4326', mapping(g), precision=6)})
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, separators=(',', ':'))
    return os.path.getsize(path)


def main():
    G = nc.grids()
    fields = {ext: {lv: {} for lv in LEVELS} for ext in G}
    meta_pts = []
    for p in POINTS:
        log(f"{p['name']}")
        hit = find_vista(p)
        lat, lon = (hit[0], hit[1]) if hit else (p['lat'], p['lon'])
        radius = RADIUS_KM * 1000.0
        crs, tr, n, r0, c0 = analysis_grid(lon, lat, radius, RES_M)
        log(f'    grid {n}x{n} at {RES_M:.0f} m, {crs.to_string()}')
        src, src_tr = fetch_terrain(lon, lat, radius)
        dem = to_grid(src, src_tr, crs, tr, n)
        valid = np.isfinite(dem)
        if not valid[int(r0), int(c0)]:
            log('    no elevation at the overlook; skipped'); continue
        seed_z = float(dem[int(r0), int(c0)])
        sr, sc = snap(dem, r0, c0, RES_M, SNAP_M)
        moved = math.hypot(sr - r0, sc - c0) * RES_M
        top_z = float(dem[int(sr), int(sc)])
        olon, olat = rc_to_lonlat(sr, sc, crs, tr)
        log(f'    ground at the point {seed_z:.0f} m ({seed_z * 3.28084:.0f} ft); observer nudged {moved:.0f} m to '
            f'{olat:.6f}, {olon:.6f} at {top_z:.0f} m ({top_z * 3.28084:.0f} ft)')
        if moved > SNAP_M * .95:
            log('    NOTE: the observer reached the edge of its search radius; check the point on the topo map.')
        r0, c0 = sr, sc
        d, inside = zones_of(n, r0, c0, RES_M, radius)
        inside &= valid
        lab = nc.Labeler(G, crs, tr, (n, n))
        built, stats, chm = [], {}, None
        for surf in SURFACES:
            if surf == 'bare':
                z = dem
            elif surf == 'canopy':
                if chm is None:
                    chm = fetch_canopy(crs, tr, n)
                if chm is None:
                    continue
                ch = chm.copy()
                ch[d <= CLEAR_M] = 0.0            # the overlook itself is open rock
                z = dem + ch
            else:
                log(f'    surface "{surf}" is not one this script knows; skipped'); continue
            vis, zobs = viewshed(np.where(valid, z, np.nan), r0, c0, RES_M, radius)
            cls = classify(vis, inside, d)
            st = zone_stats(cls)
            tag = f"{p['id']}_{surf}"
            size = write_geojson(os.path.join(nc.DATA, f'viewshed_{tag}.geojson'), cls, crs, tr, st)
            log(f"    {surf}: {st['acres']:,} acres in view ({st['pct']}% of the {RADIUS_KM * .621371:.0f} mile circle), "
                f"zones {st['zones']}, map layer {size / 1e6:.1f} MB")
            built.append(surf); stats[surf] = st
            if surf != 'bare':
                continue                  # the cell summary follows bare earth
            seen = cls >= 2
            cell_a = RES_M * RES_M
            for ext in G:
                for lv in LEVELS:
                    s, k = lab.sums(ext, lv, seen.astype('float64'), inside)
                    dm, _ = lab.sums(ext, lv, d, inside)
                    pct = np.where(k > 0, 100.0 * s / np.maximum(k, 1), np.nan)
                    acres = s * cell_a * ACRES_PER_M2
                    mi = np.where(k > 0, dm / np.maximum(k, 1) / 1609.344, np.nan)
                    f = fields[ext][lv]
                    f['VS_PCT'] = [rnd(x, 1) if np.isfinite(x) else -1 for x in pct]
                    f['VS_ACRES'] = [rnd(x, 0) if np.isfinite(x) else -1 for x in acres]
                    f['VS_MI'] = [rnd(x, 1) if np.isfinite(x) else -1 for x in mi]
                    if ext == 'corr' and lv == 'hex':
                        log(f'    cells with a value: {int((k > 0).sum())} of {len(k)} ({lv}, {ext})')
        if not built:
            continue
        # the point recorded is where the observer stands, so the pin, the elevation and the analysis all agree
        meta_pts.append({'id': p['id'], 'name': p['name'], 'lat': round(olat, 6), 'lon': round(olon, 6),
                         'elev_ft': round(top_z * 3.28084), 'where': p.get('where', ''), 'note': p.get('note', ''),
                         'source': 'A.T. vista inventory' if hit else 'fallback coordinate',
                         'surfaces': built, 'stats': stats})
    if not meta_pts:
        raise SystemExit('No overlook could be built.')
    meta = {'points': meta_pts, 'radius_mi': round(RADIUS_KM * .621371, 1), 'res_m': RES_M,
            'observer_ft': round(OBS_H * 3.28084, 1), 'refraction': REFRACTION,
            'zones': [{'code': c, 'label': l, 'rgb': list(ZONE_RGB[c])} for c, l, _ in ZONES],
            'source': 'AWS Terrain Tiles (USGS 3DEP over the lower 48); canopy from Meta and WRI global canopy height'}
    nc.write('viewshed', 'vs', G, fields, meta)


if __name__ == '__main__':
    main()
