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
POINTS = [
    {'id': 'weverton-cliffs', 'name': 'Weverton Cliffs', 'lat': 39.3306567, 'lon': -77.6769357,
     'where': 'Maryland, above the Potomac at Weverton',
     'note': 'The A.T. climbs from the river to a rock ledge looking up the Potomac water gap.'},
]
RADIUS_KM = float(os.environ.get('VS_RADIUS_KM', '') or 16.0)   # 16 km is about 10 miles
RES_M = float(os.environ.get('VS_RES_M', '') or 10.0)
SURFACES = [s for s in (os.environ.get('VS_SURFACES', '') or 'bare').split(',') if s.strip()]
OBS_H = 1.7            # eye height above the ground, metres
TGT_H = 0.0            # 0 = can the ground itself be seen
REFRACTION = 0.13      # standard atmospheric refraction
SNAP_M = 250.0         # how far the observer may move to find the top of the overlook
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


def write_geojson(path, vis, inside, d, crs, tr, sieve=4, simplify=None):
    """Visible area as lon/lat polygons, one feature per distance zone, for the 3D page."""
    from rasterio import features
    from rasterio.warp import transform_geom
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    res = abs(tr.a)
    simplify = res if simplify is None else simplify
    cls = np.zeros(vis.shape, np.uint8)
    cls[inside] = 1
    v = inside & (vis == 1)
    lo = 0.0
    for code, _, hi in ZONES:
        cls[v & (d >= lo) & (d < hi)] = code
        lo = hi
    if sieve and sieve > 1:
        cls = features.sieve(cls, size=sieve, connectivity=8)
    feats = []
    for code, label, _ in ZONES:
        m = cls == code
        if not m.any():
            continue
        gs = [shape(g) for g, val in features.shapes(m.astype(np.uint8), mask=m, transform=tr, connectivity=8) if val == 1]
        g = unary_union(gs).simplify(simplify, preserve_topology=True)
        if g.is_empty:
            continue
        feats.append({'type': 'Feature', 'properties': {'zone': code, 'label': label,
                                                        'rgb': list(ZONE_RGB[code])},
                      'geometry': transform_geom(crs, 'EPSG:4326', mapping(g), precision=6)})
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, separators=(',', ':'))
    return os.path.getsize(path), cls


def main():
    G = nc.grids()
    fields = {ext: {lv: {} for lv in LEVELS} for ext in G}
    meta_pts = []
    for p in POINTS:
        log(f"{p['name']} ({p['lat']}, {p['lon']})")
        radius = RADIUS_KM * 1000.0
        crs, tr, n, r0, c0 = analysis_grid(p['lon'], p['lat'], radius, RES_M)
        log(f'    grid {n}x{n} at {RES_M:.0f} m, {crs.to_string()}')
        src, src_tr = fetch_terrain(p['lon'], p['lat'], radius)
        dem = to_grid(src, src_tr, crs, tr, n)
        valid = np.isfinite(dem)
        if not valid[int(r0), int(c0)]:
            log('    no elevation at the overlook; skipped'); continue
        seed_z = float(dem[int(r0), int(c0)])
        sr, sc = snap(dem, r0, c0, RES_M, SNAP_M)
        moved = math.hypot(sr - r0, sc - c0) * RES_M
        top_z = float(dem[int(sr), int(sc)])
        log(f'    given point {seed_z:.0f} m; observer moved {moved:.0f} m to the high ground at {top_z:.0f} m '
            f'({top_z * 3.28084:.0f} ft)')
        if moved > SNAP_M * .95:
            log('    NOTE: the observer ran to the edge of the search radius; the coordinate may be off.')
        r0, c0 = sr, sc
        d, inside = zones_of(n, r0, c0, RES_M, radius)
        inside &= valid
        lab = nc.Labeler(G, crs, tr, (n, n))
        for surf in SURFACES:
            z = dem                       # 'bare' is the only surface built without a canopy model
            vis, zobs = viewshed(np.where(valid, z, np.nan), r0, c0, RES_M, radius)
            seen = inside & (vis == 1)
            tag = f"{p['id']}_{surf}"
            size, cls = write_geojson(os.path.join(nc.DATA, f'viewshed_{tag}.geojson'),
                                      vis, inside, d, crs, tr)
            tot = int(inside.sum()); nv = int(seen.sum())
            log(f'    {surf}: {nv * RES_M * RES_M * ACRES_PER_M2:,.0f} acres visible '
                f'({100 * nv / max(tot, 1):.1f}% of the {RADIUS_KM * .621371:.0f} mile circle), '
                f'map layer {size / 1e6:.1f} MB')
            if surf != SURFACES[0]:
                continue                  # the cell summary follows the first surface built
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
        meta_pts.append({'id': p['id'], 'name': p['name'], 'lat': p['lat'], 'lon': p['lon'],
                         'elev_ft': round(top_z * 3.28084), 'where': p.get('where', ''),
                         'note': p.get('note', ''), 'surfaces': SURFACES})
    if not meta_pts:
        raise SystemExit('No overlook could be built.')
    meta = {'points': meta_pts, 'radius_mi': round(RADIUS_KM * .621371, 1), 'res_m': RES_M,
            'observer_ft': round(OBS_H * 3.28084, 1), 'refraction': REFRACTION,
            'zones': [{'code': c, 'label': l, 'rgb': list(ZONE_RGB[c])} for c, l, _ in ZONES],
            'source': 'AWS Terrain Tiles (USGS 3DEP over the lower 48)'}
    nc.write('viewshed', 'vs', G, fields, meta)


if __name__ == '__main__':
    main()
