"""
Canopy loss for the A.T. Resource Grid ("What shape is the forest in?"), from NASA's OPERA Land Surface Disturbance Alert
(OPERA_L3_DIST-ALERT-HLS_V1, LP DAAC): vegetation loss mapped at 30 m every 2 to 4 days from Harmonized Landsat and Sentinel-2.

Each alert file holds, for one 110 km MGRS tile, the state of every pixel: VEG-DIST-STATUS (first, provisional or confirmed loss,
under or over 50%, ongoing or finished) and VEG-DIST-DATE (the day loss was first seen, in days since 31 December 2020; an alert drops
out a year after it starts). For each tile this reads the latest few files before a snapshot date, keeps the newest reading of each
pixel, and counts pixels that are
  - confirmed loss (status 3, 6, 7 or 8: confirmed, under or over 50%, ongoing or finished), and
  - tree cover in ESA WorldCover 2021 (10 m, class 10), so mowing, harvest of crops and building work are left out,
by the month loss was first seen. Only the 100 km core of each tile (and only its own UTM zone) is counted, so overlaps count once.

A snapshot covers the 11 months before it. The first run takes snapshots every six months back to 2023, then each run adds the
latest snapshot and keeps the older months from the last file. For each cell (corridor and HUC10 shell; 1, 7 and 49 sq mi) it writes
  DL_FAC   forest acres assessed (tree cover in WorldCover with a reading in the latest snapshot)
  DL_AC    acres of forest with confirmed loss, all months
  DL_PCT   DL_AC as a share of DL_FAC, %
  DL_LAST  the latest month with at least half an acre of loss (months since January 2021: 0 = January 2021)
  DL_M     loss by month: [month, acres x 10, month, acres x 10, ...]

  python scripts/build_canopy_loss.py            the latest snapshot (or the full history on the first run)
  python scripts/build_canopy_loss.py history    rebuild the full history
Needs the EARTHDATA_TOKEN secret (or EARTHDATA_USERNAME and EARTHDATA_PASSWORD). Writes data/canopy_loss.json and
data/canopy_loss_huc10.json. Runs monthly in GitHub Actions (.github/workflows/canopy_loss.yml).
"""
import os, re, sys, shutil, tempfile, time
from datetime import date, datetime, timedelta
import warnings
import numpy as np
warnings.filterwarnings('ignore')
from nasa_common import grids, footprint, login, Labeler, write, previous, log, rnd, LEVELS

SHORT = 'OPERA_L3_DIST-ALERT-HLS_V1'
NAME, THEME = 'canopy_loss', 'dist'
CONFIRMED = (3, 6, 7, 8)
PX_AC = 900 / 4046.8564224                     # one 30 m pixel, in acres
BASE = np.datetime64('2020-12-31')             # day 0 of VEG-DIST-DATE
M0 = np.datetime64('2021-01', 'M')             # month 0 of DL_M
CORE = 163                                     # 4.9 km of overlap on each side of a 3660-pixel tile
PER_TILE = 4                                   # newest alert files read per tile and snapshot
WC = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_{}_Map.tif'


def months_since_2021(d):
    return int((np.datetime64(d, 'M') - M0).astype(int))


def snapshots(full):
    today = date.today()
    if not full: return [today]
    out, d = [], date(2023, 7, 1)
    while d < today - timedelta(days=60):
        out.append(d); d = date(d.year + (d.month + 6 > 12), (d.month + 6 - 1) % 12 + 1, 1)
    return out + [today]


def tile_of(name):
    m = re.search(r'_T(\d{2}[A-Z]{3})_', name)
    return m.group(1) if m else None


def granule_poly(g):
    from shapely.geometry import Polygon
    try:
        gp = g['umm']['SpatialExtent']['HorizontalSpatialDomain']['Geometry']['GPolygons'][0]['Boundary']['Points']
        return Polygon([(p['Longitude'], p['Latitude']) for p in gp])
    except Exception:
        return None


def pick_granules(ea, fp, snap):
    """the newest PER_TILE alert files of every tile that touches the cells, from the three weeks before snap"""
    t0 = (snap - timedelta(days=21)).isoformat(); t1 = snap.isoformat() + 'T23:59:59'
    res = ea.search_data(short_name=SHORT, bounding_box=tuple(fp.bounds), temporal=(t0, t1))
    by = {}
    for g in res:
        nm = g['umm']['GranuleUR']; t = tile_of(nm); poly = granule_poly(g)
        if not t or (poly is not None and not poly.intersects(fp)): continue
        when = g['umm']['TemporalExtent']['RangeDateTime']['BeginningDateTime']
        by.setdefault(t, []).append((when, g))
    for t in by: by[t] = [g for _, g in sorted(by[t], key=lambda x: x[0])][-PER_TILE:]
    log(f'snapshot {snap}: {len(res)} alert files in the area, {len(by)} tiles touch the cells')
    return by


def layer_links(g):
    links = g.data_links(access='external') or g.data_links()
    st = [u for u in links if re.search(r'VEG-?DIST-?STATUS\.tif$', u)]
    dt = [u for u in links if re.search(r'VEG-?DIST-?DATE\.tif$', u)]
    return (st[0], dt[0]) if st and dt else None


def worldcover_forest(dst_crs, transform, shape):
    """tree cover (ESA WorldCover 2021, class 10) on the tile's 30 m grid"""
    import rasterio
    from rasterio.warp import reproject, Resampling, transform_bounds
    from rasterio.transform import array_bounds
    w, s, e, n = transform_bounds(dst_crs, 'EPSG:4326', *array_bounds(shape[0], shape[1], transform))
    out = np.zeros(shape, 'uint8')
    for la in range(int(np.floor(s / 3) * 3), int(np.floor(n / 3) * 3) + 1, 3):
        for lo in range(int(np.floor(w / 3) * 3), int(np.floor(e / 3) * 3) + 1, 3):
            code = f"{'N' if la >= 0 else 'S'}{abs(la):02d}{'W' if lo < 0 else 'E'}{abs(lo):03d}"
            part = np.zeros(shape, 'uint8')
            try:
                with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='3'):
                    with rasterio.open('/vsicurl/' + WC.format(code)) as src:
                        reproject(rasterio.band(src, 1), part, dst_transform=transform, dst_crs=dst_crs, resampling=Resampling.mode, dst_nodata=0)
            except Exception as ex:
                log(f'  WorldCover {code}: not read ({str(ex)[:80]})'); continue
            out = np.where(part > 0, part, out)
    return out == 10


def core_mask(crs, transform, shape, tile):
    """the tile's 100 km core, west and east limited to its own UTM zone"""
    from pyproj import Transformer
    H, W = shape; m = np.zeros(shape, bool); m[CORE:H - CORE, CORE:W - CORE] = True
    zone = int(tile[:2]); lo0, lo1 = -180 + 6 * (zone - 1), -180 + 6 * zone
    cols = np.arange(W) + .5; rows = np.arange(H) + .5
    xs = transform.c + cols * transform.a; ys = transform.f + rows * transform.e
    X, Y = np.meshgrid(xs[::10], ys[::10])                  # every tenth pixel is plenty for a longitude limit
    lon = Transformer.from_crs(crs, 'EPSG:4326', always_xy=True).transform(X, Y)[0]
    ok = (lon >= lo0) & (lon < lo1)
    return m & np.repeat(np.repeat(ok, 10, 0), 10, 1)[:H, :W]


def read_tile(ea, files, tmp):
    import rasterio
    urls = [u for pair in files for u in pair]
    paths = ea.download(urls, local_path=tmp, show_progress=False)
    byname = {os.path.basename(str(p)): str(p) for p in paths}
    st = dt = None; crs = transform = None
    for su, du in files:   # oldest first: newer readings overwrite older ones
        sp, dp = byname.get(os.path.basename(su)), byname.get(os.path.basename(du))
        if not sp or not dp: continue
        with rasterio.open(sp) as a, rasterio.open(dp) as b:
            s = a.read(1); d = b.read(1)
            if st is None: st = np.full(s.shape, 255, 'uint8'); dt = np.full(s.shape, -1, 'int16'); crs, transform = a.crs, a.transform
            if s.shape != st.shape: continue
            v = s != 255; st[v] = s[v]; dt[v] = d[v]
    return st, dt, crs, transform


def main():
    full = 'history' in sys.argv[1:]
    G = grids(); fp = footprint(G); ea = login()
    prev = {ext: previous(NAME, ext) for ext in G}
    if not full and not prev.get('corr'): full = True
    snaps = snapshots(full)
    NM = months_since_2021(date.today()) + 1
    # the alert files for every snapshot, by tile
    picks = [pick_granules(ea, fp, s) for s in snaps]
    tiles = sorted(set(t for p in picks for t in p))
    if not picks[-1]: raise SystemExit('No alert files for the latest snapshot: nothing written.')
    win = []                                  # months each snapshot covers (the 11 months before it)
    for s in snaps:
        w = np.zeros(NM, bool); w[max(0, months_since_2021(s - timedelta(days=330))):months_since_2021(s) + 1] = True; win.append(w)
    snap_loss = [{ext: {lv: np.zeros((len(G[ext][lv]), NM)) for lv in LEVELS} for ext in G} for _ in snaps]
    fac = {ext: {lv: np.zeros(len(G[ext][lv])) for lv in LEVELS} for ext in G}
    for k, tile in enumerate(tiles):
        F = lab = None; tot = None
        for si, p in enumerate(picks):
            files = [x for x in (layer_links(g) for g in p.get(tile, [])) if x]
            if not files: continue
            tmp = tempfile.mkdtemp()
            try:
                st, dt, crs, transform = read_tile(ea, files, tmp)
            except Exception as ex:
                log(f'  {tile} {snaps[si]}: not read ({str(ex)[:100]})'); st = None
            shutil.rmtree(tmp, ignore_errors=True)
            if st is None: continue
            if F is None or F.shape != st.shape:     # forest and cells on this tile's grid, once per tile
                F = worldcover_forest(crs, transform, st.shape) & core_mask(crs, transform, st.shape, tile)
                lab = Labeler(G, crs, transform, st.shape)
            conf = np.isin(st, CONFIRMED) & (dt > 0) & F
            mon = np.zeros(st.shape, 'int32')
            if conf.any():
                d = BASE + dt[conf].astype('timedelta64[D]')
                mon[conf] = (d.astype('datetime64[M]') - M0).astype('int32')
                conf &= (mon >= 0) & (mon < NM)
            for ext in G:
                for lv in LEVELS:
                    a = lab.lab[ext][lv]; n = len(G[ext][lv]); m = conf & (a > 0)
                    if m.any():
                        snap_loss[si][ext][lv] += np.bincount((a[m] - 1).astype('int64') * NM + mon[m], minlength=n * NM).reshape(n, NM) * PX_AC
                    if si == len(snaps) - 1: fac[ext][lv] += lab.counts(ext, lv, F & (st != 255)) * PX_AC
            tot = int(conf.sum() * PX_AC)
        log(f'  {tile} ({k + 1}/{len(tiles)}): ' + ('not read' if tot is None else f'{tot:,} acres of confirmed forest loss in the latest reading'))
    # later snapshots replace earlier ones in the months they share
    loss = {ext: {lv: np.zeros((len(G[ext][lv]), NM)) for lv in LEVELS} for ext in G}
    covered = np.zeros(NM, bool)
    for si in range(len(snaps)):
        if not picks[si]: continue
        for ext in G:
            for lv in LEVELS: loss[ext][lv][:, win[si]] = snap_loss[si][ext][lv][:, win[si]]
        covered |= win[si]

    # months this run did not cover keep their values from the last file
    fields = {}
    for ext in G:
        old = {}
        if prev.get(ext) and THEME in prev[ext].get('themes', {}):
            for lv in LEVELS:
                t = prev[ext]['themes'][THEME].get(lv)
                if t: old[lv] = dict(zip(t['ids'], t['f'].get('DL_M', [])))
        fields[ext] = {}
        for lv in LEVELS:
            ids = G[ext][lv]['id'].tolist(); L = loss[ext][lv]
            for i, cid in enumerate(ids):
                o = old.get(lv, {}).get(cid)
                if o:
                    for j in range(0, len(o), 2):
                        if o[j] < NM and not covered[o[j]]: L[i, o[j]] = o[j + 1] / 10
            dm, ac, pct, last, fa = [], [], [], [], []
            for i in range(len(ids)):
                row = L[i]; nz = np.where(row >= .05)[0]; f = fac[ext][lv][i]
                dm.append([int(x) for j in nz for x in (j, round(row[j] * 10))] or None)
                tot = float(row.sum()); big = np.where(row >= .5)[0]
                fa.append(rnd(f, 0) if f >= 1 else None)
                ac.append(rnd(tot, 1) if f >= 1 else None)
                pct.append(rnd(min(100, 100 * tot / f), 2) if f >= 1 else None)
                last.append(int(big[-1]) if len(big) and f >= 1 else None)
            fields[ext][lv] = {'DL_FAC': fa, 'DL_AC': ac, 'DL_PCT': pct, 'DL_LAST': last, 'DL_M': dm}
            v = [x for x in pct if x is not None]
            log(f'{ext} {lv}: {len(ids)} cells, {len(v)} with forest, median loss {np.median(v) if v else 0:.2f}%')
    cov = np.where(covered)[0]
    meta = {'built': date.today().isoformat(), 'm0': int(cov.min()) if len(cov) else None, 'm1': int(cov.max()) if len(cov) else None,
            'source': 'OPERA Land Surface Disturbance Alert from Harmonized Landsat Sentinel-2, Version 1 (OPERA_L3_DIST-ALERT-HLS_V1), NASA JPL OPERA project, distributed by NASA LP DAAC. Forest from ESA WorldCover 2021 v200 (tree cover).',
            'definition': 'Confirmed vegetation loss (status confirmed, ongoing or finished) on 30 m pixels that are tree cover in ESA WorldCover 2021, by the month loss was first detected.'}
    for ext in G:
        if prev.get(ext) and prev[ext].get('meta', {}).get('m0') is not None and meta['m0'] is not None:
            meta['m0'] = min(meta['m0'], prev[ext]['meta']['m0'])
    write(NAME, THEME, G, fields, meta)


if __name__ == '__main__':
    main()
