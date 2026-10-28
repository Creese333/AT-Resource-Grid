"""
Weather and climate for the A.T. Resource Grid: "What are the weather and climate here?"

Builds weather.json (A.T. corridor cells) and weather_huc10.json (HUC10 shell cells, read from soils_wetlands_huc10.json) from:
  - PRISM 30-year normals, 1991-2020, 800 m (PRISM Group, Oregon State University; USDA's official climatological data):
    rainfall (precipitation as water) by month and year, mean temperature by month and year, July average high, January average low.
  - NOAA nClimGrid-Daily (NOAA National Centers for Environmental Information), 1991-2020, about 4 km: frost-free season length
    (days between the last spring and first fall day at or below 32 F) and heavy-rain days (1 inch or more), averaged over the years.
  - gridMET (University of Idaho; a research product), 1991-2020, about 4 km: mean wind speed and windy days (daily mean wind of
    15 mph or more at 10 m). The 4 km grid smooths the terrain, so ridge-top wind is understated: read it as relative.
  - NOAA Storm Events Database (NCEI, from National Weather Service Storm Data), 1996 to the last full year: damaging wind
    (thunderstorm wind, high wind, strong wind, tornado), flooding (flash flood, flood) and winter storms (ice storm, winter storm,
    heavy snow, blizzard). Every event counts in each cell whose center is in the National Weather Service forecast zone or county it
    was reported for, so the counts mean the same at every cell size.
  - NOAA Atlas 14 precipitation frequency (NWS Hydrometeorological Design Studies Center): the 25-year, 24-hour rainfall.

Every value is summarized by sampling a regular grid of points in each cell (as the geology build does). Each source is optional:
if one cannot be read, the run goes on, and the fields from that source keep their values from the previous weather.json.

  python build_weather.py            everything (the daily grids take an hour or two)
  python build_weather.py storms     only the Storm Events counts; everything else is kept from the previous files
Needs geopandas, pyogrio, shapely, rasterio, xarray, netCDF4 and numpy. Runs in GitHub Actions (.github/workflows/weather.yml).
"""
import csv, gzip, io, json, math, os, re, sys, tempfile, time, urllib.request, zipfile
from collections import defaultdict
from datetime import date
import warnings
warnings.filterwarnings('ignore')
import numpy as np, pandas as pd, geopandas as gpd
from shapely.geometry import Polygon

SCRIPTS = os.path.dirname(os.path.abspath(__file__))          # scripts/
HERE = os.path.dirname(SCRIPTS)                                  # the repository: index.html
DATA = os.path.join(HERE, 'data')                                # what the dashboard loads
INPUTS = os.path.join(HERE, 'inputs')                            # tables kept by hand
CACHE = os.path.join(HERE, 'cache')                              # kept between runs; the dashboard never loads these
for _d in (DATA, INPUTS, CACHE): os.makedirs(_d, exist_ok=True)
INDEX = os.path.join(HERE, 'index.html')
HUCFILE = os.path.join(DATA, 'soils_wetlands_huc10.json')
OUT = {'corr': os.path.join(DATA, 'weather.json'), 'huc': os.path.join(DATA, 'weather_huc10.json')}
AEA = 5070
UA = {'User-Agent': 'AT-Resource-Grid weather build (github.com/Creese333/AT-Resource-Grid)'}
YEARS = list(range(1991, 2021))                         # the 1991-2020 normal period, as the PRISM normals
POINTS = {'hex': 5, 'cog': 8, 'wheel': 12}              # sample grid per cell side
PRISM = 'https://data.prism.oregonstate.edu/normals/us/800m/{v}/monthly/prism_{v}_us_30s_2020{m}_avg_30y.zip'
NCG = ['https://www.ncei.noaa.gov/thredds/dodsC/nclimgrid-daily/{y}/ncdd-{y}{m:02d}-grd-scaled.nc',         # OPeNDAP: only the box is read
       'https://www.ncei.noaa.gov/data/nclimgrid-daily/access/grids/{y}/ncdd-{y}{m:02d}-grd-scaled.nc',      # whole files
       'https://www.ncei.noaa.gov/pub/data/daily-grids/v1-0-0/grids/{y}/ncdd-{y}{m:02d}-grd-scaled.nc']
GRIDMET = ['http://thredds.northwestknowledge.net:8080/thredds/dodsC/MET/vs/vs_{y}.nc',
           'http://thredds.northwestknowledge.net:8080/thredds/fileServer/MET/vs/vs_{y}.nc']
STORMS = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
ZONES_PAGE = 'https://www.weather.gov/gis/PublicZones'
ZONES_DIR = 'https://www.weather.gov/source/gis/Shapefiles/WSOM/'
COUNTIES = ['https://www2.census.gov/geo/tiger/GENZ{y}/shp/cb_{y}_us_county_500k.zip'.format(y=y) for y in (2024, 2023, 2022)]
ATLAS = 'https://hdsc.nws.noaa.gov/pub/hdsc/data/{r}/'
ATLAS_REGIONS = ['orb', 'ne', 'se']                     # NOAA Atlas 14 volumes 2, 10 and 9
WINDY_MS = 6.7056                                       # 15 mph
GROUPS = {'WIND': {'Thunderstorm Wind', 'High Wind', 'Strong Wind', 'Tornado'},
          'FLOOD': {'Flash Flood', 'Flood'},
          'WINTER': {'Ice Storm', 'Winter Storm', 'Heavy Snow', 'Blizzard'}}
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
def F(c):
    """degrees C to F, one decimal; -1.0 is stored as -1.1, since the dashboard reads -1 as no data"""
    if c is None or not np.isfinite(c): return None
    f = round(c * 9 / 5 + 32, 1)
    return -1.1 if f == -1.0 else f


# ---------------------------------------------------------------- web
def get(url, tries=4, timeout=600):
    last = None
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(5 * (k + 1))
    raise RuntimeError(f'{url}: {last}')


def listing(url):
    """file names linked from a web directory page"""
    h = get(url).decode('utf-8', 'replace')
    return sorted(set(os.path.basename(x.rstrip('/')) for x in re.findall(r'href="([^"?#]+)"', h)))


# ---------------------------------------------------------------- grids and sample points
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
    grids = {'corr': {lv: gpd.GeoDataFrame({'id': P['levels'][lv]['id']}, geometry=rings_of(P['levels'][lv]), crs=4326) for lv in ('hex', 'cog', 'wheel')}}
    if os.path.exists(HUCFILE):
        H = json.load(open(HUCFILE, encoding='utf-8'))
        grids['huc'] = {lv: gpd.GeoDataFrame({'id': H['levels'][lv]['id']}, geometry=rings_of(H['levels'][lv]), crs=4326) for lv in ('hex', 'cog', 'wheel')}
    else:
        print('soils_wetlands_huc10.json not found: the HUC10 shell is left out', flush=True)
    return grids


def sample_points(cells, lv):
    """a regular grid of points over each cell (kept where inside it), in longitude and latitude, and the cell each belongs to"""
    import shapely
    k = POINTS[lv]; xs, ys, owner = [], [], []
    for i, (x0, y0, x1, y1) in enumerate(cells.geometry.bounds.values):
        gx = x0 + (np.arange(k) + .5) * (x1 - x0) / k; gy = y0 + (np.arange(k) + .5) * (y1 - y0) / k
        X, Y = np.meshgrid(gx, gy); xs.append(X.ravel()); ys.append(Y.ravel()); owner.append(np.full(k * k, i))
    x, y, own = np.concatenate(xs), np.concatenate(ys), np.concatenate(owner)
    inside = shapely.contains_xy(cells.geometry.values[own], x, y)
    x, y, own = x[inside], y[inside], own[inside]
    missing = np.setdiff1d(np.arange(len(cells)), own)               # tiny cells: their center stands in
    if len(missing):
        c = cells.geometry.values[missing].centroid
        x = np.concatenate([x, shapely.get_x(c)]); y = np.concatenate([y, shapely.get_y(c)]); own = np.concatenate([own, missing])
    return x, y, own


def cell_mean(vals, own, n):
    """mean of the point values in each cell (missing values left out); NaN where a cell has none"""
    v = np.asarray(vals, dtype='float64'); ok = np.isfinite(v)
    s = np.bincount(own[ok], weights=v[ok], minlength=n); k = np.bincount(own[ok], minlength=n)
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(k > 0, s / np.maximum(k, 1), np.nan)


# ---------------------------------------------------------------- PRISM normals
def prism_raster(var, month):
    """(path of the GeoTIFF, temporary folder) for one PRISM 800 m normal; month '' is the annual normal"""
    raw = get(PRISM.format(v=var, m=month)); tmp = tempfile.mkdtemp()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        z.extractall(tmp)
    tif = [os.path.join(tmp, f) for f in os.listdir(tmp) if f.lower().endswith(('.tif', '.tiff', '.bil'))]
    if not tif:
        raise RuntimeError(f'no raster in the PRISM {var} {month} download')
    return tif[0], tmp


def sample_raster(path, x, y):
    """the raster value under each point (longitude, latitude); reads only the window around the points"""
    import rasterio
    from rasterio.warp import transform
    from rasterio.windows import from_bounds, Window
    with rasterio.open(path) as r:
        if r.crs is None or r.crs.is_geographic:
            xs, ys = np.asarray(x, dtype='float64'), np.asarray(y, dtype='float64')
        else:
            xs, ys = (np.asarray(a) for a in transform('EPSG:4326', r.crs, list(x), list(y)))
        pad = 3 * max(abs(r.transform.a), abs(r.transform.e))
        win = from_bounds(xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad, r.transform).round_offsets().round_lengths()
        win = win.intersection(Window(0, 0, r.width, r.height))
        a = r.read(1, window=win).astype('float64'); t = r.window_transform(win); nd = r.nodata
    col = np.floor((xs - t.c) / t.a).astype(int); row = np.floor((ys - t.f) / t.e).astype(int)
    ok = (row >= 0) & (row < a.shape[0]) & (col >= 0) & (col < a.shape[1])
    v = np.full(len(xs), np.nan); v[ok] = a[row[ok], col[ok]]
    if nd is not None:
        v[v == nd] = np.nan
    v[v < -9000] = np.nan
    return v


def prism_part(P):
    """P: {(ext, lv): (x, y, own, n)} -> {(ext, lv): {field: list}}"""
    out = {k: {} for k in P}; import shutil
    want = [('ppt', f'{m:02d}') for m in range(1, 13)] + [('ppt', '')] + [('tmean', f'{m:02d}') for m in range(1, 13)] + [('tmean', ''), ('tmax', '07'), ('tmin', '01')]
    vals = {k: {} for k in P}
    for var, m in want:
        path, tmp = prism_raster(var, m)
        for k, (x, y, own, n) in P.items():
            vals[k][(var, m)] = cell_mean(sample_raster(path, x, y), own, n)
        shutil.rmtree(tmp, ignore_errors=True); print(f'   PRISM {var} {m or "annual"}', flush=True)
    for k, V in vals.items():
        n = len(V[('ppt', '')]); pm = np.vstack([V[('ppt', f'{m:02d}')] for m in range(1, 13)]); tm = np.vstack([V[('tmean', f'{m:02d}')] for m in range(1, 13)])
        f = out[k]
        f['WX_PPT'] = [None if not np.isfinite(v) else round(v / 25.4, 1) for v in V[('ppt', '')]]
        f['WX_PPT_M'] = [None if not np.isfinite(pm[:, i]).all() else [round(v / 25.4, 2) for v in pm[:, i]] for i in range(n)]
        f['WX_WETM'] = [None if not np.isfinite(pm[:, i]).all() else int(np.argmax(pm[:, i])) for i in range(n)]
        f['WX_TMEAN'] = [F(v) for v in V[('tmean', '')]]
        f['WX_TMEAN_M'] = [None if not np.isfinite(tm[:, i]).all() else [F(v) for v in tm[:, i]] for i in range(n)]
        f['WX_TMAX7'] = [F(v) for v in V[('tmax', '07')]]
        f['WX_TMIN1'] = [F(v) for v in V[('tmin', '01')]]
    return out


# ---------------------------------------------------------------- daily grids (nClimGrid-Daily, gridMET)
def open_box(urls, bounds, names):
    """the variables in names (first one found of each), cut to the box and read into memory, from the first URL that opens: (arrays, lat, lon, times)"""
    import xarray as xr
    x0, y0, x1, y1 = bounds; last = None
    for u in urls:
        tmp = None
        try:
            if '/dodsC/' in u:
                ds = xr.open_dataset(u, decode_times=True)
            else:
                tmp = tempfile.NamedTemporaryFile(suffix='.nc', delete=False); tmp.write(get(u)); tmp.close()
                ds = xr.open_dataset(tmp.name, decode_times=True)
            with ds:
                la = next(c for c in ('lat', 'latitude', 'y') if c in ds.variables)
                lo = next(c for c in ('lon', 'longitude', 'x') if c in ds.variables)
                lat, lon = ds[la].values, ds[lo].values
                iy = np.where((lat >= y0 - .1) & (lat <= y1 + .1))[0]; ix = np.where((lon >= x0 - .1) & (lon <= x1 + .1))[0]
                sub = ds.isel({ds[la].dims[0]: slice(iy.min(), iy.max() + 1), ds[lo].dims[0]: slice(ix.min(), ix.max() + 1)})
                got, times = {}, None
                for want in names:
                    v = next((v for v in want if v in sub.variables), None)
                    if v is None:
                        raise RuntimeError(f'none of {want} in {u}')
                    da = sub[v]; got[want[0]] = da.values.astype('float32')
                    if times is None: times = pd.to_datetime(da[da.dims[0]].values)
                return got, sub[la].values, sub[lo].values, times
        except Exception as e:
            last = e
        finally:
            if tmp is not None:
                try: os.remove(tmp.name)
                except OSError: pass
    raise RuntimeError(f'could not read {urls[0]}: {last}')


def pool(n):
    """worker processes (netCDF is not safe to read from several threads at once)"""
    import multiprocessing as mp
    from concurrent.futures import ProcessPoolExecutor
    return ProcessPoolExecutor(n, mp_context=mp.get_context('fork'))


def nearest(grid_lat, grid_lon, x, y):
    """index of the nearest grid row and column for each point (regular grid)"""
    ry = np.clip(np.rint((y - grid_lat[0]) / (grid_lat[1] - grid_lat[0])).astype(int), 0, len(grid_lat) - 1)
    rx = np.clip(np.rint((x - grid_lon[0]) / (grid_lon[1] - grid_lon[0])).astype(int), 0, len(grid_lon) - 1)
    return ry, rx


def _ncg_month(job):
    y, m, bounds = job
    g, lat, lon, times = open_box([u.format(y=y, m=m) for u in NCG], bounds, [('prcp',), ('tmin',)])
    p, t = g['prcp'], g['tmin']                                             # (day, lat, lon), mm and degrees C
    doy = times.dayofyear.values
    heavy = np.nansum(p >= 25.4, axis=0).astype('float32')
    valid = np.isfinite(p).any(axis=0)
    frost = np.where(t <= 0, doy[:, None, None], np.nan)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        return y, m, lat, lon, heavy, valid, np.nanmax(frost, axis=0) if m <= 7 else None, np.nanmin(frost, axis=0) if m >= 8 else None


def nclimgrid_part(bounds):
    """per grid point, averaged over 1991-2020: heavy-rain days a year, frost-free season (days)"""
    acc = {}; t0 = time.time(); jobs = [(y, m, bounds) for y in YEARS for m in range(1, 13)]; done = 0
    with pool(4) as ex:
        for y, m, lat, lon, heavy, valid, spring, fall in ex.map(_ncg_month, jobs):
            if 'lat' not in acc:
                acc.update(lat=lat, lon=lon, heavy=np.zeros(heavy.shape), valid=np.zeros(heavy.shape, bool), spring={}, fall={})
            acc['heavy'] += heavy; acc['valid'] |= valid
            if spring is not None:
                acc['spring'][y] = np.fmax(acc['spring'].get(y, np.full(heavy.shape, np.nan)), spring)
            if fall is not None:
                acc['fall'][y] = np.fmin(acc['fall'].get(y, np.full(heavy.shape, np.nan)), fall)
            done += 1
            if done % 24 == 0:
                print(f'   nClimGrid-Daily: {done} of {len(jobs)} months ({time.time() - t0:.0f} s)', flush=True)
    shape = acc['heavy'].shape; ff = []
    for y in YEARS:
        s = np.nan_to_num(acc['spring'].get(y, np.full(shape, np.nan)), nan=0)              # no spring frost: the season starts 1 January
        f = np.nan_to_num(acc['fall'].get(y, np.full(shape, np.nan)), nan=366 if y % 4 == 0 else 365)
        ff.append(f - s - 1)
    heavy = np.where(acc['valid'], acc['heavy'] / len(YEARS), np.nan); ff = np.where(acc['valid'], np.mean(ff, axis=0), np.nan)
    lat, lon = acc['lat'], acc['lon']
    if lat[0] > lat[-1]:
        return lat[::-1], lon, heavy[::-1], ff[::-1]
    return lat, lon, heavy, ff


def _gm_year(job):
    y, bounds = job
    g, lat, lon, _ = open_box([u.format(y=y) for u in GRIDMET], bounds, [('wind_speed', 'vs', 'daily_mean_wind_speed')])
    w = g['wind_speed']
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        return lat, lon, np.nanmean(w, axis=0), np.where(np.isfinite(w).any(axis=0), np.nansum(w >= WINDY_MS, axis=0), np.nan)


def gridmet_part(bounds):
    """per grid point, over 1991-2020: mean wind speed (m/s) and windy days a year"""
    mean, windy = [], []; t0 = time.time()
    with pool(3) as ex:
        for k, (lat, lon, m, d) in enumerate(ex.map(_gm_year, [(y, bounds) for y in YEARS]), 1):
            mean.append(m); windy.append(d)
            if k % 5 == 0:
                print(f'   gridMET: {k} of {len(YEARS)} years ({time.time() - t0:.0f} s)', flush=True)
    m, d = np.mean(mean, axis=0), np.mean(windy, axis=0)
    if lat[0] > lat[-1]:
        return lat[::-1], lon, m[::-1], d[::-1]
    return lat, lon, m, d


def grid_to_cells(P, lat, lon, arrays, names, fmt):
    out = {k: {} for k in P}
    for k, (x, y, own, n) in P.items():
        ry, rx = nearest(lat, lon, x, y)
        for a, nm, fn in zip(arrays, names, fmt):
            v = cell_mean(a[ry, rx], own, n)
            out[k][nm] = [None if not np.isfinite(z) else fn(z) for z in v]
    return out


# ---------------------------------------------------------------- Storm Events
STATE_ABBR = {'01': 'AL', '09': 'CT', '10': 'DE', '11': 'DC', '13': 'GA', '21': 'KY', '23': 'ME', '24': 'MD', '25': 'MA', '33': 'NH', '34': 'NJ',
              '36': 'NY', '37': 'NC', '39': 'OH', '42': 'PA', '44': 'RI', '45': 'SC', '47': 'TN', '50': 'VT', '51': 'VA', '54': 'WV'}


def storm_files():
    names = [n for n in listing(STORMS) if n.startswith('StormEvents_details') and n.endswith('.csv.gz')]
    best = {}
    for n in names:
        m = re.search(r'_d(\d{4})_c(\d{8})', n)
        if m and int(m.group(1)) >= 1996 and (m.group(1) not in best or n > best[m.group(1)]):
            best[m.group(1)] = n
    last = date.today().year - 1                                          # full years only
    return {int(y): STORMS + n for y, n in sorted(best.items()) if int(y) <= last}


def zones_and_counties():
    zones = None
    try:
        page = get(ZONES_PAGE).decode('utf-8', 'replace'); MO = ['ja', 'fe', 'mr', 'ap', 'my', 'jn', 'jl', 'au', 'se', 'oc', 'no', 'de']        # NWS file names: z_DDmmYY.zip, newest last
        when = lambda n: (int(n[6:8]), MO.index(n[4:6].lower()) if n[4:6].lower() in MO else 0, int(n[2:4]))
        zz = sorted(set(re.findall(r'z_\d{2}[a-zA-Z]{2}\d{2}\.zip', page)), key=when)
        if zz:
            tmp = tempfile.mkdtemp(); p = os.path.join(tmp, zz[-1]); open(p, 'wb').write(get(ZONES_DIR + zz[-1]))
            zones = gpd.read_file(p).to_crs(4326)
            zones['key'] = zones['STATE'].astype(str) + 'Z' + zones['ZONE'].astype(str).str.zfill(3)
            print(f'   forecast zones: {zz[-1]}, {len(zones)} zones', flush=True)
    except Exception as e:
        print(f'   forecast zones not read ({e}); zone-wide events are left out', flush=True)
    counties = None
    for u in COUNTIES:
        try:
            tmp = tempfile.mkdtemp(); p = os.path.join(tmp, 'c.zip'); open(p, 'wb').write(get(u))
            counties = gpd.read_file(p).to_crs(4326); counties['key'] = counties['GEOID'].astype(str); print(f'   counties: {u}', flush=True); break
        except Exception as e:
            print(f'   {u}: {e}', flush=True)
    return zones, counties


def storms_part(grids, P):
    files = storm_files(); zones, counties = zones_and_counties()
    states = set(STATE_ABBR.values())
    group = {t: g for g, ts in GROUPS.items() for t in ts}
    trees, keys = {}, {}
    for ext, L in grids.items():
        for lv, cells in L.items():
            trees[(ext, lv)] = True
            c = gpd.GeoDataFrame({'i': range(len(cells))}, geometry=cells.geometry.representative_point(), crs=4326)
            keys[(ext, lv)] = {}
            for nm, layer in (('Z', zones), ('C', counties)):
                if layer is None: continue
                j = gpd.sjoin(c, layer[['key', 'geometry']], predicate='within', how='inner')
                m = defaultdict(list)
                for i, k in zip(j['i'], j['key']): m[k].append(i)
                keys[(ext, lv)][nm] = m
    cnt = {k: {g: np.zeros(len(grids[k[0]][k[1]]), int) for g in GROUPS} for k in trees}
    yr = {k: defaultdict(lambda: defaultdict(int)) for k in trees}           # cell -> (year, group) -> events
    stats = defaultdict(int)
    for y, url in files.items():
        rows = csv.DictReader(io.StringIO(gzip.decompress(get(url)).decode('latin-1')))
        n = 0
        for r in rows:
            g = group.get((r.get('EVENT_TYPE') or '').strip())
            if not g: continue
            st = STATE_ABBR.get(str(r.get('STATE_FIPS') or '').zfill(2))
            if st not in states: continue
            n += 1
            # every event counts in the National Weather Service forecast zone or county it was reported for, so a cell's count is the same
            # whatever its size: events touching the area around it, not a density that grows with the cell
            ct = (r.get('CZ_TYPE') or '').strip().upper(); fips = str(r.get('CZ_FIPS') or '').zfill(3)
            key = f'{st}Z{fips}' if ct == 'Z' else str(r.get('STATE_FIPS') or '').zfill(2) + fips if ct == 'C' else None
            hit = {k: (keys[k].get(ct, {}).get(key, []) if key else []) for k in trees}
            stats['matched to a zone or county' if any(hit.values()) else 'zone or county not near the trail'] += 1
            for k, cells in hit.items():
                for c in cells:
                    cnt[k][g][c] += 1; yr[k][c][(y, g)] += 1
        print(f'   Storm Events {y}: {n:,} wind, flood and winter events in the trail states', flush=True)
    print('   Storm Events: ' + ', '.join(f'{v:,} {k}' for k, v in stats.items()), flush=True)
    out = {}
    for k in trees:
        f = {'WX_EV_' + g: cnt[k][g].tolist() for g in GROUPS}
        G = list(GROUPS)
        f['WX_EV_Y'] = [[x for y in sorted({yy for yy, _ in yr[k][c]}) for x in [y] + [yr[k][c].get((y, g), 0) for g in G]] if c in yr[k] else []
                        for c in range(len(grids[k[0]][k[1]]))]
        out[k] = f
    return out, {'years': [min(files), max(files)] if files else None, 'groups': {g: sorted(t) for g, t in GROUPS.items()}}


# ---------------------------------------------------------------- NOAA Atlas 14
def atlas_part(P):
    import rasterio
    vals = {k: np.full(len(P[k][0]), np.nan) for k in P}; used = []
    for reg in ATLAS_REGIONS:
        try:
            names = [n for n in listing(ATLAS.format(r=reg)) if re.search(r'25yr24ha(_ams)?\.zip$', n) and 'ams' not in n]
            if not names:
                print(f'   Atlas 14 {reg}: no 25-year 24-hour grid listed', flush=True); continue
            raw = get(ATLAS.format(r=reg) + names[0]); tmp = tempfile.mkdtemp()
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                z.extractall(tmp)
            asc = [os.path.join(tmp, f) for f in os.listdir(tmp) if f.lower().endswith(('.asc', '.tif'))][0]
            for k, (x, y, own, n) in P.items():
                v = sample_raster(asc, x, y)
                vals[k] = np.where(np.isfinite(vals[k]), vals[k], v)
            used.append(names[0]); print(f'   Atlas 14 {reg}: {names[0]}', flush=True)
        except Exception as e:
            print(f'   Atlas 14 {reg}: {e}', flush=True)
    out = {}
    for k, (x, y, own, n) in P.items():
        v = cell_mean(vals[k], own, n) / 1000.0                          # grids are in thousandths of an inch
        out[k] = {'WX_P25': [None if not np.isfinite(z) else round(z, 2) for z in v]}
    return out, used



# ---------------------------------------------------------------- map classes, shared by every cell size and both extents
NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]


def nice(v):
    if not v > 0: return 0
    e = 10 ** math.floor(math.log10(v)); f = v / e
    return min(NICE, key=lambda q: abs(math.log(q / f))) * e


def equal_classes(a, k=6):
    a = np.sort(np.asarray([x for x in a if x is not None and np.isfinite(x)], dtype='float64'))
    if not len(a): return None
    lo, hi = a[int(.02 * (len(a) - 1))], a[int(math.ceil(.98 * (len(a) - 1)))]
    st = nice((hi - lo) / k) or 1; s0 = math.floor(lo / st) * st
    b = [round(s0 + st * i, 4) for i in range(1, k + 1) if s0 + st * i < hi]
    return {'b': b, 'lo': float(a[0]), 'hi': float(a[-1])}


def skew_classes(a):
    a = np.sort(np.asarray([x for x in a if x is not None and np.isfinite(x)], dtype='float64'))
    if not len(a): return None
    pos = a[a > 0]; b = []
    for f in (.3, .55, .75, .9, .97):
        if not len(pos): break
        v = nice(pos[min(len(pos) - 1, int(f * len(pos)))]); v = round(v) if v >= 1 else round(v, 2)
        if not b or v > b[-1]: b.append(v)
    return {'b': b, 'lo': float(a[0]), 'hi': float(a[-1])}


def map_classes(fields, meta):
    """class breaks for each map measure from every cell size of both extents, so a color means the same everywhere"""
    allv = lambda nm, flat=False: [x for f in fields.values() for v in (f.get(nm) or []) if v is not None for x in (v if flat else [v])]
    out = {}
    for nm in ('WX_PPT', 'WX_TMEAN', 'WX_TMAX7', 'WX_TMIN1', 'WX_FROSTFREE', 'WX_HEAVY', 'WX_P25', 'WX_WIND'):
        out[nm] = equal_classes(allv(nm))
    out['WX_PPT_M'] = equal_classes(allv('WX_PPT_M', True)); out['WX_TMEAN_M'] = equal_classes(allv('WX_TMEAN_M', True))
    out['WX_WINDY'] = skew_classes(allv('WX_WINDY'))
    yrs = ((meta.get('storms_info') or {}).get('years')) or None; ny = yrs[1] - yrs[0] + 1 if yrs else None
    for k, g in enumerate(GROUPS):
        if ny: out['WX_EV_' + g] = skew_classes([v / ny for v in allv('WX_EV_' + g)])
        out['WX_EV_' + g + '_Y'] = skew_classes([x[i + 1 + k] for f in fields.values() for x in (f.get('WX_EV_Y') or []) if x for i in range(0, len(x), 4)])
    return {k: v for k, v in out.items() if v}


# ---------------------------------------------------------------- main
def main():
    t0 = time.time(); only_storms = len(sys.argv) > 1 and sys.argv[1].lower() == 'storms'
    grids = load_grids()
    allc = pd.concat([L['wheel'] for L in grids.values()])
    bounds = tuple(allc.total_bounds)
    P = {}
    for ext, L in grids.items():
        for lv, cells in L.items():
            x, y, own = sample_points(cells, lv); P[(ext, lv)] = (x, y, own, len(cells))
    print(f'grids loaded; {sum(len(v[0]) for v in P.values()):,} sample points; area {[round(float(b), 2) for b in bounds]}', flush=True)
    prev = {}
    for ext in grids:
        try:
            prev[ext] = json.load(open(OUT[ext], encoding='utf-8'))
        except Exception:
            prev[ext] = {}
    fields = {k: {} for k in P}; meta = dict((prev.get('corr') or {}).get('meta') or {})

    def keep(names):     # the previous file's values, by cell ID, for fields not rebuilt
        for (ext, lv) in P:
            t = (((prev.get(ext) or {}).get('themes') or {}).get('wx') or {}).get(lv)
            if not t: continue
            pos = {i: j for j, i in enumerate(t['ids'])}; ids = grids[ext][lv]['id'].tolist()
            for nm in names:
                if nm in t['f']:
                    col = t['f'][nm]; fields[(ext, lv)][nm] = [col[pos[i]] if i in pos else None for i in ids]

    def step(label, names, fn):
        try:
            res = fn()
            for k in P: fields[k].update(res[k])
            meta[label] = {'built': date.today().isoformat()}
            print(f'{label}: done ({time.time() - t0:.0f} s)', flush=True); return True
        except Exception as e:
            print(f'{label}: not rebuilt ({e}); keeping the previous values', flush=True); keep(names); return False

    PRISM_F = ['WX_PPT', 'WX_PPT_M', 'WX_WETM', 'WX_TMEAN', 'WX_TMEAN_M', 'WX_TMAX7', 'WX_TMIN1']
    NCG_F = ['WX_HEAVY', 'WX_FROSTFREE']; GM_F = ['WX_WIND', 'WX_WINDY']; AT_F = ['WX_P25']
    if only_storms:
        keep(PRISM_F + NCG_F + GM_F + AT_F)
    else:
        step('prism', PRISM_F, lambda: prism_part(P))
        def ncg():
            lat, lon, heavy, ff = nclimgrid_part(bounds)
            return grid_to_cells(P, lat, lon, [heavy, ff], NCG_F, [lambda v: round(v, 1), lambda v: int(round(v))])
        step('nclimgrid', NCG_F, ncg)
        def gm():
            lat, lon, m, d = gridmet_part(bounds)
            return grid_to_cells(P, lat, lon, [m, d], GM_F, [lambda v: round(v * 2.23694, 1), lambda v: round(v, 1)])
        step('gridmet', GM_F, gm)
        def at():
            res, used = atlas_part(P)
            if not used: raise RuntimeError('no Atlas 14 grid read')
            meta['atlas14_files'] = used; return res
        step('atlas14', AT_F, at)
    ST_F = ['WX_EV_WIND', 'WX_EV_FLOOD', 'WX_EV_WINTER', 'WX_EV_Y']
    def st():
        res, info = storms_part(grids, P); meta['storms_info'] = info; return res
    step('storms', ST_F, st)

    meta['sources'] = {
        'prism': 'PRISM Group, Oregon State University, 30-year normals 1991-2020, 800 m. https://prism.oregonstate.edu',
        'nclimgrid': 'NOAA NCEI nClimGrid-Daily v1, 1991-2020. https://doi.org/10.25921/c4gt-r169',
        'gridmet': 'Abatzoglou, J. T. (2013). Development of gridded surface meteorological data for ecological applications and modelling. International Journal of Climatology 33: 121-131. https://doi.org/10.1002/joc.3413',
        'storms': 'NOAA NCEI Storm Events Database, from NWS Storm Data. https://www.ncei.noaa.gov/stormevents/',
        'atlas14': 'NOAA Atlas 14 Precipitation-Frequency Atlas of the United States, volumes 2, 9 and 10. https://hdsc.nws.noaa.gov/pfds/'}
    cats = {'WX_WETM': MONTHS}
    meta['classes'] = map_classes(fields, meta)
    for ext in grids:
        themes = {}
        for lv in ('hex', 'cog', 'wheel'):
            f = fields[(ext, lv)]
            if ext == 'huc' and lv == 'hex':                 # keep the HUC10 file small: no monthly or yearly lists for its square miles
                for nm in ('WX_PPT_M', 'WX_TMEAN_M', 'WX_EV_Y'): f.pop(nm, None)
            themes[lv] = {'ids': grids[ext][lv]['id'].tolist(), 'f': f}
        with open(OUT[ext], 'w', encoding='utf-8') as fh:
            json.dump({'run': date.today().isoformat(), 'meta': meta, 'cats': cats, 'themes': {'wx': themes}}, fh, separators=(',', ':'))
        print(f'wrote {os.path.basename(OUT[ext])} ({os.path.getsize(OUT[ext]) / 1e6:.1f} MB)', flush=True)
    print(f'done in {time.time() - t0:.0f} s', flush=True)


if __name__ == '__main__':
    main()
