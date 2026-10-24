"""
Geology for the A.T. Resource Grid: "What are the geologic resources here?"

Areas are measured with a regular grid of sample points in each cell (36 per square mile cell, 100 per 7 sq mi, 256 per 49 sq mi,
fewer once trimmed to the cell's outline), which is quick and accurate to a few percent.

Two parts, summarized for every 1, 7 and 49 sq mi cell of the A.T. corridor grid (read from index.html) and of the HUC10 shell grid
(read from soils_wetlands_huc10.json), the same two extents as soils:

  1. How well the geology is mapped, from geologic_map_footprints.geojson: the NPS Geologic Resources Inventory's footprints of the
     published and in-progress geologic maps for the Appalachian National Scenic Trail (GRI map footprints, July 2024). The GRI cautions
     that footprints are approximate. The GRI searched the 7.5' quadrangles around the trail, so maps further out in the HUC10 shell
     may be missing.
  2. What the bedrock is, from the USGS State Geologic Map Compilation (SGMC; Horton, San Juan and Stoeser, 2017, USGS Data Series 1052,
     https://doi.org/10.5066/F7WH2N65): one seamless map built from the state geologic maps, with standardized lithology and age.
     Read from ScienceBase's SGMC feature service (or the USGS Energy Resources copy), or, if neither answers, downloaded from ScienceBase.
     MAJOR1 to MAJOR3 are in no order of abundance (DS 1052), so a unit's class is the first class in LITH that any of them matches.

Writes geology.json (corridor) and geology_huc10.json (HUC10 shell). Each holds shared tables (the maps and the bedrock units), category
lists, and per-level columns keyed by grid ID, the way inat_ebird.json does.

Usage: python build_geology.py            (needs geopandas, pyogrio, shapely, pyproj)
       python build_geology.py --sgmc FILE (use a local SGMC file or folder instead of downloading)
"""
import io, json, math, os, re, sys, time, urllib.parse, urllib.request, zipfile, tempfile, glob
from collections import defaultdict
from datetime import date
import warnings
warnings.filterwarnings('ignore')
import geopandas as gpd, pandas as pd, numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, 'index.html')
HUCFILE = os.path.join(HERE, 'soils_wetlands_huc10.json')
FOOT = os.path.join(HERE, 'geologic_map_footprints.geojson')
OUT = {'corr': os.path.join(HERE, 'geology.json'), 'huc': os.path.join(HERE, 'geology_huc10.json')}
AEA = 5070                       # NAD83 / Conus Albers, for areas
COVER = 0.5                      # a map "covers" a cell for the scale measures when it (or maps of that scale together) cover half of it
LIST_MIN = 0.10                  # maps listed for a cell cover at least a tenth of it
TOP_UNITS = 5                    # bedrock units listed per cell

# SGMC feature services, tried in order: ScienceBase's own copy on ArcGIS Online (SGMC_Geology layer), then the USGS Energy Resources copy
SGMC_SERVICES = ['https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/SB_5888bf4fe4b05ccb964bab9d_USGS_SGMC_feature/FeatureServer/3',
                 'https://energy.usgs.gov/arcgis/rest/services/Hosted/State_Geological_Map_Compilation/FeatureServer/0']
SGMC_ITEM = 'https://www.sciencebase.gov/catalog/item/5888bf4fe4b05ccb964bab9d?format=json'
SGMC_FIELDS = ['unit_link', 'unit_name', 'orig_label', 'sgmc_label', 'state', 'age_min', 'age_max', 'major1', 'major2', 'major3',
               'minor1', 'minor2', 'minor3', 'minor4', 'minor5', 'generalize', 'indetermin', 'indeterminate']
UA = {'User-Agent': 'AT-Resource-Grid geology build (github.com/Creese333/AT-Resource-Grid)'}

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
    m = re.search(r'<script id="payload" type="application/json">(.*?)</script>', h, re.S)
    P = json.loads(m.group(1)); grids = {'corr': {}, 'huc': {}}
    for lv in ('hex', 'cog', 'wheel'):
        L = P['levels'][lv]
        grids['corr'][lv] = gpd.GeoDataFrame({'id': L['id']}, geometry=rings_of(L), crs=4326).to_crs(AEA)
    if os.path.exists(HUCFILE):
        H = json.load(open(HUCFILE, encoding='utf-8'))
        for lv in ('hex', 'cog', 'wheel'):
            L = H['levels'][lv]
            grids['huc'][lv] = gpd.GeoDataFrame({'id': L['id']}, geometry=rings_of(L), crs=4326).to_crs(AEA)
    else:
        print('soils_wetlands_huc10.json not found: the HUC10 shell is left out', flush=True); del grids['huc']
    for g in grids.values():
        for t in g.values():
            t['a'] = t.area
    return grids

# ---------------------------------------------------------------- part 1: geologic map footprints
BEDROCK_TYPES = {'geologic map', 'bedrock map', 'rock-type map'}
SURF_TYPES = {'surficial map', 'materials map'}
MAP_BEST = ['1:24,000 or more detailed', '1:25,000 to 1:62,500', '1:100,000', 'Regional or statewide only']
SURF = ['Detailed surficial map (1:24,000 or more detailed)', 'Regional surficial map', 'No surficial map']
GIS_BEST = ['GIS data at 1:24,000 or more detailed', 'GIS data at 1:25,000 to 1:100,000', 'Statewide GIS data only', 'No GIS data']


def load_footprints():
    fp = gpd.read_file(FOOT).to_crs(AEA)
    fp['geometry'] = fp.geometry.buffer(0)
    fp['Type'] = fp['Type'].str.strip().str.lower(); fp['GIS_Data'] = fp['GIS_Data'].str.strip().str.lower()
    fp['inprog'] = fp['Notes'].fillna('').str.contains('in progress', case=False)
    fp = fp.sort_values(['Scale', 'Year'], ascending=[True, False]).reset_index(drop=True)
    table = [[r.FootPrint_ID, r.Map_Name, int(r.Year), int(r.Scale), r.Type, r.GIS_Data, r.Reference or '', r.Map_URL or '',
              '' if (r.Notes or 'NA') == 'NA' else r.Notes] for r in fp.itertuples()]
    return fp, table


POINTS = {'hex': 6, 'cog': 10, 'wheel': 16}      # sample grid per cell side; points inside the cell stand for its area


def sample_points(cells, lv):
    """a regular grid of points over each cell (kept where inside it): cell index -> points, used for every area share below"""
    import shapely
    k = POINTS[lv]; xs, ys, owner = [], [], []
    b = cells.geometry.bounds.values
    for i, (x0, y0, x1, y1) in enumerate(b):
        gx = x0 + (np.arange(k) + .5) * (x1 - x0) / k; gy = y0 + (np.arange(k) + .5) * (y1 - y0) / k
        X, Y = np.meshgrid(gx, gy); xs.append(X.ravel()); ys.append(Y.ravel()); owner.append(np.full(k * k, i))
    pts = shapely.points(np.concatenate(xs), np.concatenate(ys)); own = np.concatenate(owner)
    inside = shapely.contains_xy(cells.geometry.values[own], shapely.get_x(pts), shapely.get_y(pts))
    pts, own = pts[inside], own[inside]
    n = np.bincount(own, minlength=len(cells))
    return gpd.GeoDataFrame({'cell': own}, geometry=pts, crs=cells.crs), n


def hits(pts, layer, col):
    """(point row, layer value) for every point inside a layer polygon"""
    if layer is None or layer.empty:
        return pd.DataFrame({'p': [], 'v': []})
    li, pi = pts.sindex.query(layer.geometry.values, predicate='contains')   # layer polygon i contains point j
    return pd.DataFrame({'p': pi, 'v': layer[col].values[li]})


def footprint_measures(cells, fp, pts, npts):
    h = hits(pts, fp.reset_index().rename(columns={'index': 'fpi'}), 'fpi')
    h['cell'] = pts['cell'].values[h.p.values]
    tp, sc, gi = fp.Type.values, fp.Scale.values, fp.GIS_Data.values
    def cover(mask):
        """share of each cell's points inside at least one footprint passing mask"""
        k = h[mask[h.v.values]].drop_duplicates('p')
        return (np.bincount(k.cell.values, minlength=len(cells)) / np.maximum(npts, 1))
    bed = np.isin(tp, list(BEDROCK_TYPES)); sur = np.isin(tp, list(SURF_TYPES)); gis = (gi == 'yes') & (bed | sur)
    det, mid, hk = cover(bed & (sc <= 24000)), cover(bed & (sc <= 62500)), cover(bed & (sc <= 100000))
    best = np.where(det >= COVER, 0, np.where(mid >= COVER, 1, np.where(hk >= COVER, 2, 3)))
    sd, sa = cover(sur & (sc <= 24000)), cover(sur)
    surf = np.where(sd >= COVER, 0, np.where(sa >= COVER, 1, 2))
    g1, g2, g3 = cover(gis & (sc <= 24000)), cover(gis & (sc <= 100000)), cover(gis)
    gbest = np.where(g1 >= COVER, 0, np.where(g2 >= COVER, 1, np.where(g3 >= COVER, 2, 3)))
    # maps listed for each cell: those covering a tenth or more of it
    c = h.groupby(['cell', 'v']).size().reset_index(name='n'); c = c[c.n >= LIST_MIN * np.maximum(npts[c.cell.values], 1)]
    lists = [[] for _ in range(len(cells))]
    for cell, v in zip(c.cell.values, c.v.values): lists[cell].append(int(v))
    lists = [sorted(L) for L in lists]
    inprog = fp.inprog.values; yr = fp.Year.values
    newest = [max((int(yr[i]) for i in L if not inprog[i]), default=None) for L in lists]
    return {'MAP_BEST': best.astype(int).tolist(), 'PCT_DETAIL': [int(round(100 * v)) for v in det], 'SURF': surf.astype(int).tolist(),
            'GIS_BEST': gbest.astype(int).tolist(), 'MAP_NEWEST': newest, 'N_MAPS': [len(L) for L in lists],
            'N_INPROG': [int(sum(1 for i in L if inprog[i])) for L in lists], 'MAPS': lists}

# ---------------------------------------------------------------- part 2: SGMC bedrock
def get(url, data=None, tries=5, timeout=300):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            if k == tries - 1: raise
            print(f'   retry {k + 1} after {e}', flush=True); time.sleep(5 * (k + 1))


def sgmc_service(bounds):
    for url in SGMC_SERVICES:
        g = sgmc_service1(url, bounds)
        if g is not None and len(g):
            return g
    return None


def sgmc_service1(SGMC_SERVICE, bounds):
    """SGMC polygons from one feature service, by 0.5-degree tiles over the grid; None if the service cannot be used"""
    x0, y0, x1, y1 = bounds; feats = {}; t0 = time.time(); print(f'SGMC service {SGMC_SERVICE}', flush=True)
    try:
        meta = json.loads(get(SGMC_SERVICE + '?f=json', tries=2))
        names = {f['name'].lower(): f['name'] for f in meta.get('fields', [])}
        oid = next((f['name'] for f in meta.get('fields', []) if f.get('type') == 'esriFieldTypeOID'), 'fid')
        page = int(meta.get('maxRecordCount') or 1000)
    except Exception as e:
        print(f'SGMC service not reachable ({e})', flush=True); return None
    fields = ','.join([names[f] for f in SGMC_FIELDS + ['generalized_lith'] if f in names] + [oid])
    step = 0.5; tiles = [(x, y) for x in np.arange(math.floor(x0 / step) * step, x1, step) for y in np.arange(math.floor(y0 / step) * step, y1, step)]
    keep = TILEMASK
    for (x, y) in tiles:
        if keep is not None and not keep.intersects(box(x, y, x + step, y + step)):
            continue
        off = 0
        while True:
            q = {'where': '1=1', 'geometry': f'{x},{y},{x + step},{y + step}', 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
                 'spatialRel': 'esriSpatialRelIntersects', 'outFields': fields, 'outSR': 4326, 'f': 'geojson', 'orderByFields': oid,
                 'resultOffset': off, 'resultRecordCount': page}
            try:
                j = json.loads(get(SGMC_SERVICE + '/query', data=urllib.parse.urlencode(q).encode()))
            except Exception as e:
                print(f'SGMC service query failed ({e})', flush=True); return None
            if 'error' in j:
                print(f'SGMC service error: {j["error"]}', flush=True); return None
            fs = j.get('features', [])
            for f in fs:
                k = (f.get('properties') or {}).get(oid, f.get('id'))
                feats[k] = f
            if len(fs) < page and not j.get('exceededTransferLimit') and not (j.get('properties') or {}).get('exceededTransferLimit'):
                break
            off += len(fs)
            if not fs: break
    print(f'SGMC service: {len(feats):,} polygons ({time.time() - t0:.0f} s)', flush=True)
    if not feats: return None
    g = gpd.GeoDataFrame.from_features(list(feats.values()), crs=4326)
    g.columns = [c.lower() if c != 'geometry' else c for c in g.columns]
    if 'generalize' not in g.columns and 'generalized_lith' in g.columns:
        g['generalize'] = g['generalized_lith']
    return g


def sgmc_files(path, bounds):
    """SGMC polygons from a local shapefile, geodatabase or folder (joined to its units table if the lithology is in a separate table)"""
    import pyogrio
    cands = [path] if not os.path.isdir(path) else (glob.glob(os.path.join(path, '**', '*.gdb'), recursive=True) + glob.glob(os.path.join(path, '**', '*.shp'), recursive=True))
    polys, tables = None, []
    for c in cands:
        try:
            layers = pyogrio.list_layers(c)
        except Exception:
            continue
        for name, gt in layers:
            info = pyogrio.read_info(c, layer=name); flds = [f.lower() for f in info['fields']]
            print(f'   {os.path.basename(c)}:{name} {gt} {info["features"]:,} rows; fields {flds[:30]}', flush=True)
            if gt and 'Polygon' in gt and 'unit_link' in flds and (polys is None or info['features'] > 1000):
                g = pyogrio.read_dataframe(c, layer=name, bbox=bounds); g.columns = [x.lower() if x != 'geometry' else x for x in g.columns]
                polys = g.to_crs(4326) if g.crs else g.set_crs(4326)
            elif (not gt or gt == 'None') and 'unit_link' in flds:
                t = pyogrio.read_dataframe(c, layer=name, read_geometry=False); t.columns = [x.lower() for x in t.columns]; tables.append(t)
    if polys is None:
        return None
    if 'generalize' not in polys.columns and 'generalized_lith' in polys.columns:
        polys['generalize'] = polys['generalized_lith']
    missing = [f for f in SGMC_FIELDS if f not in polys.columns]
    for t in tables:
        if 'generalized_lith' in t.columns and 'generalize' not in t.columns: t['generalize'] = t['generalized_lith']
        if 'indeterminate' in t.columns and 'indetermin' not in t.columns: t['indetermin'] = t['indeterminate']
        add = [f for f in missing if f in t.columns]
        if add:
            polys = polys.merge(t[['unit_link'] + add].drop_duplicates('unit_link'), on='unit_link', how='left'); missing = [f for f in missing if f not in add]
    print(f'SGMC files: {len(polys):,} polygons; fields still missing: {missing}', flush=True)
    return polys


def sgmc_download(bounds):
    """the SGMC release on ScienceBase: the shapefile package if there is one, else the geodatabase"""
    try:
        item = json.loads(get(SGMC_ITEM, tries=3))
    except Exception as e:
        print(f'ScienceBase not reachable ({e})', flush=True); return None
    files = [(f.get('name', ''), f.get('url') or f.get('downloadUri'), f.get('size') or 0) for f in item.get('files', [])]
    for d in item.get('distributionLinks', []) or []:
        files.append((d.get('name') or d.get('title') or '', d.get('uri'), 0))
    print('ScienceBase files: ' + '; '.join(f'{n} ({s / 1e6:.0f} MB)' for n, _, s in files), flush=True)
    zips = [f for f in files if f[0].lower().endswith('.zip') and f[1]]
    pick = next((f for f in zips if 'shape' in f[0].lower()), None) or next((f for f in zips if 'gdb' in f[0].lower() or 'geodatabase' in f[0].lower()), None)
    if not pick:
        print('No SGMC zip found on ScienceBase', flush=True); return None
    tmp = tempfile.mkdtemp(); zpath = os.path.join(tmp, 'sgmc.zip'); t0 = time.time()
    print(f'downloading {pick[0]} ...', flush=True)
    req = urllib.request.Request(pick[1], headers=UA)
    with urllib.request.urlopen(req, timeout=3600) as r, open(zpath, 'wb') as f:
        while True:
            b = r.read(1 << 22)
            if not b: break
            f.write(b)
    print(f'   {os.path.getsize(zpath) / 1e6:.0f} MB in {time.time() - t0:.0f} s', flush=True)
    zipfile.ZipFile(zpath).extractall(tmp); os.remove(zpath)
    for z in glob.glob(os.path.join(tmp, '**', '*.zip'), recursive=True):     # zips inside the zip
        zipfile.ZipFile(z).extractall(os.path.dirname(z))
    return sgmc_files(tmp, bounds)


# lithology classes, checked in this order against the unit's first major lithology, then its generalized lithology
LITH = [('Carbonate rock (limestone, dolostone, marble)', r'limestone|dolostone|dolomite|marble|carbonate'),
        ('Mafic and ultramafic rock', r'ultramafic|serpentin|peridot|dunite|pyroxenite|soapstone|amphibolite|gabbro|norite|anorthosite|diabase|\bmafic'),
        ('Volcanic and metavolcanic rock', r'volcanic|basalt|rhyolite|andesite|dacite|tuff|greenstone|metabasalt'),
        ('Gneiss', r'gneiss|migmatite'),
        ('Schist', r'schist'),
        ('Granite and other intrusive rock', r'granit|granodiorite|tonalite|diorite|syenite|monzonite|pegmatite|charnockite|intrusive|plutonic'),
        ('Shale, slate and phyllite', r'shale|slate|phyllite|siltstone|mudstone|argillite|claystone|metasiltstone'),
        ('Sandstone, quartzite and conglomerate', r'sandstone|quartzite|conglomerate|arkose|graywacke|greywacke|arenite|metasandstone'),
        ('Unconsolidated deposits', r'unconsolidated|alluvi|till|colluvi|terrace|glacial|sand|gravel|\bclay|\bsilt'),
        ('Other sedimentary rock', r'sediment|clastic|chert|coal'),
        ('Other metamorphic rock', r'metamorph|hornfels|quartz|tectonite|mylonite|melange|m.lange'),
        ('Water', r'^water$')]
LITH_NAMES = [n for n, _ in LITH] + ['Other or undivided']
CARB = re.compile(r'limestone|dolostone|dolomite|marble|carbonate')
MAFIC = re.compile(r'ultramafic|serpentin|peridot|dunite|pyroxenite|soapstone|amphibolite|gabbro|norite|anorthosite|diabase|\bmafic|basalt|greenstone|metabasalt')
AGES = [('Precambrian (Proterozoic or older)', r'archean|proterozoic|precambrian|grenville'), ('Cambrian', r'cambrian'), ('Ordovician', r'ordovician'),
        ('Silurian', r'silurian'), ('Devonian', r'devonian'), ('Mississippian', r'mississippian'), ('Pennsylvanian', r'pennsylvanian'),
        ('Permian', r'permian'), ('Triassic or Jurassic', r'triassic|jurassic'), ('Cretaceous to Neogene', r'cretaceous|paleogene|neogene|tertiary|eocene|miocene|pliocene|oligocene|paleocene'),
        ('Quaternary', r'quaternary|pleistocene|holocene')]
AGE_NAMES = [n for n, _ in AGES] + ['Unknown']


def low(v):
    return '' if v is None or (isinstance(v, float) and math.isnan(v)) else str(v).strip().lower()


def lith_class(r):
    """the class of a unit's main lithologies (SGMC MAJOR1 to MAJOR3, in no order of abundance; classes earlier in LITH win),
    else of its generalized lithology, else of its indeterminate lithology"""
    for txt in (' | '.join(low(r.get(f)) for f in ('major1', 'major2', 'major3')), low(r.get('generalize')), low(r.get('indetermin')) or low(r.get('indeterminate'))):
        if not txt.strip(' |'): continue
        for k, (_, rx) in enumerate(LITH):
            if re.search(rx, txt): return k
    return len(LITH)


def age_class(r):
    """the unit's older age bound decides (SGMC age_max); in a range such as "Cambrian to Ordovician" the first age named is the older"""
    for txt in (low(r.get('age_max')), low(r.get('age_min'))):
        hits = [(m.start(), k) for k, (_, rx) in enumerate(AGES) for m in [re.search(rx, txt)] if m]
        if hits: return min(hits)[1]
    return len(AGES)


def units_table(sg):
    """one row per bedrock unit (unit_link): name, label, age text, lithology class, major lithologies, carbonate, mafic"""
    sg = sg.copy()
    for f in SGMC_FIELDS:
        if f not in sg.columns: sg[f] = None
    sg['unit_link'] = sg['unit_link'].fillna(sg['sgmc_label']).fillna(sg['orig_label']).astype(str)
    u = sg.drop_duplicates('unit_link').set_index('unit_link')
    rows, key = [], {}
    for ul, r in u.iterrows():
        r = r.to_dict(); majors = [low(r.get(f)) for f in ('major1', 'major2', 'major3') if low(r.get(f))]
        lc = lith_class(r); ac = age_class(r)
        a1, a2 = (r.get('age_max') or '').strip(), (r.get('age_min') or '').strip()
        age = a1 if not a2 or a2 == a1 else f'{a1} to {a2}'
        carb = 1 if any(CARB.search(m) for m in majors) or CARB.search(low(r.get('generalize'))) else 0
        maf = 1 if any(MAFIC.search(m) for m in majors) else 0
        key[ul] = len(rows)
        rows.append([str(r.get('unit_name') or r.get('orig_label') or ul).strip(), str(r.get('sgmc_label') or r.get('orig_label') or '').strip(), age, lc, ac,
                     ', '.join(majors), carb, maf, str(r.get('state') or '').strip()])
    sg['u'] = sg['unit_link'].map(key)
    return sg[['u', 'geometry']], rows


def bedrock_measures(cells, sg, units, pts, npts):
    h = hits(pts, sg, 'u'); h['cell'] = pts['cell'].values[h.p.values]; h = h.drop_duplicates('p')
    by = h.groupby(['cell', 'v']).size().reset_index(name='ar').rename(columns={'v': 'u'})
    U = np.array([[u[3], u[4], u[6], u[7]] for u in units]) if units else np.zeros((0, 4), int)
    by['lith'] = U[by.u.values, 0]; by['carb'] = U[by.u.values, 2]; by['maf'] = U[by.u.values, 3]
    n = len(cells); out = {k: [None] * n for k in ('GEO_LITH', 'GEO_AGE', 'PCT_CARB', 'PCT_MAFIC', 'N_UNITS', 'PCT_LITH', 'UNITS')}
    for k, g in by.groupby('cell'):
        tot = g.ar.sum()
        if tot < 0.02 * max(npts[k], 1): continue        # the bedrock map does not reach this cell
        lith = g.groupby('lith').ar.sum().sort_values(ascending=False)
        out['GEO_LITH'][k] = int(lith.index[0])
        out['PCT_LITH'][k] = [x for li, v in lith.items() if v / tot >= 0.005 for x in (int(li), round(100 * v / tot))]
        top = g.sort_values('ar', ascending=False)
        out['GEO_AGE'][k] = int(U[int(top.u.iloc[0]), 1])
        out['PCT_CARB'][k] = round(100 * g[g.carb == 1].ar.sum() / tot, 1)
        out['PCT_MAFIC'][k] = round(100 * g[g.maf == 1].ar.sum() / tot, 1)
        out['N_UNITS'][k] = int(g.u.nunique())
        out['UNITS'][k] = [x for u, ar in zip(top.u.values[:TOP_UNITS], top.ar.values[:TOP_UNITS]) for x in (int(u), round(100 * ar / tot))]
    return out


TILEMASK = None


def main():
    global TILEMASK
    t0 = time.time(); args = sys.argv[1:]
    grids = load_grids()
    allc = pd.concat([g['wheel'] for g in grids.values()]).to_crs(4326)
    bounds = tuple(allc.total_bounds); TILEMASK = unary_union(allc.geometry.values).buffer(0.02)
    print(f'grids loaded; area {bounds}', flush=True)

    fp, maps = load_footprints()
    print(f'{len(fp)} geologic map footprints', flush=True)

    sg = None
    if '--sgmc' in args:
        sg = sgmc_files(args[args.index('--sgmc') + 1], bounds)
    if sg is None:
        sg = sgmc_service(bounds)
    if sg is None:
        sg = sgmc_download(bounds)
    units, sgu = [], None
    if sg is not None and len(sg):
        sg = sg[sg.geometry.notna()]
        sgu, units = units_table(sg)
        sgu = sgu.to_crs(AEA); sgu['geometry'] = sgu.geometry.buffer(0)
        print(f'bedrock: {len(sgu):,} polygons, {len(units):,} units', flush=True)
        from collections import Counter
        print('   lithology classes: ' + ', '.join(f'{LITH_NAMES[k]} {v}' for k, v in Counter(u[3] for u in units).most_common()), flush=True)
        print('   ages: ' + ', '.join(f'{AGE_NAMES[k]} {v}' for k, v in Counter(u[4] for u in units).most_common()), flush=True)
    else:
        print('WARNING: no SGMC bedrock data; only the map coverage measures are written', flush=True)

    meta = {'built': date.today().isoformat(),
            'footprints': {'source': 'NPS Geologic Resources Inventory, Appalachian National Scenic Trail geologic map footprints (GIS data explanation, July 17, 2024)', 'maps': len(maps)},
            'sgmc': {'source': 'Horton, J.D., San Juan, C.A., and Stoeser, D.B., 2017, The State Geologic Map Compilation (SGMC) geodatabase of the conterminous United States: U.S. Geological Survey Data Series 1052, https://doi.org/10.5066/F7WH2N65',
                     'units': len(units)} if units else None}
    cats = {'MAP_BEST': MAP_BEST, 'SURF': SURF, 'GIS_BEST': GIS_BEST, 'GEO_LITH': LITH_NAMES, 'GEO_AGE': AGE_NAMES}
    for ext, levels in grids.items():
        themes = {}
        for lv, cells in levels.items():
            t1 = time.time(); pts, npts = sample_points(cells, lv); f = footprint_measures(cells, fp, pts, npts)
            if sgu is not None:
                f.update(bedrock_measures(cells, sgu, units, pts, npts))
            if ext == 'huc' and lv == 'hex':            # keep the HUC10 file small: no per-square-mile lists there
                f.pop('UNITS', None); f.pop('PCT_LITH', None)
            themes[lv] = {'ids': cells['id'].tolist(), 'f': f}
            print(f'   {ext} {lv}: {len(cells):,} cells ({time.time() - t1:.0f} s)', flush=True)
        out = {'run': date.today().isoformat(), 'meta': meta, 'cats': cats, 'maps': maps, 'units': units, 'themes': {'geo': themes}}
        with open(OUT[ext], 'w', encoding='utf-8') as fh:
            json.dump(out, fh, separators=(',', ':'), ensure_ascii=False)
        print(f'wrote {os.path.basename(OUT[ext])} ({os.path.getsize(OUT[ext]) / 1e6:.1f} MB)', flush=True)
    print(f'done in {time.time() - t0:.0f} s', flush=True)


if __name__ == '__main__':
    main()
