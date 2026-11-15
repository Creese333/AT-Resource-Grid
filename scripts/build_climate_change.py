"""
Climate change since 1980 for the A.T. Resource Grid ("What climate shapes the trail here?"), from Daymet Version 4 R1
(Thornton et al., ORNL DAAC, doi:10.3334/ORNLDAAC/2129): daily weather on a 1 km grid for North America from 1980, a year behind.

For each year it reads, through the ORNL DAAC THREDDS subset service, half-degree boxes covering the cells:
  daily precipitation (heavy-rain days: 1 inch or more), daily low (frost-free season: days between the last spring and the first
  fall low of 32 F or colder, split at 1 July; and the January average low), July daily highs (July average high) and the snowpack
  on 1 April (snow water equivalent).
It compares two 20-year periods, 1981-2000 and the latest 20 years, pixel by pixel, then averages each cell's pixels (the pixels whose
centers fall in the cell, or the nearest one for small cells). For each cell (corridor and HUC10 shell; 1, 7 and 49 sq mi) it writes
  DM_TMIN1_E, DM_TMIN1_L, DM_TMIN1_D   January average low, F: early period, latest period, change
  DM_TMAX7_E, DM_TMAX7_L, DM_TMAX7_D   July average high, F
  DM_HEAVY_E, DM_HEAVY_L, DM_HEAVY_D   heavy-rain days a year
  DM_FROST_E, DM_FROST_L, DM_FROST_D   frost-free season, days
  DM_SWE_E,   DM_SWE_L,   DM_SWE_D     snowpack on 1 April, inches of water

Each box and year is saved to cache/daymet/ as it is read, so a run that stops (GitHub stops a job after six hours) picks up where it
left off when run again; the workflow keeps that folder between runs.

  python scripts/build_climate_change.py
Writes data/climate_change.json and data/climate_change_huc10.json. Runs yearly in GitHub Actions (.github/workflows/climate_change.yml).
"""
import io, os, sys, threading, time, tempfile, warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
import numpy as np
warnings.filterwarnings('ignore')
from nasa_common import grids, footprint, write, log, rnd, LEVELS, HERE

NAME, THEME = 'climate_change', 'dym'
NCSS = 'https://thredds.daac.ornl.gov/thredds/ncss/grid/ornldaac/2129/daymet_v4_daily_na_{var}_{year}.nc'
EARLY = (1981, 2000); SPAN = 20
STEP = 0.5
CACHE = os.path.join(HERE, 'cache', 'daymet')
THREADS = 8
NCLOCK = threading.Lock()                  # the netCDF library is not safe to call from two threads at once


def session():
    """an Earthdata session: the Daymet service sends requests through the NASA sign-in (urs.earthdata.nasa.gov)"""
    import requests
    try:
        from nasa_common import login
        S = login().get_requests_https_session(); log('signed in to Earthdata (earthaccess)')
    except BaseException as ex:
        log(f'earthaccess not used ({str(ex)[:80]}); using the token directly')
        class KeepAuth(requests.Session):
            """keeps the Earthdata token when the service sends the request on to the NASA sign-in and back"""
            def rebuild_auth(self, prepared, response):
                host = requests.utils.urlparse(prepared.url).hostname or ''
                if host.endswith('earthdata.nasa.gov') or host.endswith('ornl.gov') or host.endswith('nasa.gov'): return
                return super().rebuild_auth(prepared, response)
        S = KeepAuth(); sign_in(S)
    S.headers['User-Agent'] = 'AT-Resource-Grid (github.com/Creese333/AT-Resource-Grid)'
    return S


def sign_in(S):
    tok = os.environ.get('EARTHDATA_TOKEN', '').strip()
    if tok and 'Authorization' not in S.headers: S.headers['Authorization'] = 'Bearer ' + tok; return True
    return False


def get(S, var, year, box, t0, t1, tries=5):
    w, s, e, n = box
    q = {'var': var, 'north': n, 'south': s, 'east': e, 'west': w, 'horizStride': 1, 'time_start': t0, 'time_end': t1, 'timeStride': 1, 'accept': 'netcdf4'}
    url = NCSS.format(var=var, year=year)
    for k in range(tries):
        try:
            r = S.get(url, params=q, timeout=300)
            if r.status_code == 200 and r.content[:4] in (b'\x89HDF', b'CDF\x01', b'CDF\x02'): return r.content
            if r.status_code == 400 and q['accept'] == 'netcdf4': q['accept'] = 'netcdf'; continue   # older servers: plain netCDF
            if r.status_code == 401 and sign_in(S): continue                                         # the service asks for the Earthdata login
            if r.status_code in (400, 401, 403, 404): raise RuntimeError(f'{r.status_code} for {r.url[:160]}')
            if r.status_code == 200: raise RuntimeError(f'not a netCDF file from {r.url[:120]}: {r.text[:120]!r}')
        except RuntimeError: raise
        except Exception: pass
        time.sleep(5 * (k + 1))
    raise RuntimeError(f'no answer for {var} {year} {box}')


def open_nc(b, var):
    import netCDF4
    with tempfile.NamedTemporaryFile(suffix='.nc', delete=False) as f: f.write(b); p = f.name
    try:
        with NCLOCK:
            d = netCDF4.Dataset(p); a = d.variables[var][:]; lat = d.variables['lat'][:]; lon = d.variables['lon'][:]
            a = np.ma.filled(a.astype('float32'), np.nan); lat = np.asarray(lat); lon = np.asarray(lon); d.close()
        return a, lat, lon
    finally:
        os.remove(p)


def latest_year(S):
    """the latest year with daily files: asks each year, newest first, for one day of a small box"""
    tiny = (-77.8, 39.3, -77.7, 39.4)
    for y in range(date.today().year - 1, date.today().year - 6, -1):
        try:
            get(S, 'prcp', y, tiny, f'{y}-12-01T12:00:00Z', f'{y}-12-01T12:00:00Z', tries=2); log(f'Daymet has {y}'); return y
        except Exception as ex:
            log(f'  {y}: {str(ex)[:200]}')
    raise SystemExit('Could not read Daymet from the ORNL DAAC THREDDS service (see the lines above).')


def boxes(fp):
    from shapely.geometry import box
    w, s, e, n = fp.bounds; out = []
    for la in np.arange(np.floor(s / STEP) * STEP, n, STEP):
        for lo in np.arange(np.floor(w / STEP) * STEP, e, STEP):
            b = (round(lo, 3), round(la, 3), round(lo + STEP, 3), round(la + STEP, 3))
            if box(*b).intersects(fp): out.append(b)
    return out


def one(S, year, b):
    """the yearly figures for one box: per pixel heavy-rain days, frost-free days, January low, July high (C) and 1 April snowpack (mm)"""
    p = os.path.join(CACHE, f'{year}_{b[0]}_{b[1]}.npz')
    if os.path.exists(p): return p
    y = str(year)
    pr, lat, lon = open_nc(get(S, 'prcp', year, b, y + '-01-01T12:00:00Z', y + '-12-31T12:00:00Z'), 'prcp')
    tn, _, _ = open_nc(get(S, 'tmin', year, b, y + '-01-01T12:00:00Z', y + '-12-31T12:00:00Z'), 'tmin')
    tx, _, _ = open_nc(get(S, 'tmax', year, b, y + '-07-01T12:00:00Z', y + '-07-31T12:00:00Z'), 'tmax')
    sw, _, _ = open_nc(get(S, 'swe', year, b, y + '-04-01T12:00:00Z', y + '-04-01T12:00:00Z'), 'swe')
    heavy = np.sum(pr >= 25.4, 0).astype('float32'); heavy[np.isnan(pr).all(0)] = np.nan
    frost = tn <= 0; dmid = 181                                     # Daymet years have 365 days; day 182 is 1 July
    spring = frost[:dmid]; fall = frost[dmid:]
    last = np.where(spring.any(0), dmid - 1 - np.argmax(spring[::-1], 0), -1)
    firstf = np.where(fall.any(0), dmid + np.argmax(fall, 0), tn.shape[0])
    ffs = (firstf - last - 1).astype('float32'); ffs[np.isnan(tn).all(0)] = np.nan
    jan = np.nanmean(tn[:31], 0); jul = np.nanmean(tx, 0); swe = sw[0] if sw.ndim == 3 else sw
    os.makedirs(CACHE, exist_ok=True)
    np.savez_compressed(p, heavy=heavy, ffs=ffs, jan=jan, jul=jul, swe=swe, lat=lat.astype('float32'), lon=lon.astype('float32'))
    return p


def main():
    G = grids(); fp = footprint(G); S = session()
    y1 = latest_year(S); late = (y1 - SPAN + 1, y1)
    years = list(range(EARLY[0], EARLY[1] + 1)) + list(range(late[0], late[1] + 1))
    bx = boxes(fp); log(f'Daymet through {y1}: periods {EARLY[0]}-{EARLY[1]} and {late[0]}-{late[1]}, {len(bx)} boxes, {len(years) * len(bx)} box-years')
    jobs = [(y, b) for y in years for b in bx]; done = 0; fails = []
    t0 = time.time()
    with ThreadPoolExecutor(THREADS) as ex:
        fut = {ex.submit(one, S, y, b): (y, b) for y, b in jobs}
        for f in as_completed(fut):
            done += 1
            try: f.result()
            except Exception as e: fails.append(fut[f]); log(f'  {fut[f]}: {str(e)[:160]}')
            if done % 200 == 0: log(f'  {done}/{len(jobs)} box-years ({(time.time() - t0) / 60:.0f} min)')
    if len(fails) > 0.02 * len(jobs): raise SystemExit(f'{len(fails)} box-years could not be read; run again to pick up where this stopped.')

    # per pixel: the average of each period, then the pixels into cells
    import geopandas as gpd
    rows = {}
    for b in bx:
        acc = {}
        for per, (a0, a1) in (('E', EARLY), ('L', late)):
            stk = {k: [] for k in ('heavy', 'ffs', 'jan', 'jul', 'swe')}; ll = None
            for y in range(a0, a1 + 1):
                p = os.path.join(CACHE, f'{y}_{b[0]}_{b[1]}.npz')
                if not os.path.exists(p): continue
                z = np.load(p)
                for k in stk: stk[k].append(z[k])
                ll = (z['lat'], z['lon'])
            if not ll: continue
            for k in stk: acc[(k, per)] = np.nanmean(np.stack(stk[k]), 0) if stk[k] else None
            acc['ll'] = ll
        if 'll' not in acc: continue
        lat, lon = acc['ll']
        for i, (la, lo) in enumerate(zip(lat.ravel(), lon.ravel())):
            key = (round(float(lo), 4), round(float(la), 4))
            if key in rows: continue
            rows[key] = [acc[(k, per)].ravel()[i] if acc.get((k, per)) is not None else np.nan for k in ('heavy', 'ffs', 'jan', 'jul', 'swe') for per in ('E', 'L')]
    keys = list(rows); V = np.array([rows[k] for k in keys], dtype='float64')
    pts = gpd.GeoDataFrame(geometry=gpd.points_from_xy([k[0] for k in keys], [k[1] for k in keys]), crs=4326)
    log(f'{len(pts):,} Daymet pixels')
    names = [('HEAVY', 0, 1, 1), ('FROST', 2, 1, 0), ('TMIN1', 4, 1.8, 1), ('TMAX7', 6, 1.8, 1), ('SWE', 8, 1 / 25.4, 2)]
    fields = {}
    for ext in G:
        fields[ext] = {}
        for lv in LEVELS:
            cells = G[ext][lv].reset_index(drop=True); n = len(cells)
            j = gpd.sjoin(pts, cells[['geometry']], predicate='within', how='inner')
            S_ = np.zeros((n, V.shape[1])); K = np.zeros((n, V.shape[1]))
            ok = np.isfinite(V[j.index.values])
            np.add.at(S_, j['index_right'].values, np.where(ok, V[j.index.values], 0)); np.add.at(K, j['index_right'].values, ok)
            empty = np.where(K[:, 0] == 0)[0]
            if len(empty):
                c = cells.iloc[empty].copy(); c['geometry'] = c.representative_point()
                nn = gpd.sjoin_nearest(c.to_crs(5070), pts.to_crs(5070), how='left', max_distance=5000)
                nn = nn[~nn.index.duplicated()]
                for ci, pi in zip(nn.index.values, nn['index_right'].values):
                    if pi == pi: v = V[int(pi)]; m = np.isfinite(v); S_[ci, m] += v[m]; K[ci, m] += 1
            M = np.where(K > 0, S_ / np.maximum(K, 1), np.nan)
            f = {}
            for nm, col, mul, d in names:
                e_, l_ = M[:, col], M[:, col + 1]
                if nm in ('TMIN1', 'TMAX7'): e_, l_ = e_ * 1.8 + 32, l_ * 1.8 + 32
                else: e_, l_ = e_ * mul, l_ * mul
                f[f'DM_{nm}_E'] = [rnd(x, d) for x in e_]; f[f'DM_{nm}_L'] = [rnd(x, d) for x in l_]
                f[f'DM_{nm}_D'] = [rnd(x, max(1, d)) for x in (l_ - e_)]
            fields[ext][lv] = f
            v = [x for x in f['DM_TMIN1_D'] if x is not None]
            log(f'{ext} {lv}: {sum(x is not None for x in f["DM_HEAVY_D"])} of {n} cells; median change in January low {np.median(v) if v else 0:+.1f} F')
    meta = {'built': date.today().isoformat(), 'early': list(EARLY), 'late': list(late),
            'source': 'Daymet: Daily Surface Weather Data on a 1-km Grid for North America, Version 4 R1 (Thornton, M.M., R. Shrestha, Y. Wei, P.E. Thornton and S-C. Kao; ORNL DAAC, doi:10.3334/ORNLDAAC/2129).'}
    write(NAME, THEME, G, fields, meta)


if __name__ == '__main__':
    main()
